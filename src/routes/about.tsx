import { createFileRoute, Link } from "@tanstack/react-router";
import { MapPin, Store, Bike, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/about")({
  head: () => ({ meta: [{ title: "About Us — NearCart" }] }),
  component: AboutPage,
});

const STEPS = [
  {
    icon: MapPin,
    title: "Set your location",
    body: "We show you real shops within delivery range — grocery, pharmacy, bakery, and more — from your own neighborhood.",
  },
  {
    icon: Store,
    title: "Order from local shops",
    body: "Every shop on NearCart is a real local business, verified before it can start taking orders.",
  },
  {
    icon: Bike,
    title: "Track your delivery live",
    body: "Once a nearby delivery partner picks up your order, you can watch it arrive on a live map.",
  },
];

function AboutPage() {
  return (
    <AppShell>
      <div className="rounded-2xl bg-gradient-hero p-6 text-center">
        <span className="text-4xl">🛒</span>
        <h1 className="mt-2 text-xl font-extrabold">
          Near<span className="text-primary">Cart</span>
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          NearCart connects you with real shops in your own neighborhood — groceries, pharmacy,
          bakery, and more — delivered fast by local delivery partners.
        </p>
      </div>

      <section className="mt-5 space-y-3">
        {STEPS.map((s) => (
          <div
            key={s.title}
            className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 shadow-card"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <s.icon className="h-5 w-5" />
            </span>
            <div>
              <p className="font-bold">{s.title}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{s.body}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="mt-5 rounded-2xl border border-border bg-card p-4 shadow-card">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h2 className="font-bold">Verified sellers, real accountability</h2>
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Shops go through a verification process — business documents, GST/FSSAI checks where
          applicable, and photo confirmation — before they can list products, so you know who you're
          ordering from.
        </p>
      </section>

      <section className="mt-5 grid grid-cols-2 gap-3">
        <Link to="/sell">
          <Button variant="outline" className="w-full">
            <Store className="h-4 w-4" /> Sell on NearCart
          </Button>
        </Link>
        <Link to="/help">
          <Button variant="outline" className="w-full">
            Get help
          </Button>
        </Link>
      </section>
    </AppShell>
  );
}
