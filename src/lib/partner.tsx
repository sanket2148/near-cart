// Delivery-partner-side state for NearCart riders. Real DB-backed as of
// Phase E of the backend build-out (src/lib/partner-data/) — PartnerProvider
// keeps exposing the exact same Context shape it always did, so
// partner.index.tsx/partner.deliveries.tsx/partner.earnings.tsx/etc. didn't
// need to change, only the persistence layer underneath did (same approach
// Phase D used for src/lib/seller.tsx).
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./auth";
import {
  getMyProfile as getMyProfileFn,
  createProfile as createProfileFn,
  toggleOnline as toggleOnlineFn,
  getMyJobs as getMyJobsFn,
  acceptJob as acceptJobFn,
  declineJob as declineJobFn,
  advanceJob as advanceJobFn,
} from "./partner-data/api.functions";

export type JobStatus = "new" | "accepted" | "picked_up" | "delivered" | "declined";

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
  id: string;
  name: string;
  phone: string;
  vehicle: string;
  area: string;
  rating: number;
  online: boolean;
  joinedAt: string;
};

export type NewPartnerInput = {
  name: string;
  vehicle: string;
  area: string;
};

/** Whether this account has already registered as a delivery partner. */
export async function hasProfile(): Promise<boolean> {
  const profile = await getMyProfileFn();
  return profile !== null;
}

/** Register a brand-new delivery partner for this account. Starts with zero jobs. */
export async function createProfile(input: NewPartnerInput): Promise<RiderProfile> {
  return createProfileFn({
    data: { name: input.name, vehicle: input.vehicle, area: input.area },
  }) as unknown as Promise<RiderProfile>;
}

const HOUR = 60 * 60 * 1000;
const MIN = 60 * 1000;
const DAY = 24 * HOUR;

// ---- Status helpers (3-stage real flow — see partner-data/backend.server.ts) ----
export const JOB_FLOW: JobStatus[] = ["accepted", "picked_up", "delivered"];

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  new: "New request",
  accepted: "Heading to shop",
  picked_up: "Picked up",
  delivered: "Delivered",
  declined: "Declined",
};

export const JOB_ACTION_LABEL: Record<string, string> = {
  accepted: "Picked up order",
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
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["my-partner-profile", userId],
    queryFn: () => getMyProfileFn(),
    enabled: Boolean(userId),
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ["my-jobs", profile?.id],
    queryFn: () => getMyJobsFn() as unknown as Promise<DeliveryJob[]>,
    enabled: Boolean(profile),
    // See src/lib/seller.tsx — same polling-not-Realtime reasoning, so new
    // job offers show up without the partner manually refreshing.
    refetchInterval: 6000,
  });

  const invalidateProfile = () =>
    queryClient.invalidateQueries({ queryKey: ["my-partner-profile", userId] });
  const invalidateJobs = () =>
    queryClient.invalidateQueries({ queryKey: ["my-jobs", profile?.id] });

  const value = useMemo<PartnerContextValue | null>(() => {
    if (!profile) return null;

    const WEEK = 7 * DAY;
    const now = Date.now();
    const deliveredJobs = jobs.filter((j) => j.status === "delivered");
    const active = jobs.find((j) => ["accepted", "picked_up"].includes(j.status)) ?? null;

    const stats = {
      newCount: jobs.filter((j) => j.status === "new").length,
      activeJob: active,
      deliveredToday: deliveredJobs.filter((j) => isToday(j.completedAt ?? j.assignedAt)).length,
      earningsToday: deliveredJobs
        .filter((j) => isToday(j.completedAt ?? j.assignedAt))
        .reduce((sum, j) => sum + jobEarning(j), 0),
      earningsWeek: deliveredJobs
        .filter((j) => now - (j.completedAt ?? j.assignedAt) < WEEK)
        .reduce((sum, j) => sum + jobEarning(j), 0),
      totalDeliveries: deliveredJobs.length,
      codToCollect: active && active.paymentMethod === "COD" ? active.orderValue : 0,
    };

    return {
      profile,
      jobs,
      updateProfile: () => {
        // Profile edits beyond online/offline aren't wired to the backend
        // yet — no UI currently calls this with anything but online-toggle,
        // which goes through toggleOnline() below instead.
      },
      toggleOnline: () => {
        void toggleOnlineFn().then(invalidateProfile);
      },
      acceptJob: (id) => {
        void acceptJobFn({ data: { assignmentId: id } }).then(invalidateJobs);
      },
      declineJob: (id) => {
        void declineJobFn({ data: { assignmentId: id } }).then(invalidateJobs);
      },
      advanceJob: (id) => {
        void advanceJobFn({ data: { assignmentId: id } }).then(invalidateJobs);
      },
      stats,
    };
  }, [profile, jobs]);

  if (!value) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading your profile…
      </div>
    );
  }

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
