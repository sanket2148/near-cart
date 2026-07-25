import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Loader2,
  User,
  Mail,
  LogOut,
  ChevronRight,
  MapPin,
  CreditCard,
  Bell,
  HelpCircle,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { EmailPasswordAuth } from "@/components/EmailPasswordAuth";
import { useAuth } from "@/lib/auth";
import { getProfile, updateProfile } from "@/lib/profile/api.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — NearCart" }] }),
  component: SettingsPage,
});

const LINKS = [
  { to: "/addresses", label: "Saved Addresses", icon: MapPin },
  { to: "/payments", label: "Payment Methods", icon: CreditCard },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/help", label: "Help & Support", icon: HelpCircle },
] as const;

function SettingsPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => getProfile(),
    enabled: Boolean(user),
  });

  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) setFullName(profile.fullName ?? "");
  }, [profile]);

  async function save() {
    setSaving(true);
    try {
      await updateProfile({ data: { fullName } });
      await queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save your profile.");
    } finally {
      setSaving(false);
    }
  }

  async function onLogout() {
    await logout();
    toast.success("Logged out");
    navigate({ to: "/" });
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
      <AppShell>
        <h1 className="text-xl font-extrabold">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Log in to manage your account.</p>
        <div className="mt-4">
          <EmailPasswordAuth onSuccess={() => toast.success("Logged in!")} />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <h1 className="text-xl font-extrabold">Settings</h1>

      {isLoading ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <section className="mt-4 space-y-3 rounded-2xl border border-border bg-card p-4 shadow-card">
          <h2 className="flex items-center gap-2 font-bold">
            <User className="h-4 w-4 text-primary" /> Your profile
          </h2>
          <div className="space-y-1.5">
            <Label htmlFor="full-name">Full name</Label>
            <Input
              id="full-name"
              placeholder="Add your name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" /> Email
            </Label>
            <p className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              {profile?.email}
            </p>
            <p className="text-[11px] text-muted-foreground">
              This is your login email — it can't be changed here.
            </p>
          </div>
          <Button variant="hero" className="w-full" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
          </Button>
        </section>
      )}

      <section className="mt-4 space-y-0.5 rounded-2xl border border-border bg-card p-2 shadow-card">
        {LINKS.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors hover:bg-muted"
          >
            <Icon className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1">{label}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        ))}
      </section>

      <Button
        variant="outline"
        className="mt-4 w-full text-destructive hover:bg-destructive/10"
        onClick={onLogout}
      >
        <LogOut className="h-4 w-4" /> Log out
      </Button>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Want to delete your account? Email{" "}
        <a href="mailto:support@nearcart.app" className="font-semibold text-primary">
          support@nearcart.app
        </a>{" "}
        and we'll take care of it.
      </p>
    </AppShell>
  );
}
