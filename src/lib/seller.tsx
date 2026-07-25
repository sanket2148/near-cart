// Seller-side state for NearCart shop owners. Real DB-backed as of Phase D
// (shop/products/orders) and Phase E (delivery partners) of the backend
// build-out — SellerProvider keeps exposing the exact same Context shape it
// always did, so seller.index.tsx/seller.orders.tsx/seller.products.tsx/etc.
// didn't need to change at all; only the persistence layer underneath did.
//
// NOT migrated here (deliberately out of scope):
//   - Verification wizard state (src/lib/verification.ts) — still
//     localStorage; only its badge/business-type/overall-status *summary*
//     is synced to the real shop_verifications row (see updateVerification
//     below), since that's what real customers see in Phase B's catalog.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type Product } from "./data";
import {
  type BusinessType,
  type BadgeTier,
  type ShopVerification,
  loadVerification,
  saveVerification,
} from "./verification";
import { useAuth } from "./auth";
import {
  getMyShop as getMyShopFn,
  createShop as createShopFn,
  searchUnclaimedShops as searchUnclaimedShopsFn,
  findPossibleShopMatches as findPossibleShopMatchesFn,
  claimShop as claimShopFn,
  updateShop as updateShopFn,
  syncVerificationSummary,
  getMyProducts as getMyProductsFn,
  addProduct as addProductFn,
  updateProduct as updateProductFn,
  removeProduct as removeProductFn,
  toggleStock as toggleStockFn,
  getShopOrders as getShopOrdersFn,
  acceptOrder as acceptOrderFn,
  rejectOrder as rejectOrderFn,
  advanceOrder as advanceOrderFn,
  getAvailablePartners as getAvailablePartnersFn,
  offerToPartner as offerToPartnerFn,
} from "./seller-data/api.functions";

export type SellerOrderStatus =
  "new" | "accepted" | "preparing" | "ready" | "out_for_delivery" | "delivered" | "rejected";

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
  businessType: BusinessType | null;
  badgeTier: BadgeTier;
  verificationStatus: "incomplete" | "pending_review" | "approved" | "suspended";
  logoUrl?: string;
};

export type NewShopInput = {
  name: string;
  businessType: BusinessType;
  area: string;
  tagline?: string;
  lat: number;
  lng: number;
};

/** Whether this account has already created a real shop. */
export async function hasShop(): Promise<boolean> {
  const shop = await getMyShopFn();
  return shop !== null;
}

/** Create a brand-new real shop for this account. Starts empty — no demo products/orders. */
export async function createShop(input: NewShopInput): Promise<ShopProfile> {
  return createShopFn({
    data: {
      name: input.name,
      businessType: input.businessType,
      area: input.area,
      tagline: input.tagline,
      lat: input.lat,
      lng: input.lng,
    },
  }) as unknown as Promise<ShopProfile>;
}

export type UnclaimedShop = { id: string; name: string; addressLine: string; city: string };

/** Search unclaimed (OpenStreetMap-imported) shop listings by name, for the "is this your shop?" claim flow. */
export async function searchUnclaimedShops(query: string): Promise<UnclaimedShop[]> {
  return searchUnclaimedShopsFn({ data: { query } }) as unknown as Promise<UnclaimedShop[]>;
}

/** Real name+proximity duplicate check for the "create a new shop" flow — see seller-data/backend.server.ts. */
export async function findPossibleShopMatches(
  name: string,
  lat: number,
  lng: number,
): Promise<UnclaimedShop[]> {
  return findPossibleShopMatchesFn({ data: { name, lat, lng } }) as unknown as Promise<
    UnclaimedShop[]
  >;
}

/** Claim an unclaimed shop for this account — throws if it was already claimed by someone else. */
export async function claimShop(shopId: string, businessType: BusinessType): Promise<ShopProfile> {
  return claimShopFn({ data: { shopId, businessType } }) as unknown as Promise<ShopProfile>;
}

const MIN = 60 * 1000;

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
  verification: ShopVerification;
  updateVerification: (v: ShopVerification) => void;
  updateShop: (patch: Partial<ShopProfile>) => void;
  addProduct: (p: Omit<Product, "id" | "shopId">) => Promise<void>;
  updateProduct: (id: string, patch: Partial<Product>) => Promise<void>;
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
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const queryClient = useQueryClient();

  const { data: shop } = useQuery({
    queryKey: ["my-shop", userId],
    queryFn: () => getMyShopFn(),
    enabled: Boolean(userId),
  });

  const { data: products = [] } = useQuery({
    queryKey: ["my-products", shop?.id],
    queryFn: () => getMyProductsFn({ data: { shopId: shop!.id } }),
    enabled: Boolean(shop),
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["shop-orders", shop?.id],
    queryFn: () =>
      getShopOrdersFn({ data: { shopId: shop!.id } }) as unknown as Promise<SellerOrder[]>,
    enabled: Boolean(shop),
    // No websocket Realtime yet (see plan/tasks/decisions.md, Phase H) — the
    // browser holds no real Supabase session, so RLS-gated postgres_changes
    // isn't reachable from the anon key. Poll so new customer orders and
    // partner-side status changes show up without a manual refresh.
    refetchInterval: 6000,
  });

  const { data: partners = [] } = useQuery({
    queryKey: ["available-partners"],
    queryFn: () => getAvailablePartnersFn() as unknown as Promise<DeliveryPartner[]>,
    enabled: Boolean(shop),
  });

  // Verification wizard progress is still localStorage (see file header).
  const [verification, setVerification] = useState<ShopVerification | null>(null);
  useEffect(() => {
    if (shop) setVerification(loadVerification(shop.id));
  }, [shop]);

  const invalidateShop = () => queryClient.invalidateQueries({ queryKey: ["my-shop", userId] });
  const invalidateProducts = () =>
    queryClient.invalidateQueries({ queryKey: ["my-products", shop?.id] });
  const invalidateOrders = () =>
    queryClient.invalidateQueries({ queryKey: ["shop-orders", shop?.id] });

  const value = useMemo<SellerContextValue | null>(() => {
    if (!shop || !verification) return null;

    const stats = {
      newCount: orders.filter((o) => o.status === "new").length,
      activeCount: orders.filter((o) => !["new", "delivered", "rejected"].includes(o.status))
        .length,
      deliveredToday: orders.filter((o) => o.status === "delivered" && isToday(o.placedAt)).length,
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
      verification,
      updateVerification: (v) => {
        setVerification(v);
        saveVerification(v);
        const isOpen = v.overallStatus === "approved" ? shop.isOpen : false;
        void updateShopFn({ data: { shopId: shop.id, patch: { isOpen } } }).then(invalidateShop);
        void syncVerificationSummary({
          data: {
            shopId: shop.id,
            summary: {
              businessType: v.businessType,
              badgeTier: v.currentBadge,
              overallStatus: v.overallStatus,
              levels: {
                l1Phone: v.levels.l1_contact.phoneStatus,
                l1Email: v.levels.l1_contact.emailStatus,
                l2Documents: v.levels.l2_documents.status,
                l3Kyc: v.levels.l3_kyc.status,
                l4Bank: v.levels.l4_bank.status,
                l5Gps: v.levels.l5_gps.status,
                l6Ai: v.levels.l6_ai.status,
                l7Review: v.levels.l7_review.status,
              },
            },
          },
        }).then(invalidateShop);
      },
      updateShop: (patch) => {
        void updateShopFn({ data: { shopId: shop.id, patch } }).then(invalidateShop);
      },
      addProduct: async (p) => {
        await addProductFn({ data: { shopId: shop.id, input: p } });
        await invalidateProducts();
      },
      updateProduct: async (id, patch) => {
        await updateProductFn({ data: { productId: id, patch } });
        await invalidateProducts();
      },
      removeProduct: (id) => {
        void removeProductFn({ data: { productId: id } }).then(invalidateProducts);
      },
      toggleStock: (id) => {
        void toggleStockFn({ data: { productId: id } }).then(invalidateProducts);
      },
      acceptOrder: (id) => {
        void acceptOrderFn({ data: { orderId: id } }).then(invalidateOrders);
      },
      rejectOrder: (id) => {
        void rejectOrderFn({ data: { orderId: id } }).then(invalidateOrders);
      },
      advanceOrder: (id) => {
        void advanceOrderFn({ data: { orderId: id } }).then(invalidateOrders);
      },
      assignPartner: (orderId, partnerId) => {
        void offerToPartnerFn({ data: { orderId, partnerId } }).then(invalidateOrders);
      },
      stats,
    };
    // invalidate* helpers intentionally excluded — they're plain closures
    // over queryClient/userId/shop?.id, not memoized; including them would
    // make this useMemo recompute every render, defeating its purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shop, products, orders, partners, verification]);

  if (!value) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading your shop…
      </div>
    );
  }

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
