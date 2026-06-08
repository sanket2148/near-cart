// Simple client-side order store (localStorage). Swap for Lovable Cloud later.
import type { CartLine } from "./cart";

export type Order = {
  id: string;
  shopId: string;
  shopName: string;
  shopEmoji: string;
  lines: { name: string; emoji: string; price: number; unit: string; quantity: number }[];
  subtotal: number;
  deliveryFee: number;
  handling: number;
  total: number;
  paymentMethod: string;
  address: string;
  etaMinutes: number;
  placedAt: number;
  status: "placed" | "accepted" | "preparing" | "out_for_delivery" | "delivered";
};

const KEY = "nearcart-orders";

export function getOrders(): Order[] {
  try {
    if (typeof window === "undefined") return [];
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Order[]) : [];
  } catch {
    return [];
  }
}

export function getOrder(id: string): Order | undefined {
  return getOrders().find((o) => o.id === id);
}

export function saveOrder(order: Order) {
  const all = getOrders();
  all.unshift(order);
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

export function newOrderId(): string {
  return "NC" + Date.now().toString().slice(-8);
}

export function buildLines(lines: CartLine[]): Order["lines"] {
  return lines.map((l) => ({
    name: l.product.name,
    emoji: l.product.emoji,
    price: l.product.price,
    unit: l.product.unit,
    quantity: l.quantity,
  }));
}
