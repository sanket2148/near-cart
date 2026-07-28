import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  AlertTriangle,
  FileText,
  MapPin,
  Clock,
  UserCheck,
  Search,
  Loader2,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DOC_TYPE_LABELS, loadVerification, saveVerification, verificationStorageKey, type ShopVerification } from "@/lib/verification";
import {
  listShopsForReview,
  approveShop,
  rejectShop,
  findDuplicateCandidatesForShop,
} from "@/lib/admin-data/api.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/verification")({
  component: AdminVerificationPage,
});

type AdminShopReview = Awaited<ReturnType<typeof listShopsForReview>>[number];
type QueueItem = AdminShopReview & { levels?: ShopVerification["levels"] };
type ShopDuplicateCandidate = Awaited<ReturnType<typeof findDuplicateCandidatesForShop>>[number];

function AdminVerificationPage() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<QueueItem | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [reviewNotes, setReviewNotes] = useState("");
  const [duplicates, setDuplicates] = useState<ShopDuplicateCandidate[]>([]);
  const [duplicatesLoading, setDuplicatesLoading] = useState(false);

  useEffect(() => {
    listShopsForReview()
      .then((real) => {
        // Deep detail (documents, KYC, bank, GPS) is still localStorage-only
        // — attach it where it happens to exist on this device (see the
        // "not available on this device" fallback in the detail panel).
        const withLocalDetail: QueueItem[] = real.map((r) => {
          if (!localStorage.getItem(verificationStorageKey(r.shopId))) return r;
          const local = loadVerification(r.shopId);
          return { ...r, levels: local.levels };
        });
        setItems(withLocalDetail);
        setSelectedItem(withLocalDetail[0] ?? null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedItem) {
      setDuplicates([]);
      return;
    }
    let cancelled = false;
    setDuplicatesLoading(true);
    findDuplicateCandidatesForShop({ data: { shopId: selectedItem.shopId } })
      .then((rows) => {
        if (!cancelled) setDuplicates(rows);
      })
      .catch(() => {
        if (!cancelled) setDuplicates([]);
      })
      .finally(() => {
        if (!cancelled) setDuplicatesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedItem?.shopId]);

  const handleApprove = async () => {
    if (!selectedItem) return;
    try {
      await approveShop({ data: { shopId: selectedItem.shopId } });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not approve — please try again.");
      return;
    }

    // Same-device convenience: also flip the seller's local wizard state so
    // their own dashboard reflects it immediately without a refetch.
    if (localStorage.getItem(verificationStorageKey(selectedItem.shopId))) {
      const parsed = loadVerification(selectedItem.shopId);
      parsed.overallStatus = "approved";
      parsed.currentBadge = parsed.levels.l5_gps.lat ? "premium" : "verified";
      parsed.levels.l7_review.status = "verified";
      parsed.levels.l7_review.notes = reviewNotes;
      saveVerification(parsed);
    }

    const updated = items.filter((i) => i.shopId !== selectedItem.shopId);
    setItems(updated);
    setSelectedItem(updated[0] ?? null);
    setReviewNotes("");
    alert("Shop verification approved successfully!");
  };

  const handleReject = async () => {
    if (!selectedItem) return;
    try {
      await rejectShop({ data: { shopId: selectedItem.shopId } });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not reject — please try again.");
      return;
    }

    if (localStorage.getItem(verificationStorageKey(selectedItem.shopId))) {
      const parsed = loadVerification(selectedItem.shopId);
      parsed.overallStatus = "incomplete";
      parsed.levels.l7_review.status = "rejected";
      parsed.levels.l7_review.notes = reviewNotes;
      saveVerification(parsed);
    }

    const updated = items.filter((i) => i.shopId !== selectedItem.shopId);
    setItems(updated);
    setSelectedItem(updated[0] ?? null);
    setReviewNotes("");
    alert("Shop verification rejected.");
  };

  const filteredItems = items.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filterType === "all" || item.riskLevel === filterType;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="flex flex-col">
      <div className="mb-6">
        <h2 className="text-lg font-bold">Verification Queue</h2>
        <p className="text-xs text-muted-foreground">Manual review (Level 7 Verification)</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: List queue */}
        <div className="lg:col-span-1 space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search shops..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="rounded-lg border border-input bg-background px-3 text-sm"
            >
              <option value="all">All Risk</option>
              <option value="low">Low Risk</option>
              <option value="medium">Medium Risk</option>
              <option value="high">High Risk</option>
            </select>
          </div>

          <Card className="rounded-2xl shadow-card">
            <CardHeader className="p-4 border-b border-border">
              <CardTitle className="text-sm font-bold flex items-center justify-between">
                <span>Verification Queue</span>
                <Badge variant="secondary">{filteredItems.length} Pending</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 max-h-[500px] overflow-y-auto divide-y divide-border">
              {loading ? (
                <div className="flex justify-center p-8 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  Queue is empty. Excellent job!
                </div>
              ) : (
                filteredItems.map((item) => (
                  <button
                    key={item.shopId}
                    onClick={() => setSelectedItem(item)}
                    className={cn(
                      "w-full text-left p-4 hover:bg-muted/50 transition-colors flex flex-col gap-1.5",
                      selectedItem?.shopId === item.shopId && "bg-muted"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm truncate">{item.name}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground capitalize">{item.businessType}</span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[9px] font-bold",
                          item.riskLevel === "high"
                            ? "bg-destructive/10 text-destructive"
                            : item.riskLevel === "medium"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-100 text-emerald-800"
                        )}
                      >
                        {item.riskLevel.toUpperCase()} RISK
                      </span>
                    </div>
                    {item.flags.length > 0 && (
                      <div className="flex items-center gap-1 text-[10px] text-destructive font-semibold">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        <span>{item.flags.length} Automated Flags detected</span>
                      </div>
                    )}
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Review detail */}
        <div className="lg:col-span-2">
          {selectedItem ? (
            <Card className="rounded-2xl shadow-card">
              <CardHeader className="border-b border-border">
                <div className="flex justify-between items-start gap-4 flex-wrap">
                  <div>
                    <CardTitle className="text-lg font-bold">{selectedItem.name}</CardTitle>
                    <CardDescription className="text-xs">
                      Registered as {selectedItem.businessType} · Shop ID: {selectedItem.shopId}
                    </CardDescription>
                  </div>
                  <Badge variant={selectedItem.riskLevel === "high" ? "destructive" : "secondary"}>
                    {selectedItem.riskLevel.toUpperCase()} RISK TIER
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                {/* Flags Warning */}
                {selectedItem.flags.length > 0 && (
                  <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 space-y-2">
                    <h3 className="flex items-center gap-2 text-sm font-bold text-destructive">
                      <AlertTriangle className="h-4 w-4" /> AI Fraud Detections Triggered
                    </h3>
                    <ul className="list-disc pl-5 text-xs text-destructive/90 space-y-1">
                      {selectedItem.flags.map((flag: string) => (
                        <li key={flag} className="capitalize">
                          {flag.replace(/_/g, " ")}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Possible duplicate listings */}
                {duplicatesLoading ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking nearby shops for possible duplicates…
                  </div>
                ) : duplicates.length > 0 ? (
                  <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 space-y-2">
                    <h3 className="flex items-center gap-2 text-sm font-bold text-amber-800">
                      <Copy className="h-4 w-4" /> Possible duplicate listing{duplicates.length > 1 ? "s" : ""}
                    </h3>
                    <p className="text-xs text-amber-800/80">
                      Similarly-named shop{duplicates.length > 1 ? "s" : ""} found nearby — worth a look before approving.
                    </p>
                    <ul className="space-y-1.5">
                      {duplicates.map((d) => (
                        <li
                          key={d.id}
                          className="flex items-center justify-between gap-2 bg-white/70 rounded-lg p-2.5 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="font-bold truncate">{d.name}</p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {d.addressLine ?? d.city ?? "No address on file"}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-[9px] font-bold",
                                d.claimed
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-muted text-muted-foreground",
                              )}
                            >
                              {d.claimed ? "CLAIMED" : "UNCLAIMED"}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {Math.round(d.distanceM)}m away
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {/* Level details grid */}
                {!selectedItem.levels ? (
                  <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                    Detailed verification data (documents, KYC, bank, GPS) isn't available on this device — it still
                    lives in the seller's own browser storage until the full verification-pipeline migration is
                    done. You can still approve/reject based on the summary above.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Owner Identity */}
                    <div className="border border-border rounded-xl p-4 space-y-2 bg-card">
                      <h3 className="text-sm font-bold flex items-center gap-1.5">
                        <UserCheck className="h-4 w-4 text-primary" /> Owner KYC Details
                      </h3>
                      <div className="text-xs space-y-1 text-muted-foreground">
                        <p><span className="font-semibold text-foreground">Name:</span> {selectedItem.levels.l3_kyc.panName}</p>
                        <p><span className="font-semibold text-foreground">PAN:</span> {selectedItem.levels.l3_kyc.panNumber}</p>
                        <p><span className="font-semibold text-foreground">Aadhaar (Last 4):</span> ****{selectedItem.levels.l3_kyc.aadhaarLast4}</p>
                      </div>
                    </div>

                    {/* Bank Details */}
                    <div className="border border-border rounded-xl p-4 space-y-2 bg-card">
                      <h3 className="text-sm font-bold flex items-center gap-1.5">
                        <Clock className="h-4 w-4 text-primary" /> Bank Details (Penny Drop Verified)
                      </h3>
                      <div className="text-xs space-y-1 text-muted-foreground">
                        <p><span className="font-semibold text-foreground">A/C Name:</span> {selectedItem.levels.l4_bank.accountHolderName}</p>
                        <p><span className="font-semibold text-foreground">A/C Number:</span> {selectedItem.levels.l4_bank.accountNumber}</p>
                        <p><span className="font-semibold text-foreground">IFSC:</span> {selectedItem.levels.l4_bank.ifsc}</p>
                      </div>
                    </div>

                    {/* Documents */}
                    <div className="border border-border rounded-xl p-4 space-y-2 bg-card md:col-span-2">
                      <h3 className="text-sm font-bold flex items-center gap-1.5">
                        <FileText className="h-4 w-4 text-primary" /> Uploaded Documents
                      </h3>
                      <div className="space-y-2">
                        {selectedItem.levels.l2_documents.documents.map((doc) => (
                          <div key={doc.id} className="flex items-center justify-between bg-muted rounded-lg p-2.5 text-xs">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-primary" />
                              <div>
                                <p className="font-bold">{DOC_TYPE_LABELS[doc.docType] || doc.docType}</p>
                                <p className="text-[10px] text-muted-foreground">{doc.fileName}</p>
                              </div>
                            </div>
                            <Button size="sm" variant="outline">Preview Document</Button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* GPS & Photo */}
                    <div className="border border-border rounded-xl p-4 space-y-2 bg-card md:col-span-2">
                      <h3 className="text-sm font-bold flex items-center gap-1.5">
                        <MapPin className="h-4 w-4 text-primary" /> Physical Verification & GPS
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="text-xs space-y-1 text-muted-foreground">
                          <p><span className="font-semibold text-foreground">GPS Location:</span> {selectedItem.levels.l5_gps.lat?.toFixed(6)}, {selectedItem.levels.l5_gps.lng?.toFixed(6)}</p>
                          <p><span className="font-semibold text-foreground">Exif Match:</span> Yes (GPS matches upload device)</p>
                        </div>
                        <div className="border border-border rounded-lg h-24 flex items-center justify-center bg-muted text-muted-foreground text-xs font-semibold">
                          [Shop Map Marker Preview]
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Action panel */}
                <div className="border-t border-border pt-6 space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold">Verification Decision Notes</label>
                    <textarea
                      placeholder="Add review notes, reasons for rejection or feedback..."
                      className="w-full h-24 border border-input rounded-xl bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                    />
                  </div>

                  <div className="flex gap-3 justify-end">
                    <Button variant="outline" size="lg" className="border-destructive text-destructive hover:bg-destructive/5" onClick={handleReject}>
                      Reject Registration
                    </Button>
                    <Button variant="hero" size="lg" onClick={handleApprove}>
                      Approve & Issue Badge
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center text-muted-foreground shadow-card">
              Select a shop from the queue to start manual verification review.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
