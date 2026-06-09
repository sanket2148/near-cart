import { Link } from "@tanstack/react-router";
import { Store, ArrowLeftRight } from "lucide-react";
import { useSeller } from "@/lib/seller";

export function SellerHeader() {
  const { shop } = useSeller();
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
        <Link to="/seller" className="flex min-w-0 items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-primary text-lg shadow-card">
            {shop.emoji}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-extrabold leading-tight">
              {shop.name}
            </span>
            <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
              <Store className="h-3 w-3 text-primary" /> Seller dashboard
            </span>
          </span>
        </Link>

        <span className="flex items-center gap-2">
          <span
            className={`hidden rounded-full px-2.5 py-1 text-[11px] font-bold sm:inline-block ${
              shop.isOpen
                ? "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {shop.isOpen ? "Open" : "Closed"}
          </span>
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
