import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { checkAdminAccess } from "@/lib/admin-data/api.functions";
import { EmailPasswordAuth } from "@/components/EmailPasswordAuth";
import { AdminShell } from "@/components/admin/AdminShell";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — NearCart" }] }),
  component: AdminLayout,
});

function AdminLayout() {
  const { user, loading: authLoading } = useAuth();
  // The route-level check below is UX only — the real enforcement is
  // adminMiddleware on every admin-data server function itself (route
  // guards are not the data security boundary; see
  // plan/tasks/decisions.md's authorization-hardening plan).
  const { data: adminCheck, isLoading: adminCheckLoading } = useQuery({
    queryKey: ["admin-access", user?.id],
    queryFn: () => checkAdminAccess().then(
      () => true,
      () => false,
    ),
    enabled: Boolean(user),
  });

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm">
          <h1 className="mb-1 text-center text-xl font-extrabold">Admin login</h1>
          <p className="mb-4 text-center text-sm text-muted-foreground">
            Log in to access the admin console.
          </p>
          <EmailPasswordAuth onSuccess={() => toast.success("Logged in!")} />
        </div>
      </div>
    );
  }

  if (adminCheckLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!adminCheck) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 text-center">
        <div>
          <ShieldAlert className="mx-auto h-10 w-10 text-destructive" />
          <h1 className="mt-3 text-lg font-extrabold">Not authorized</h1>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            This account isn't an admin. Ask an existing admin to add a role for your account in
            public.user_roles.
          </p>
        </div>
      </div>
    );
  }

  return (
    <AdminShell>
      <Outlet />
    </AdminShell>
  );
}
