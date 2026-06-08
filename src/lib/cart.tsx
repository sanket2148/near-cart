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
      const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
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
      if (typeof window !== "undefined") {
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
    return { shopId, lines, itemCount, subtotal, add, remove, setQty, clear, qtyOf };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId, lines]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
