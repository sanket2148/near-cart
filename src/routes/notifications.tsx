import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Bell, CheckCheck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { EmailPasswordAuth } from "@/components/EmailPasswordAuth";
import { useAuth } from "@/lib/auth";
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type AppNotification,
} from "@/lib/notifications/api.functions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/notifications")({
  head: () => ({ meta: [{ title: "Notifications — NearCart" }] }),
  component: NotificationsPage,
});

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function NotificationsPage() {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: () => listNotifications(),
    enabled: Boolean(user),
  });

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  async function onOpen(n: AppNotification) {
    if (n.readAt) return;
    try {
      await markNotificationRead({ data: { id: n.id } });
      queryClient.setQueryData<AppNotification[]>(["notifications", user?.id], (prev) =>
        prev?.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)),
      );
    } catch {
      // Non-critical — a failed mark-read shouldn't interrupt reading the notification.
    }
  }

  async function onMarkAll() {
    try {
      await markAllNotificationsRead();
      await queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] });
      toast.success("All caught up");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't mark all as read.");
    }
  }

  if (authLoading) {
    return (
      <AppShell>
        <div className="flex justify-center py-20 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell hideNav>
        <h1 className="text-xl font-extrabold">Notifications</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Log in to see updates about your orders.
        </p>
        <div className="mt-4">
          <EmailPasswordAuth onSuccess={() => toast.success("Logged in!")} />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">Notifications</h1>
        {unreadCount > 0 && (
          <Button size="sm" variant="outline" onClick={onMarkAll}>
            <CheckCheck className="h-3.5 w-3.5" /> Mark all read
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-5xl">🔔</p>
          <h2 className="mt-4 text-lg font-bold">Nothing here yet</h2>
          <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
            Updates about your orders, verification, and offers will show up here.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => onOpen(n)}
              className={cn(
                "flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left shadow-card transition-colors",
                n.readAt ? "border-border bg-card" : "border-primary/20 bg-primary/[0.04]",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                  n.readAt ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary",
                )}
              >
                <Bell className="h-4.5 w-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p
                    className={cn(
                      "truncate text-sm",
                      n.readAt ? "font-semibold" : "font-extrabold",
                    )}
                  >
                    {n.title}
                  </p>
                  {!n.readAt && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                </div>
                {n.body && <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>}
                <p className="mt-1 text-[11px] text-muted-foreground">{timeAgo(n.createdAt)}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </AppShell>
  );
}
