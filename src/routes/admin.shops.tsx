import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, Loader2, Store } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listAllShops, suspendShop, reactivateShop, releaseShopClaim } from "@/lib/admin-data/api.functions";

export const Route = createFileRoute("/admin/shops")({
  component: AdminShopsPage,
});

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  incomplete: "secondary",
  pending_review: "default",
  approved: "outline",
  suspended: "destructive",
};

function AdminShopsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pendingId, setPendingId] = useState<string | null>(null);

  const { data: shops = [], isLoading } = useQuery({
    queryKey: ["admin-shops"],
    queryFn: () => listAllShops(),
  });

  const filtered = shops.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.ownerName.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || s.overallStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  async function handleSuspend(shopId: string) {
    setPendingId(shopId);
    try {
      await suspendShop({ data: { shopId } });
      toast.success("Shop suspended");
      queryClient.invalidateQueries({ queryKey: ["admin-shops"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not suspend shop");
    } finally {
      setPendingId(null);
    }
  }

  async function handleReactivate(shopId: string) {
    setPendingId(shopId);
    try {
      await reactivateShop({ data: { shopId } });
      toast.success("Shop reactivated");
      queryClient.invalidateQueries({ queryKey: ["admin-shops"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reactivate shop");
    } finally {
      setPendingId(null);
    }
  }

  async function handleReleaseClaim(shopId: string, shopName: string) {
    if (
      !window.confirm(
        `Release "${shopName}" back to the unclaimed pool? This removes its current owner and deletes any products they added — only do this for a claim that shouldn't have gone through.`,
      )
    ) {
      return;
    }
    setPendingId(shopId);
    try {
      await releaseShopClaim({ data: { shopId } });
      toast.success("Claim released — shop is unclaimed again");
      queryClient.invalidateQueries({ queryKey: ["admin-shops"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not release this claim");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Shops</h2>
          <p className="text-xs text-muted-foreground">{shops.length} total</p>
        </div>
      </div>

      <div className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search shops or owners…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-input bg-background px-3 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="incomplete">Incomplete</option>
          <option value="pending_review">Pending review</option>
          <option value="approved">Approved</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        {isLoading ? (
          <div className="flex justify-center p-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No shops match.</div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((shop) => (
              <div key={shop.id} className="flex items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary">
                    <Store className="h-4 w-4 text-muted-foreground" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-bold text-sm">{shop.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {shop.ownerName} · {shop.ownerPhone} · {shop.city}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant={STATUS_VARIANT[shop.overallStatus] ?? "secondary"}>
                    {shop.overallStatus}
                  </Badge>
                  <Badge variant={shop.isOpen ? "outline" : "secondary"}>
                    {shop.isOpen ? "Open" : "Closed"}
                  </Badge>
                  {shop.overallStatus === "suspended" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pendingId === shop.id}
                      onClick={() => handleReactivate(shop.id)}
                    >
                      Reactivate
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-destructive text-destructive hover:bg-destructive/5"
                      disabled={pendingId === shop.id}
                      onClick={() => handleSuspend(shop.id)}
                    >
                      Suspend
                    </Button>
                  )}
                  {shop.claimed && shop.source === "osm" && shop.overallStatus !== "approved" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-amber-500 text-amber-700 hover:bg-amber-50"
                      disabled={pendingId === shop.id}
                      onClick={() => handleReleaseClaim(shop.id, shop.name)}
                    >
                      Release claim
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
