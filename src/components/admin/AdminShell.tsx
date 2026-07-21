import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, ShieldCheck, Store, Bike, Package } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard },
  { to: "/admin/verification", label: "Verification", icon: ShieldCheck },
  { to: "/admin/shops", label: "Shops", icon: Store },
  { to: "/admin/partners", label: "Partners", icon: Bike },
  { to: "/admin/orders", label: "Orders", icon: Package },
] as const;

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-6xl px-6 py-4">
          <h1 className="text-xl font-black tracking-tight">Admin Console</h1>
          <nav className="mt-3 flex gap-1 overflow-x-auto">
            {TABS.map((tab) => {
              const active =
                tab.to === "/admin" ? pathname === "/admin" : pathname.startsWith(tab.to);
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.to}
                  to={tab.to}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  <Icon className="h-4 w-4" /> {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-6">{children}</main>
    </div>
  );
}
