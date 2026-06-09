// Seller-side state for NearCart shop owners. Frontend-first, localStorage mock.
// Scoped to a SINGLE shop (the logged-in owner's shop) — never references other shops.
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { products as seedProducts, shops as seedShops, type Product } from "./data";

export type SellerOrderStatus =
  | "new"
  | "accepted"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "delivered"
  | "rejected";

export type SellerOrderLine = {
  name: string;
  emoji: string;
  price: number;
  unit: string;
  quantity: number;
};

export type SellerOrder = {
  id: string;
  customerName: string;
  address: string;
  phone: string;
  lines: SellerOrderLine[];
  total: number;
  paymentMethod: string;
  placedAt: number;
  status: SellerOrderStatus;
  partnerId?: string;
};

export type DeliveryPartner = {
  id: string;
  name: string;
  vehicle: string;
  phone: string;
  rating: number;
  available: boolean;
};

export type ShopProfile = {
  id: string;
  name: string;
  tagline: string;
  emoji: string;
  area: string;
  isOpen: boolean;
  deliveryFee: number;
  freeAbove: number;
  etaMinutes: number;
};

// ---- Seed (the owner's own shop) ----
const OWNED_SHOP_ID = "ramesh-stores";

function seedShopProfile(): ShopProfile {
  const s = seedShops.find((x) => x.id === OWNED_SHOP_ID)!;
  return {
    id: s.id,
    name: s.name,
    tagline: s.tagline,
    emoji: s.emoji,
    area: s.area,
    isOpen: s.isOpen,
    deliveryFee: s.deliveryFee,
    freeAbove: s.freeAbove,
    etaMinutes: s.etaMinutes,
  };
}

function seedShopProducts(): Product[] {
  return seedProducts.filter((p) => p.shopId === OWNED_SHOP_ID).map((p) => ({ ...p }));
}

const seedPartners: DeliveryPartner[] = [
  { id: "dp1", name: "Arjun K.", vehicle: "Bike", phone: "+91 90000 11111", rating: 4.8, available: true },
  { id: "dp2", name: "Suresh M.", vehicle: "Scooter", phone: "+91 90000 22222", rating: 4.6, available: true },
  { id: "dp3", name: "Imran S.", vehicle: "Bike", phone: "+91 90000 33333", rating: 4.9, available: false },
];

const HOUR = 60 * 60 * 1000;
const MIN = 60 * 1000;

function seedOrders(): SellerOrder[] {
  const now = Date.now();
  return [
    {
      id: "NC50231881",
      customerName: "Priya Sharma",
      address: "402, Lake View Apartments, Koramangala 5th Block",
      phone: "+91 98800 12345",
      lines: [
        { name: "Aashirvaad Atta 5kg", emoji: "🌾", price: 280, unit: "5 kg", quantity: 1 },
        { name: "Amul Gold Milk", emoji: "🥛", price: 34, unit: "500 ml", quantity: 2 },
        { name: "Tata Salt", emoji: "🧂", price: 28, unit: "1 kg", quantity: 1 },
      ],
      total: 376,
      paymentMethod: "UPI",
      placedAt: now - 3 * MIN,
      status: "new",
    },
    {
      id: "NC50231754",
      customerName: "Rahul Verma",
      address: "12, MG Road, Near Forum Mall",
      phone: "+91 98800 67890",
      lines: [
        { name: "Maggi Noodles", emoji: "🍜", price: 60, unit: "Pack of 4", quantity: 2 },
        { name: "Farm Eggs", emoji: "🥚", price: 84, unit: "Tray of 12", quantity: 1 },
      ],
      total: 204,
      paymentMethod: "COD",
      placedAt: now - 12 * MIN,
      status: "new",
    },
    {
      id: "NC50231602",
      customerName: "Anita Desai",
      address: "78, Jyoti Nagar, Koramangala 1st Block",
      phone: "+91 98800 24680",
      lines: [
        { name: "Fortune Sunflower Oil", emoji: "🛢️", price: 145, unit: "1 L", quantity: 2 },
        { name: "Toor Dal", emoji: "🫘", price: 150, unit: "1 kg", quantity: 1 },
      ],
      total: 440,
      paymentMethod: "UPI",
      placedAt: now - 40 * MIN,
      status: "preparing",
    },
    {
      id: "NC50231411",
      customerName: "Vikram Singh",
      address: "5, Rose Garden Road, Koramangala 6th Block",
      phone: "+91 98800 13579",
      lines: [{ name: "Aashirvaad Atta 5kg", emoji: "🌾", price: 280, unit: "5 kg", quantity: 1 }],
      total: 280,
      paymentMethod: "COD",
      placedAt: now - 70 * MIN,
      status: "out_for_delivery",
      partnerId: "dp1",
    },
    {
      id: "NC50230988",
      customerName: "Meena Iyer",
      address: "23, Silver Heights, Koramangala 4th Block",
      phone: "+91 98800 11223",
      lines: [
        { name: "Amul Gold Milk", emoji: "🥛", price: 34, unit: "500 ml", quantity: 4 },
        { name: "Maggi Noodles", emoji: "🍜", price: 60, unit: "Pack of 4", quantity: 1 },
      ],
      total: 196,
      paymentMethod: "UPI",
      placedAt: now - 2 * HOUR,
      status: "delivered",
      partnerId: "dp2",
    },
  ];
}

// ---- Persistence ----
const KEYS = {
  shop: "nearcart-seller-shop",
  products: "nearcart-seller-products",
  orders: "nearcart-seller-orders",
};

function load<T>(key: string, fallback: T): T {
  try {
    if (typeof window === "undefined") return fallback;
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, value: T) {
  try {
    if (typeof window === "undefined") return;
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

// ---- Status helpers ----
export const ORDER_FLOW: SellerOrderStatus[] = [
  "accepted",
  "preparing",
  "ready",
  "out_for_delivery",
  "delivered",
];

export const STATUS_LABEL: Record<SellerOrderStatus, string> = {
  new: "New",
  accepted: "Accepted",
  preparing: "Preparing",
  ready: "Ready to dispatch",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  rejected: "Rejected",
};

export function nextStatus(status: SellerOrderStatus): SellerOrderStatus | null {
  const i = ORDER_FLOW.indexOf(status);
  if (i === -1 || i === ORDER_FLOW.length - 1) return null;
  return ORDER_FLOW[i + 1];
}

function isToday(ts: number): boolean {
  const d = new Date(ts);
  const n = new Date();
  return (
    d.getDate() === n.getDate() &&
    d.getMonth() === n.getMonth() &&
    d.getFullYear() === n.getFullYear()
  );
}

// ---- Context ----
type SellerContextValue = {
  shop: ShopProfile;
  products: Product[];
  orders: SellerOrder[];
  partners: DeliveryPartner[];
  updateShop: (patch: Partial<ShopProfile>) => void;
  addProduct: (p: Omit<Product, "id" | "shopId">) => void;
  updateProduct: (id: string, patch: Partial<Product>) => void;
  removeProduct: (id: string) => void;
  toggleStock: (id: string) => void;
  acceptOrder: (id: string) => void;
  rejectOrder: (id: string) => void;
  advanceOrder: (id: string) => void;
  assignPartner: (orderId: string, partnerId: string) => void;
  stats: {
    newCount: number;
    activeCount: number;
    deliveredToday: number;
    revenueToday: number;
    lowStock: number;
  };
};

const SellerContext = createContext<SellerContextValue | null>(null);

export function SellerProvider({ children }: { children: ReactNode }) {
  const [shop, setShop] = useState<ShopProfile>(seedShopProfile);
  const [products, setProducts] = useState<Product[]>(seedShopProducts);
  const [orders, setOrders] = useState<SellerOrder[]>(seedOrders);
  const [partners] = useState<DeliveryPartner[]>(seedPartners);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage after mount (avoids SSR mismatch).
  useEffect(() => {
    setShop(load(KEYS.shop, seedShopProfile()));
    setProducts(load(KEYS.products, seedShopProducts()));
    setOrders(load(KEYS.orders, seedOrders()));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) save(KEYS.shop, shop);
  }, [shop, hydrated]);
  useEffect(() => {
    if (hydrated) save(KEYS.products, products);
  }, [products, hydrated]);
  useEffect(() => {
    if (hydrated) save(KEYS.orders, orders);
  }, [orders, hydrated]);

  const value = useMemo<SellerContextValue>(() => {
    const updateOrder = (id: string, patch: Partial<SellerOrder>) =>
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));

    const stats = {
      newCount: orders.filter((o) => o.status === "new").length,
      activeCount: orders.filter(
        (o) => !["new", "delivered", "rejected"].includes(o.status),
      ).length,
      deliveredToday: orders.filter((o) => o.status === "delivered" && isToday(o.placedAt))
        .length,
      revenueToday: orders
        .filter((o) => o.status === "delivered" && isToday(o.placedAt))
        .reduce((sum, o) => sum + o.total, 0),
      lowStock: products.filter((p) => !p.inStock).length,
    };

    return {
      shop,
      products,
      orders,
      partners,
      updateShop: (patch) => setShop((s) => ({ ...s, ...patch })),
      addProduct: (p) =>
        setProducts((prev) => [
          { ...p, id: "sp" + Date.now().toString().slice(-6), shopId: OWNED_SHOP_ID },
          ...prev,
        ]),
      updateProduct: (id, patch) =>
        setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p))),
      removeProduct: (id) => setProducts((prev) => prev.filter((p) => p.id !== id)),
      toggleStock: (id) =>
        setProducts((prev) =>
          prev.map((p) => (p.id === id ? { ...p, inStock: !p.inStock } : p)),
        ),
      acceptOrder: (id) => updateOrder(id, { status: "accepted" }),
      rejectOrder: (id) => updateOrder(id, { status: "rejected" }),
      advanceOrder: (id) =>
        setOrders((prev) =>
          prev.map((o) => {
            if (o.id !== id) return o;
            const next = o.status === "new" ? "accepted" : nextStatus(o.status);
            return next ? { ...o, status: next } : o;
          }),
        ),
      assignPartner: (orderId, partnerId) => updateOrder(orderId, { partnerId }),
      stats,
    };
  }, [shop, products, orders, partners]);

  return <SellerContext.Provider value={value}>{children}</SellerContext.Provider>;
}

export function useSeller(): SellerContextValue {
  const ctx = useContext(SellerContext);
  if (!ctx) throw new Error("useSeller must be used within SellerProvider");
  return ctx;
}

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / MIN);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.floor(hrs / 24)} d ago`;
}
