import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, Loader2, Bike, Star } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listAllPartners, suspendPartner, reactivatePartner } from "@/lib/admin-data/api.functions";

export const Route = createFileRoute("/admin/partners")({
  component: AdminPartnersPage,
});

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  active: "outline",
  suspended: "destructive",
  removed: "destructive",
};

function AdminPartnersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pendingId, setPendingId] = useState<string | null>(null);

  const { data: partners = [], isLoading } = useQuery({
    queryKey: ["admin-partners"],
    queryFn: () => listAllPartners(),
  });

  const filtered = partners.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) || p.phone.includes(search);
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  async function handleSuspend(partnerId: string) {
    setPendingId(partnerId);
    try {
      await suspendPartner({ data: { partnerId } });
      toast.success("Partner suspended");
      queryClient.invalidateQueries({ queryKey: ["admin-partners"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not suspend partner");
    } finally {
      setPendingId(null);
    }
  }

  async function handleReactivate(partnerId: string) {
    setPendingId(partnerId);
    try {
      await reactivatePartner({ data: { partnerId } });
      toast.success("Partner reactivated");
      queryClient.invalidateQueries({ queryKey: ["admin-partners"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reactivate partner");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-bold">Delivery Partners</h2>
        <p className="text-xs text-muted-foreground">{partners.length} total</p>
      </div>

      <div className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or phone…"
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
          <option value="pending">Pending</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="removed">Removed</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        {isLoading ? (
          <div className="flex justify-center p-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No partners match.</div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((partner) => (
              <div key={partner.id} className="flex items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary">
                    <Bike className="h-4 w-4 text-muted-foreground" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-bold text-sm">{partner.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {partner.phone} · {partner.vehicle}
                      <span className="ml-1.5 inline-flex items-center gap-0.5">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />{" "}
                        {partner.ratingAvg.toFixed(1)}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant={STATUS_VARIANT[partner.status] ?? "secondary"}>
                    {partner.status}
                  </Badge>
                  <Badge variant={partner.online ? "outline" : "secondary"}>
                    {partner.online ? "Online" : "Offline"}
                  </Badge>
                  {partner.status === "suspended" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pendingId === partner.id}
                      onClick={() => handleReactivate(partner.id)}
                    >
                      Reactivate
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-destructive text-destructive hover:bg-destructive/5"
                      disabled={pendingId === partner.id}
                      onClick={() => handleSuspend(partner.id)}
                    >
                      Suspend
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
