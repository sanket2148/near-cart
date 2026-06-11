import { Link } from "@tanstack/react-router";
import { LayoutDashboard, Bike, IndianRupee, User } from "lucide-react";
import { usePartner } from "@/lib/partner";

const items = [
  { to: "/partner", label: "Home", icon: LayoutDashboard, exact: true },
  { to: "/partner/deliveries", label: "Deliveries", icon: Bike, exact: false },
  { to: "/partner/earnings", label: "Earnings", icon: IndianRupee, exact: false },
  { to: "/partner/profile", label: "Profile", icon: User, exact: false },
] as const;

export function PartnerBottomNav() {
  const { stats } = usePartner();
  return (
    <nav className="sticky bottom-0 z-40 border-t border-border bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-2xl items-stretch justify-around">
        {items.map(({ to, label, icon: Icon, exact }) => (
          <Link
            key={to}
            to={to}
            activeOptions={{ exact }}
            className="group relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-muted-foreground transition-colors data-[status=active]:text-primary"
          >
            <span className="relative">
              <Icon className="h-5 w-5" />
              {to === "/partner/deliveries" && stats.newCount > 0 && (
                <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">
                  {stats.newCount}
                </span>
              )}
            </span>
            <span className="text-[11px] font-medium">{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
