import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Store, TrendingUp, Bike, BadgeIndianRupee } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/sell")({
  head: () => ({
    meta: [
      { title: "Partner with NearCart — Sell to your neighborhood" },
      {
        name: "description",
        content:
          "List your shop on NearCart and reach more customers nearby. Easy catalog, order dashboard, and last-mile delivery — zero commission for the first 3 months.",
      },
      { property: "og:title", content: "Partner with NearCart" },
      {
        property: "og:description",
        content: "Grow your neighborhood shop online with NearCart.",
      },
    ],
  }),
  component: SellPage,
});

const benefits = [
  { icon: Store, title: "Go digital in minutes", desc: "List your shop and products with a simple dashboard — no tech skills needed." },
  { icon: TrendingUp, title: "Reach more customers", desc: "Be discoverable to everyone within your delivery radius." },
  { icon: Bike, title: "Built-in delivery", desc: "Use NearCart delivery partners for last-mile home delivery." },
  { icon: BadgeIndianRupee, title: "0% for 3 months", desc: "Launch offer — keep 100% of your sales for the first 3 months." },
];

function SellPage() {
  return (
    <AppShell hideNav>
      <Link to="/" className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <section className="overflow-hidden rounded-3xl bg-gradient-primary p-6 text-primary-foreground shadow-float">
        <p className="text-sm font-semibold opacity-90">For shop owners</p>
        <h1 className="mt-1 text-2xl font-extrabold leading-tight">
          Bring your shop online with NearCart
        </h1>
        <p className="mt-2 text-sm opacity-90">
          Reach more customers nearby, take orders digitally, and deliver to doorsteps — all from one simple app.
        </p>
        <Button variant="warm" size="xl" className="mt-5 w-full">
          Register your shop
        </Button>
      </section>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {benefits.map((b) => (
          <div key={b.title} className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <b.icon className="h-5 w-5" />
            </span>
            <h3 className="mt-3 font-bold">{b.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{b.desc}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card p-5 text-center shadow-card">
        <h2 className="text-lg font-bold">Ready to grow?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Join hundreds of neighborhood shops already on NearCart.
        </p>
        <Button variant="hero" size="lg" className="mt-4">
          Get started
        </Button>
      </div>
    </AppShell>
  );
}
