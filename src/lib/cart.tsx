import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Product } from "./data";

export type CartLine = {
  product: Product;
  quantity: number;
};

type CartContextValue = {
  shopId: string | null;
  lines: CartLine[];
  itemCount: number;
  subtotal: number;
  add: (product: Product) => void;
  addMany: (items: { product: Product; quantity: number }[]) => void;
  remove: (productId: string) => void;
  setQty: (productId: string, qty: number) => void;
  clear: () => void;
  qtyOf: (productId: string) => number;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "nearcart-cart";

export function CartProvider({ children }: { children: ReactNode }) {
  const [shopId, setShopId] = useState<string | null>(null);
  const [lines, setLines] = useState<CartLine[]>([]);

  // hydrate from localStorage (client only)
  useEffect(() => {
    try {
      const raw =
        typeof window !== "undefined" && typeof localStorage !== "undefined"
          ? localStorage.getItem(STORAGE_KEY)
          : null;
      if (raw) {
        const parsed = JSON.parse(raw) as { shopId: string | null; lines: CartLine[] };
        setShopId(parsed.shopId ?? null);
        setLines(parsed.lines ?? []);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ shopId, lines }));
      }
    } catch {
      /* ignore */
    }
  }, [shopId, lines]);

  function add(product: Product) {
    setLines((prev) => {
      // single-shop cart: switching shops resets the cart
      if (shopId && shopId !== product.shopId) {
        setShopId(product.shopId);
        return [{ product, quantity: 1 }];
      }
      if (!shopId) setShopId(product.shopId);
      const existing = prev.find((l) => l.product.id === product.id);
      if (existing) {
        return prev.map((l) =>
          l.product.id === product.id ? { ...l, quantity: l.quantity + 1 } : l,
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  }

  /** Adds several products in one atomic update — used by reorder ("Buy it again"), where calling `add()` in a loop would repeatedly re-evaluate the stale shop-switch check against the same pre-render `shopId` and silently drop earlier items. */
  function addMany(items: { product: Product; quantity: number }[]) {
    if (items.length === 0) return;
    const targetShopId = items[0].product.shopId;
    setLines((prev) => {
      const base = shopId && shopId === targetShopId ? prev : [];
      const next = [...base];
      for (const { product, quantity } of items) {
        const existingIndex = next.findIndex((l) => l.product.id === product.id);
        if (existingIndex >= 0) {
          next[existingIndex] = {
            ...next[existingIndex],
            quantity: next[existingIndex].quantity + quantity,
          };
        } else {
          next.push({ product, quantity });
        }
      }
      return next;
    });
    if (shopId !== targetShopId) setShopId(targetShopId);
  }

  function setQty(productId: string, qty: number) {
    setLines((prev) => {
      const next = prev
        .map((l) => (l.product.id === productId ? { ...l, quantity: qty } : l))
        .filter((l) => l.quantity > 0);
      if (next.length === 0) setShopId(null);
      return next;
    });
  }

  function remove(productId: string) {
    setQty(productId, 0);
  }

  function clear() {
    setLines([]);
    setShopId(null);
  }

  function qtyOf(productId: string) {
    return lines.find((l) => l.product.id === productId)?.quantity ?? 0;
  }

  const value = useMemo<CartContextValue>(() => {
    const itemCount = lines.reduce((n, l) => n + l.quantity, 0);
    const subtotal = lines.reduce((n, l) => n + l.product.price * l.quantity, 0);
    return { shopId, lines, itemCount, subtotal, add, addMany, remove, setQty, clear, qtyOf };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId, lines]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
