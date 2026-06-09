import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Search, Pencil } from "lucide-react";
import { useSeller } from "@/lib/seller";
import { formatINR, type Product } from "@/lib/data";
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

export const Route = createFileRoute("/seller/products")({
  component: SellerProducts,
});

function SellerProducts() {
  const { products, toggleStock, removeProduct } = useSeller();
  const [query, setQuery] = useState("");

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">Products</h1>
        <ProductDialog
          trigger={
            <Button variant="hero" size="sm">
              <Plus className="h-4 w-4" /> Add
            </Button>
          }
        />
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
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-xl">
                {p.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{p.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatINR(p.price)} · {p.unit} · {p.category}
                </p>
                <span
                  className={cn(
                    "mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold",
                    p.inStock ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive",
                  )}
                >
                  {p.inStock ? "In stock" : "Out of stock"}
                </span>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Switch checked={p.inStock} onCheckedChange={() => toggleStock(p.id)} />
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

function ProductDialog({
  product,
  trigger,
}: {
  product?: Product;
  trigger: React.ReactNode;
}) {
  const { addProduct, updateProduct } = useSeller();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: product?.name ?? "",
    emoji: product?.emoji ?? "📦",
    price: product?.price?.toString() ?? "",
    mrp: product?.mrp?.toString() ?? "",
    unit: product?.unit ?? "",
    category: product?.category ?? "",
  });

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    if (!form.name.trim() || !form.price) {
      toast.error("Name and price are required");
      return;
    }
    const payload = {
      name: form.name.trim(),
      emoji: form.emoji || "📦",
      price: Number(form.price),
      mrp: form.mrp ? Number(form.mrp) : undefined,
      unit: form.unit.trim() || "1 pc",
      category: form.category.trim() || "General",
      inStock: true,
    };
    if (product) {
      updateProduct(product.id, payload);
      toast.success("Product updated");
    } else {
      addProduct(payload);
      toast.success("Product added");
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{product ? "Edit product" : "Add product"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
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
        </div>
        <DialogFooter>
          <Button variant="hero" className="w-full" onClick={submit}>
            {product ? "Save changes" : "Add product"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
