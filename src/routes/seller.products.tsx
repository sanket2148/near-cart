import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Search, Pencil, Camera, Loader2, ScanBarcode, Info } from "lucide-react";
import { useSeller } from "@/lib/seller";
import { formatINR, type Product } from "@/lib/data";
import { uploadProductImage, getCatalogProductByBarcode } from "@/lib/seller-data/api.functions";
import { lookupBarcode } from "@/lib/barcode/api.functions";
import { fileToBase64 } from "@/lib/verification";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { BarcodeScanner } from "@/components/seller/BarcodeScanner";

export const Route = createFileRoute("/seller/products")({
  component: SellerProducts,
});

function SellerProducts() {
  const { shop, products, toggleStock, removeProduct } = useSeller();
  const [query, setQuery] = useState("");
  // Set when a barcode scan during "Add product" matches something already
  // in this shop's own catalog — jumps straight to editing that product
  // instead of letting the merchant accidentally create a second row for
  // the same item. See ProductDialog's handleBarcodeDetected.
  const [duplicateTarget, setDuplicateTarget] = useState<Product | null>(null);

  const filtered = products.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="space-y-4">
      {/* Product management is deliberately NOT gated on verification — a
          seller should be able to build a real catalog while the trust team
          reviews their shop, so orders can start flowing the moment it's
          approved. Customer-facing visibility (getShopProducts/searchProducts
          in catalog/backend.server.ts) and order placement (isShopAcceptingOrders
          in orders/backend.server.ts) independently stay gated — this banner
          is purely informational. */}
      {shop.verificationStatus !== "approved" && (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Your shop is still pending verification — customers can&apos;t see or order these
            products yet, but everything you add here will be ready to go live the moment your
            shop is approved.
          </span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">Products</h1>
        <ProductDialog
          trigger={
            <Button variant="hero" size="sm">
              <Plus className="h-4 w-4" /> Add
            </Button>
          }
          onDuplicateFound={setDuplicateTarget}
        />
        {duplicateTarget && (
          <ProductDialog
            product={duplicateTarget}
            open
            onOpenChange={(next) => {
              if (!next) setDuplicateTarget(null);
            }}
          />
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your products"
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No products found.
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-card"
            >
              {p.imageUrl ? (
                <img
                  src={p.imageUrl}
                  alt={p.name}
                  className="h-11 w-11 shrink-0 rounded-xl object-cover"
                />
              ) : (
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-xl">
                  {p.emoji}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{p.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatINR(p.price)} · {p.unit} · {p.category}
                </p>
                <span
                  className={cn(
                    "mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold",
                    p.inStock
                      ? "bg-primary/10 text-primary"
                      : "bg-destructive/10 text-destructive",
                  )}
                >
                  {p.stockQty != null
                    ? `${p.stockQty} in stock`
                    : p.inStock
                      ? "In stock"
                      : "Out of stock"}
                </span>
              </div>
              <div className="flex flex-col items-end gap-2">
                {/* Tracked products (real stock_qty) derive in/out-of-stock
                    automatically as orders decrement it — no manual switch,
                    since it would just be overwritten by the next order. */}
                {p.stockQty == null && (
                  <Switch checked={p.inStock} onCheckedChange={() => toggleStock(p.id)} />
                )}
                <div className="flex gap-1">
                  <ProductDialog
                    product={p}
                    trigger={
                      <button className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
                        <Pencil className="h-4 w-4" />
                      </button>
                    }
                  />
                  <button
                    onClick={() => {
                      removeProduct(p.id);
                      toast("Product removed");
                    }}
                    className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type ProductDialogProps = {
  product?: Product;
  /** Omit when the dialog is externally controlled (see `open`/`onOpenChange`) — used for the "jump to the duplicate's edit dialog" flow, which has no visible trigger of its own. */
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Add-mode only: fired when a scanned barcode matches a product already in this shop's catalog, instead of proceeding with a new one. */
  onDuplicateFound?: (existing: Product) => void;
};

function ProductDialog({
  product,
  trigger,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  onDuplicateFound,
}: ProductDialogProps) {
  const { addProduct, updateProduct, products } = useSeller();
  const queryClient = useQueryClient();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = setControlledOpen ?? setInternalOpen;
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [scanning, setScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    name: product?.name ?? "",
    emoji: product?.emoji ?? "📦",
    price: product?.price?.toString() ?? "",
    mrp: product?.mrp?.toString() ?? "",
    unit: product?.unit ?? "",
    category: product?.category ?? "",
    barcode: product?.barcode ?? "",
    stockQty: product?.stockQty?.toString() ?? "",
  });
  // Separate from form.stockQty's string value so the quantity field can be
  // shown/hidden without losing whatever the seller already typed if they
  // toggle tracking off and back on within the same session.
  const [trackQty, setTrackQty] = useState(product?.stockQty != null);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Real name+unit+category prefill from a scanned barcode (see
  // plan/tasks/decisions.md, 2026-07-25) — only fills fields the merchant
  // hasn't already typed, never overwrites. A barcode already present in
  // this shop's own catalog jumps to editing that product instead of
  // creating a duplicate, mirroring the shop-level duplicate nudge in
  // CreateShopStep.tsx.
  async function handleBarcodeDetected(code: string) {
    setScanning(false);
    const existing = products.find((p) => p.barcode && p.barcode === code);
    if (existing) {
      toast("You already have this product — opening it to edit.");
      onDuplicateFound?.(existing);
      setOpen(false);
      return;
    }
    set("barcode", code);

    // Check NearCart's own catalog first (another shop may have already
    // scanned this exact barcode) — no external call, and covers barcodes
    // Open Food Facts has no record of (this shop's own past manual entry).
    try {
      const catalogHit = await getCatalogProductByBarcode({ data: { barcode: code } });
      if (catalogHit) {
        setForm((f) => ({ ...f, name: f.name.trim() ? f.name : catalogHit.name }));
        toast.success(`Found in catalog: ${catalogHit.name}`);
        return;
      }
    } catch {
      // Catalog lookup failing shouldn't block falling through to Open Food
      // Facts — worst case the merchant just fills the form in manually.
    }

    try {
      const result = await lookupBarcode({ data: { barcode: code } });
      if (result) {
        setForm((f) => ({
          ...f,
          name: f.name.trim() ? f.name : result.name,
          unit: f.unit.trim() ? f.unit : result.unit,
          category: f.category.trim() ? f.category : result.category,
        }));
        toast.success(`Found: ${result.name}`);
      } else {
        toast("No match found — fill in the details");
      }
    } catch {
      toast("Couldn't look up that barcode — fill in the details");
    }
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !product) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Use a JPEG, PNG, or WebP image.");
      return;
    }
    setUploadingPhoto(true);
    try {
      const dataBase64 = await fileToBase64(file);
      await uploadProductImage({
        data: {
          productId: product.id,
          dataBase64,
          mimeType: file.type as "image/jpeg" | "image/png" | "image/webp",
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["my-products"] });
      toast.success("Product photo updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't upload the photo.");
    } finally {
      setUploadingPhoto(false);
    }
  }

  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!form.name.trim() || !form.price) {
      toast.error("Name and price are required");
      return;
    }
    const stockQty = trackQty && form.stockQty.trim() ? Number(form.stockQty) : undefined;
    const payload = {
      name: form.name.trim(),
      emoji: form.emoji || "📦",
      price: Number(form.price),
      mrp: form.mrp ? Number(form.mrp) : undefined,
      unit: form.unit.trim() || "1 pc",
      category: form.category.trim() || "General",
      // Editing no longer silently resets an out-of-stock product back to
      // in-stock on every save — reuses its current value; a tracked
      // quantity overrides this server-side anyway (seller-data/backend.server.ts).
      inStock: product ? product.inStock : true,
      barcode: form.barcode.trim() || undefined,
      stockQty,
    };
    setSubmitting(true);
    try {
      if (product) {
        await updateProduct(product.id, payload);
        toast.success("Product updated");
      } else {
        await addProduct(payload);
        toast.success("Product added");
      }
      setOpen(false);
    } catch (err) {
      // Real server-side conflicts (e.g. a scanned barcode this shop
      // already has — the 23505 path in addProduct/updateProduct,
      // migration 0015) surface here instead of vanishing silently.
      toast.error(err instanceof Error ? err.message : "Couldn't save this product.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{product ? "Edit product" : "Add product"}</DialogTitle>
        </DialogHeader>
        {scanning && (
          <BarcodeScanner onDetected={handleBarcodeDetected} onClose={() => setScanning(false)} />
        )}
        <div className={cn("space-y-3", scanning && "hidden")}>
          {!product && (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setScanning(true)}
            >
              <ScanBarcode className="h-4 w-4" /> Scan barcode
            </Button>
          )}
          {form.barcode && (
            <p className="text-center text-xs text-muted-foreground">Barcode: {form.barcode}</p>
          )}
          {product && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="group relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-secondary text-2xl"
              >
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  form.emoji
                )}
                <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                  {uploadingPhoto ? (
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                  ) : (
                    <Camera className="h-4 w-4 text-white" />
                  )}
                </span>
              </button>
              <p className="text-xs text-muted-foreground">
                Tap to {product.imageUrl ? "change" : "add"} a real product photo.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handlePhotoChange}
              />
            </div>
          )}
          <div className="grid grid-cols-[64px_1fr] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="emoji">Icon</Label>
              <Input
                id="emoji"
                value={form.emoji}
                onChange={(e) => set("emoji", e.target.value)}
                className="text-center text-xl"
                maxLength={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. Aashirvaad Atta 5kg"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="price">Price (₹)</Label>
              <Input
                id="price"
                type="number"
                value={form.price}
                onChange={(e) => set("price", e.target.value)}
                placeholder="280"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mrp">MRP (₹, optional)</Label>
              <Input
                id="mrp"
                type="number"
                value={form.mrp}
                onChange={(e) => set("mrp", e.target.value)}
                placeholder="305"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="unit">Unit</Label>
              <Input
                id="unit"
                value={form.unit}
                onChange={(e) => set("unit", e.target.value)}
                placeholder="5 kg"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
                placeholder="Staples"
              />
            </div>
          </div>
          <div className="rounded-xl border border-border p-3">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="track-qty">Track quantity</Label>
                <p className="text-xs text-muted-foreground">
                  In stock / out of stock updates automatically as orders come in.
                </p>
              </div>
              <Switch id="track-qty" checked={trackQty} onCheckedChange={setTrackQty} />
            </div>
            {trackQty && (
              <div className="mt-3 space-y-1.5">
                <Label htmlFor="stockQty">Quantity in stock</Label>
                <Input
                  id="stockQty"
                  type="number"
                  min="0"
                  value={form.stockQty}
                  onChange={(e) => set("stockQty", e.target.value)}
                  placeholder="e.g. 25"
                />
              </div>
            )}
          </div>
        </div>
        {!scanning && (
          <DialogFooter>
            <Button variant="hero" className="w-full" disabled={submitting} onClick={submit}>
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : product ? (
                "Save changes"
              ) : (
                "Add product"
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
