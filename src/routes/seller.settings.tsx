import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Store, Bike, Power, ArrowLeftRight, Shield, Camera, Loader2 } from "lucide-react";
import { useSeller } from "@/lib/seller";
import { uploadShopLogo } from "@/lib/seller-data/api.functions";
import { ShopHoursEditor } from "@/components/seller/ShopHoursEditor";
import { fileToBase64 } from "@/lib/verification";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { VerificationBadge } from "@/components/VerificationBadge";

export const Route = createFileRoute("/seller/settings")({
  component: SellerSettings,
});

function SellerSettings() {
  const { shop, updateShop, partners, verification } = useSeller();
  const queryClient = useQueryClient();
  const isApproved = verification.overallStatus === "approved";
  const [form, setForm] = useState({
    name: shop.name,
    tagline: shop.tagline,
    area: shop.area,
    deliveryFee: shop.deliveryFee.toString(),
    freeAbove: shop.freeAbove.toString(),
    etaMinutes: shop.etaMinutes.toString(),
  });
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Use a JPEG, PNG, or WebP image.");
      return;
    }
    setUploadingLogo(true);
    try {
      const dataBase64 = await fileToBase64(file);
      await uploadShopLogo({
        data: {
          shopId: shop.id,
          dataBase64,
          mimeType: file.type as "image/jpeg" | "image/png" | "image/webp",
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["my-shop"] });
      toast.success("Shop photo updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't upload the photo.");
    } finally {
      setUploadingLogo(false);
    }
  }

  const save = () => {
    updateShop({
      name: form.name.trim() || shop.name,
      tagline: form.tagline.trim(),
      area: form.area.trim(),
      deliveryFee: Number(form.deliveryFee) || 0,
      freeAbove: Number(form.freeAbove) || 0,
      etaMinutes: Number(form.etaMinutes) || 0,
    });
    toast.success("Shop details saved");
  };

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-extrabold">Shop settings</h1>

      {/* Verification Status */}
      <section className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-card">
        <span className="flex items-center gap-3">
          <span
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl",
              shop.badgeTier && shop.badgeTier !== "none"
                ? "bg-emerald-50 text-emerald-600 border border-emerald-100/50"
                : "bg-muted text-muted-foreground",
            )}
          >
            <Shield className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-sm font-bold flex items-center gap-1.5">
              Verification status
              {shop.badgeTier && shop.badgeTier !== "none" && (
                <VerificationBadge tier={shop.badgeTier} size="sm" showLabel={false} />
              )}
            </span>
            <span className="text-xs text-muted-foreground capitalize">
              {shop.verificationStatus === "approved"
                ? "Fully verified"
                : shop.verificationStatus.replace(/_/g, " ")}
            </span>
          </span>
        </span>
        <Button asChild variant="outline" size="sm">
          <Link to="/seller/verification">View details</Link>
        </Button>
      </section>

      {/* Open / closed */}
      <section className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-card">
        <span className="flex items-center gap-3">
          <span
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl",
              shop.isOpen ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
            )}
          >
            <Power className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-sm font-bold">
              Shop is {shop.isOpen && isApproved ? "open" : "closed"}
            </span>
            <span className="text-xs text-muted-foreground">
              {!isApproved
                ? "Verification required to go live"
                : shop.isOpen
                  ? "Accepting orders"
                  : "Not accepting orders"}
            </span>
          </span>
        </span>
        <Switch
          checked={shop.isOpen && isApproved}
          disabled={!isApproved}
          onCheckedChange={(v) => {
            updateShop({ isOpen: v });
            toast(v ? "Shop opened" : "Shop closed");
          }}
        />
      </section>

      <ShopHoursEditor shopId={shop.id} />

      {/* Profile */}
      <section className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-card">
        <h2 className="flex items-center gap-2 font-bold">
          <Store className="h-4 w-4 text-primary" /> Shop profile
        </h2>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingLogo}
            className="group relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-hero text-3xl"
          >
            {shop.logoUrl ? (
              <img src={shop.logoUrl} alt={shop.name} className="h-full w-full object-cover" />
            ) : (
              shop.emoji
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
              {uploadingLogo ? (
                <Loader2 className="h-5 w-5 animate-spin text-white" />
              ) : (
                <Camera className="h-5 w-5 text-white" />
              )}
            </span>
          </button>
          <div>
            <p className="text-sm font-bold">Shop photo</p>
            <p className="text-xs text-muted-foreground">
              Tap to {shop.logoUrl ? "change" : "add"} a real photo of your storefront.
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleLogoChange}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="name">Shop name</Label>
          <Input id="name" value={form.name} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tagline">Tagline</Label>
          <Input
            id="tagline"
            value={form.tagline}
            onChange={(e) => set("tagline", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="area">Area</Label>
          <Input id="area" value={form.area} onChange={(e) => set("area", e.target.value)} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="fee">Delivery ₹</Label>
            <Input
              id="fee"
              type="number"
              value={form.deliveryFee}
              onChange={(e) => set("deliveryFee", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="free">Free above ₹</Label>
            <Input
              id="free"
              type="number"
              value={form.freeAbove}
              onChange={(e) => set("freeAbove", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eta">ETA min</Label>
            <Input
              id="eta"
              type="number"
              value={form.etaMinutes}
              onChange={(e) => set("etaMinutes", e.target.value)}
            />
          </div>
        </div>
        <Button variant="hero" className="w-full" onClick={save}>
          Save changes
        </Button>
      </section>

      {/* Delivery partners */}
      <section className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-card">
        <h2 className="flex items-center gap-2 font-bold">
          <Bike className="h-4 w-4 text-primary" /> Delivery partners
        </h2>
        <ul className="space-y-2">
          {partners.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded-xl border border-border bg-background p-3"
            >
              <span>
                <span className="block text-sm font-bold">{p.name}</span>
                <span className="text-xs text-muted-foreground">
                  {p.vehicle} · ⭐ {p.rating} · {p.phone}
                </span>
              </span>
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-bold",
                  p.available ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                )}
              >
                {p.available ? "Available" : "Busy"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <Button asChild variant="outline" className="w-full">
        <Link to="/">
          <ArrowLeftRight className="h-4 w-4" /> Switch to shopping view
        </Link>
      </Button>
    </div>
  );
}
