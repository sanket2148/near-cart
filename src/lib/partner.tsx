// Delivery-partner-side state for NearCart riders. Frontend-first, localStorage mock.
// Scoped to a SINGLE rider (the logged-in delivery partner) — only their own jobs.
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type JobStatus =
  | "new"
  | "accepted"
  | "at_shop"
  | "picked_up"
  | "delivered"
  | "declined";

export type DeliveryJob = {
  id: string;
  orderId: string;
  shopName: string;
  shopEmoji: string;
  shopAddress: string;
  customerName: string;
  customerAddress: string;
  customerPhone: string;
  itemCount: number;
  orderValue: number;
  paymentMethod: "UPI" | "COD";
  distanceKm: number;
  payout: number;
  tip?: number;
  assignedAt: number;
  completedAt?: number;
  status: JobStatus;
};

export type RiderProfile = {
  name: string;
  phone: string;
  vehicle: string;
  area: string;
  rating: number;
  online: boolean;
  joinedAt: string;
};

const HOUR = 60 * 60 * 1000;
const MIN = 60 * 1000;
const DAY = 24 * HOUR;

function seedProfile(): RiderProfile {
  return {
    name: "Arjun Kumar",
    phone: "+91 90000 11111",
    vehicle: "Bike",
    area: "Koramangala",
    rating: 4.8,
    online: true,
    joinedAt: "Jan 2025",
  };
}

function seedJobs(): DeliveryJob[] {
  const now = Date.now();
  return [
    {
      id: "dj1",
      orderId: "NC50231881",
      shopName: "Ramesh Stores",
      shopEmoji: "🏪",
      shopAddress: "Shop 4, 5th Block Main Road, Koramangala",
      customerName: "Priya Sharma",
      customerAddress: "402, Lake View Apartments, Koramangala 5th Block",
      customerPhone: "+91 98800 12345",
      itemCount: 4,
      orderValue: 376,
      paymentMethod: "UPI",
      distanceKm: 1.2,
      payout: 35,
      assignedAt: now - 2 * MIN,
      status: "new",
    },
    {
      id: "dj2",
      orderId: "NC50231840",
      shopName: "Daily Fresh Bakery",
      shopEmoji: "🥐",
      shopAddress: "21, 80 Feet Road, Koramangala 4th Block",
      customerName: "Rahul Verma",
      customerAddress: "12, MG Road, Near Forum Mall",
      customerPhone: "+91 98800 67890",
      itemCount: 2,
      orderValue: 204,
      paymentMethod: "COD",
      distanceKm: 2.4,
      payout: 48,
      assignedAt: now - 6 * MIN,
      status: "new",
    },
    {
      id: "dj3",
      orderId: "NC50231411",
      shopName: "Ramesh Stores",
      shopEmoji: "🏪",
      shopAddress: "Shop 4, 5th Block Main Road, Koramangala",
      customerName: "Vikram Singh",
      customerAddress: "5, Rose Garden Road, Koramangala 6th Block",
      customerPhone: "+91 98800 13579",
      itemCount: 1,
      orderValue: 280,
      paymentMethod: "COD",
      distanceKm: 0.9,
      payout: 30,
      assignedAt: now - 35 * MIN,
      status: "picked_up",
    },
    {
      id: "dj4",
      orderId: "NC50230988",
      shopName: "Wellness Pharmacy",
      shopEmoji: "💊",
      shopAddress: "8, Jyoti Nivas College Road",
      customerName: "Meena Iyer",
      customerAddress: "23, Silver Heights, Koramangala 4th Block",
      customerPhone: "+91 98800 11223",
      itemCount: 3,
      orderValue: 196,
      paymentMethod: "UPI",
      distanceKm: 1.8,
      payout: 40,
      tip: 10,
      assignedAt: now - 3 * HOUR,
      completedAt: now - 2.4 * HOUR,
      status: "delivered",
    },
    {
      id: "dj5",
      orderId: "NC50230721",
      shopName: "Daily Fresh Bakery",
      shopEmoji: "🥐",
      shopAddress: "21, 80 Feet Road, Koramangala 4th Block",
      customerName: "Anita Desai",
      customerAddress: "78, Jyoti Nagar, Koramangala 1st Block",
      customerPhone: "+91 98800 24680",
      itemCount: 2,
      orderValue: 440,
      paymentMethod: "UPI",
      distanceKm: 2.1,
      payout: 45,
      assignedAt: now - 5 * HOUR,
      completedAt: now - 4.5 * HOUR,
      status: "delivered",
    },
    {
      id: "dj6",
      orderId: "NC50229954",
      shopName: "Ramesh Stores",
      shopEmoji: "🏪",
      shopAddress: "Shop 4, 5th Block Main Road, Koramangala",
      customerName: "Karan Mehta",
      customerAddress: "31, Sunshine Residency, Koramangala 7th Block",
      customerPhone: "+91 98800 55667",
      itemCount: 5,
      orderValue: 612,
      paymentMethod: "UPI",
      distanceKm: 1.5,
      payout: 38,
      tip: 15,
      assignedAt: now - DAY - 2 * HOUR,
      completedAt: now - DAY - 1.5 * HOUR,
      status: "delivered",
    },
    {
      id: "dj7",
      orderId: "NC50229410",
      shopName: "Wellness Pharmacy",
      shopEmoji: "💊",
      shopAddress: "8, Jyoti Nivas College Road",
      customerName: "Sneha Rao",
      customerAddress: "9, Green Park Layout, Koramangala 3rd Block",
      customerPhone: "+91 98800 99887",
      itemCount: 1,
      orderValue: 145,
      paymentMethod: "COD",
      distanceKm: 2.8,
      payout: 52,
      assignedAt: now - 2 * DAY,
      completedAt: now - 2 * DAY + 30 * MIN,
      status: "delivered",
    },
  ];
}

// ---- Persistence ----
const KEYS = {
  profile: "nearcart-partner-profile",
  jobs: "nearcart-partner-jobs",
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
export const JOB_FLOW: JobStatus[] = ["accepted", "at_shop", "picked_up", "delivered"];

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  new: "New request",
  accepted: "Heading to shop",
  at_shop: "At shop",
  picked_up: "Picked up",
  delivered: "Delivered",
  declined: "Declined",
};

export const JOB_ACTION_LABEL: Record<string, string> = {
  accepted: "Reached the shop",
  at_shop: "Picked up order",
  picked_up: "Delivered to customer",
};

export function nextJobStatus(status: JobStatus): JobStatus | null {
  const i = JOB_FLOW.indexOf(status);
  if (i === -1 || i === JOB_FLOW.length - 1) return null;
  return JOB_FLOW[i + 1];
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

export function jobEarning(j: DeliveryJob): number {
  return j.payout + (j.tip ?? 0);
}

// ---- Context ----
type PartnerContextValue = {
  profile: RiderProfile;
  jobs: DeliveryJob[];
  updateProfile: (patch: Partial<RiderProfile>) => void;
  toggleOnline: () => void;
  acceptJob: (id: string) => void;
  declineJob: (id: string) => void;
  advanceJob: (id: string) => void;
  stats: {
    newCount: number;
    activeJob: DeliveryJob | null;
    deliveredToday: number;
    earningsToday: number;
    earningsWeek: number;
    totalDeliveries: number;
    codToCollect: number;
  };
};

const PartnerContext = createContext<PartnerContextValue | null>(null);

export function PartnerProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<RiderProfile>(seedProfile);
  const [jobs, setJobs] = useState<DeliveryJob[]>(seedJobs);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage after mount (avoids SSR mismatch).
  useEffect(() => {
    setProfile(load(KEYS.profile, seedProfile()));
    setJobs(load(KEYS.jobs, seedJobs()));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) save(KEYS.profile, profile);
  }, [profile, hydrated]);
  useEffect(() => {
    if (hydrated) save(KEYS.jobs, jobs);
  }, [jobs, hydrated]);

  const value = useMemo<PartnerContextValue>(() => {
    const WEEK = 7 * DAY;
    const now = Date.now();
    const deliveredJobs = jobs.filter((j) => j.status === "delivered");
    const active =
      jobs.find((j) => ["accepted", "at_shop", "picked_up"].includes(j.status)) ?? null;

    const stats = {
      newCount: jobs.filter((j) => j.status === "new").length,
      activeJob: active,
      deliveredToday: deliveredJobs.filter((j) => isToday(j.completedAt ?? j.assignedAt))
        .length,
      earningsToday: deliveredJobs
        .filter((j) => isToday(j.completedAt ?? j.assignedAt))
        .reduce((sum, j) => sum + jobEarning(j), 0),
      earningsWeek: deliveredJobs
        .filter((j) => now - (j.completedAt ?? j.assignedAt) < WEEK)
        .reduce((sum, j) => sum + jobEarning(j), 0),
      totalDeliveries: deliveredJobs.length,
      codToCollect:
        active && active.paymentMethod === "COD" ? active.orderValue : 0,
    };

    const updateJob = (id: string, patch: Partial<DeliveryJob>) =>
      setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)));

    return {
      profile,
      jobs,
      updateProfile: (patch) => setProfile((p) => ({ ...p, ...patch })),
      toggleOnline: () => setProfile((p) => ({ ...p, online: !p.online })),
      acceptJob: (id) => updateJob(id, { status: "accepted" }),
      declineJob: (id) => updateJob(id, { status: "declined" }),
      advanceJob: (id) =>
        setJobs((prev) =>
          prev.map((j) => {
            if (j.id !== id) return j;
            const next = j.status === "new" ? "accepted" : nextJobStatus(j.status);
            if (!next) return j;
            return {
              ...j,
              status: next,
              completedAt: next === "delivered" ? Date.now() : j.completedAt,
            };
          }),
        ),
      stats,
    };
  }, [profile, jobs]);

  return <PartnerContext.Provider value={value}>{children}</PartnerContext.Provider>;
}

export function usePartner(): PartnerContextValue {
  const ctx = useContext(PartnerContext);
  if (!ctx) throw new Error("usePartner must be used within PartnerProvider");
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
