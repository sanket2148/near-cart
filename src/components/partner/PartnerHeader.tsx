import { Link } from "@tanstack/react-router";
import { Bike, ArrowLeftRight } from "lucide-react";
import { usePartner } from "@/lib/partner";
import { Switch } from "@/components/ui/switch";

export function PartnerHeader() {
  const { profile, toggleOnline } = usePartner();
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
        <Link to="/partner" className="flex min-w-0 items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-card">
            <Bike className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-extrabold leading-tight">
              {profile.name}
            </span>
            <span className="text-[11px] font-medium text-muted-foreground">
              Delivery partner · ⭐ {profile.rating}
            </span>
          </span>
        </Link>

        <span className="flex items-center gap-2.5">
          <label className="flex items-center gap-1.5">
            <span
              className={`text-[11px] font-bold ${
                profile.online ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {profile.online ? "Online" : "Offline"}
            </span>
            <Switch checked={profile.online} onCheckedChange={toggleOnline} />
          </label>
          <Link
            to="/"
            className="flex items-center gap-1 rounded-xl border border-border bg-card px-2.5 py-1.5 text-xs font-semibold transition-colors hover:bg-accent/10"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" /> Shop view
          </Link>
        </span>
      </div>
    </header>
  );
}
