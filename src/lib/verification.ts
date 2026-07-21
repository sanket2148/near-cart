// Verification state management for NearCart seller onboarding.
// Tracks multi-level verification (L1–L8) with badge progression,
// document uploads, and localStorage persistence.

// ─── Types ───────────────────────────────────────────────────────────────────

export type BusinessType =
  | "restaurant"
  | "pharmacy"
  | "grocery"
  | "retail"
  | "salon"
  | "electronics"
  | "bakery"
  | "home_business";

export type BadgeTier = "none" | "basic" | "verified" | "premium" | "trusted";

export type LevelStatus = "not_started" | "in_progress" | "submitted" | "verified" | "rejected";

export type RiskTier = "low" | "medium" | "high";

export type DocumentType =
  | "gst"
  | "fssai"
  | "pan"
  | "aadhaar"
  | "drug_license"
  | "trade_license"
  | "udyam"
  | "shop_establishment"
  | "vehicle_rc"
  | "pharmacist_reg";

/** Final decision returned by the server-side verification pipeline. */
export type VerificationDecision = "VERIFIED" | "UNDER_REVIEW" | "REJECTED";

/** Business details extracted from a document via OCR. */
export type ExtractedFields = {
  businessName?: string;
  ownerName?: string;
  licenseNumber?: string;
  registrationNumber?: string;
  address?: string;
  documentType?: string;
  expiryDate?: string;
};

/** Registration form details a document is compared against. */
export type VerificationForm = {
  businessName?: string;
  ownerName?: string;
  address?: string;
  businessType?: string;
};

/**
 * Rich result produced by the merchant-verification backend for a single
 * uploaded file (document or photo). Persisted server-side and mirrored here
 * so the UI can render OCR results, match scores and the confidence decision.
 */
export type FileAnalysis = {
  docId: string;
  category: "document" | "photo";
  docType: string;
  fileName: string;
  filePath: string;
  sha256: string;
  sizeBytes: number;
  mimeType: string;
  /** 0–1 overall confidence score. */
  confidence: number;
  decision: VerificationDecision;
  qualityScore: number;
  authenticityScore: number;
  matchScore: number;
  duplicate: boolean;
  ocrText: string;
  extractedFields: ExtractedFields;
  matchDetails: Record<string, number>;
  issues: string[];
  createdAt: number;
  /**
   * Real government-registry cross-check (GSTN/FoSCoS via Deepvue) for
   * gst/fssai/pan documents — a materially stronger signal than the OCR
   * quality/authenticity scores above, since it confirms the number ON the
   * document actually exists and is active, not just that the image looks
   * plausible. Absent when doc-verify isn't configured (true today) or the
   * doc type isn't one of the three currently supported — see
   * src/lib/doc-verify/backend.server.ts.
   */
  registryCheck?: {
    verified: boolean;
    status: string | null;
    registryName: string | null;
    nameMatchScore: number | null;
  };
};

export type DocumentUpload = {
  id: string;
  docType: DocumentType;
  fileName: string;
  status: LevelStatus;
  uploadedAt: number;
  rejectionReason?: string;
  filePath?: string;
  analysis?: FileAnalysis;
};

export type ShopPhoto = {
  id: string;
  type: "front" | "interior" | "board" | "selfie";
  fileName: string;
  uploadedAt: number;
  filePath?: string;
  analysis?: FileAnalysis;
};

export type ShopVerification = {
  shopId: string;
  /** Stable id used to key backend verification records + uploaded files. */
  merchantRef: string;
  businessType: BusinessType | null;
  currentBadge: BadgeTier;
  levels: {
    l1_contact: {
      phoneStatus: LevelStatus;
      emailStatus: LevelStatus;
      phoneNumber: string;
      emailAddress: string;
      phoneVerifiedAt?: number;
      emailVerifiedAt?: number;
    };
    l2_documents: {
      status: LevelStatus;
      documents: DocumentUpload[];
    };
    l3_kyc: {
      status: LevelStatus;
      panNumber: string;
      panName: string;
      aadhaarLast4: string;
    };
    l4_bank: {
      status: LevelStatus;
      accountNumber: string;
      ifsc: string;
      accountHolderName: string;
      pennyDropVerified: boolean;
    };
    l5_gps: {
      status: LevelStatus;
      lat: number | null;
      lng: number | null;
      photos: ShopPhoto[];
      capturedAt?: number;
    };
    l6_ai: { status: LevelStatus };
    l7_review: { status: LevelStatus; notes: string };
    l8_customer: { status: LevelStatus };
  };
  overallStatus: "incomplete" | "pending_review" | "approved" | "suspended";
  flagged: boolean;
  flagReasons: string[];
  currentStep: number;
  createdAt: number;
  updatedAt: number;
};

// ─── Constants ───────────────────────────────────────────────────────────────

/** Per-business-type configuration: required / optional docs, risk, display. */
export const BUSINESS_TYPE_CONFIG: Record<
  BusinessType,
  {
    label: string;
    emoji: string;
    riskTier: RiskTier;
    requiredDocs: DocumentType[];
    optionalDocs: DocumentType[];
    description: string;
  }
> = {
  restaurant: {
    label: "Restaurant",
    emoji: "🍽️",
    riskTier: "medium",
    requiredDocs: ["fssai"],
    optionalDocs: ["gst", "shop_establishment"],
    description: "Dine-in, takeaway, or cloud kitchen",
  },
  pharmacy: {
    label: "Pharmacy",
    emoji: "💊",
    riskTier: "high",
    requiredDocs: ["drug_license", "pharmacist_reg"],
    optionalDocs: ["gst"],
    description: "Licensed medicine and healthcare store",
  },
  grocery: {
    label: "Grocery",
    emoji: "🛒",
    riskTier: "low",
    requiredDocs: [],
    optionalDocs: ["gst", "shop_establishment"],
    description: "Daily essentials and grocery items",
  },
  retail: {
    label: "Retail",
    emoji: "🏪",
    riskTier: "low",
    requiredDocs: [],
    optionalDocs: ["gst", "trade_license"],
    description: "General merchandise and retail goods",
  },
  salon: {
    label: "Salon",
    emoji: "💇",
    riskTier: "low",
    requiredDocs: [],
    optionalDocs: ["trade_license"],
    description: "Beauty, grooming, and personal care services",
  },
  electronics: {
    label: "Electronics",
    emoji: "🔌",
    riskTier: "medium",
    requiredDocs: ["gst"],
    optionalDocs: ["shop_establishment"],
    description: "Electronics, gadgets, and accessories",
  },
  bakery: {
    label: "Bakery",
    emoji: "🥐",
    riskTier: "medium",
    requiredDocs: ["fssai"],
    optionalDocs: ["shop_establishment"],
    description: "Freshly baked goods and confectionery",
  },
  home_business: {
    label: "Home Business",
    emoji: "🏠",
    riskTier: "low",
    requiredDocs: ["aadhaar", "pan"],
    optionalDocs: [],
    description: "Home-based small business or cottage industry",
  },
};

/** Human-readable labels for each document type. */
export const DOC_TYPE_LABELS: Record<DocumentType, string> = {
  gst: "GST Certificate",
  fssai: "FSSAI License",
  pan: "PAN Card",
  aadhaar: "Aadhaar Card",
  drug_license: "Drug License",
  trade_license: "Trade License",
  udyam: "Udyam Registration",
  shop_establishment: "Shop & Establishment Certificate",
  vehicle_rc: "Vehicle RC",
  pharmacist_reg: "Pharmacist Registration",
};

/** Badge tier display configuration. */
export const BADGE_CONFIG: Record<
  BadgeTier,
  { label: string; color: string; iconDescription: string; description: string }
> = {
  none: {
    label: "Not Verified",
    color: "text-muted-foreground bg-muted",
    iconDescription: "Empty circle",
    description: "Complete verification to earn your first badge",
  },
  basic: {
    label: "Basic",
    color: "text-green-700 bg-green-100",
    iconDescription: "Green check circle",
    description: "Phone and email verified",
  },
  verified: {
    label: "Verified",
    color: "text-amber-700 bg-amber-100",
    iconDescription: "Amber shield with check",
    description: "Documents and bank account verified",
  },
  premium: {
    label: "Premium Verified",
    color: "text-blue-700 bg-blue-100",
    iconDescription: "Blue star badge",
    description: "GPS-verified location with no flags",
  },
  trusted: {
    label: "Trusted Seller",
    color: "text-amber-800 bg-gradient-to-r from-amber-100 to-yellow-100",
    iconDescription: "Gold crown badge",
    description: "Top-tier seller with excellent customer metrics",
  },
};

/** Wizard step definitions (steps 1–7 map to verification levels). */
export const VERIFICATION_STEPS: {
  id: number;
  title: string;
  description: string;
  levelKey: string;
}[] = [
  {
    id: 1,
    title: "Contact Verification",
    description: "Verify your phone number and email address",
    levelKey: "l1_contact",
  },
  {
    id: 2,
    title: "Business Documents",
    description: "Upload required licenses and registrations",
    levelKey: "l2_documents",
  },
  {
    id: 3,
    title: "KYC Verification",
    description: "Verify your PAN and Aadhaar details",
    levelKey: "l3_kyc",
  },
  {
    id: 4,
    title: "Bank Account",
    description: "Add and verify your bank account for payouts",
    levelKey: "l4_bank",
  },
  {
    id: 5,
    title: "Location & Photos",
    description: "Confirm your shop location and upload photos",
    levelKey: "l5_gps",
  },
  {
    id: 6,
    title: "AI Review",
    description: "Automated checks on your submitted information",
    levelKey: "l6_ai",
  },
  {
    id: 7,
    title: "Final Review",
    description: "Manual review by the NearCart trust team",
    levelKey: "l7_review",
  },
];

// ─── Functions ───────────────────────────────────────────────────────────────

/** Create a blank verification state for a new shop. */
/** Read a File as base64 (without the `data:...;base64,` prefix) for upload to the server. */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

/** Generate a stable merchant reference id (used to key backend records). */
export function genMerchantRef(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return `mr_${crypto.randomUUID()}`;
    }
  } catch {
    /* fall through */
  }
  return `mr_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export function createEmptyVerification(shopId: string): ShopVerification {
  const now = Date.now();
  return {
    shopId,
    merchantRef: genMerchantRef(),
    businessType: null,
    currentBadge: "none",
    levels: {
      l1_contact: {
        phoneStatus: "not_started",
        emailStatus: "not_started",
        phoneNumber: "",
        emailAddress: "",
      },
      l2_documents: {
        status: "not_started",
        documents: [],
      },
      l3_kyc: {
        status: "not_started",
        panNumber: "",
        panName: "",
        aadhaarLast4: "",
      },
      l4_bank: {
        status: "not_started",
        accountNumber: "",
        ifsc: "",
        accountHolderName: "",
        pennyDropVerified: false,
      },
      l5_gps: {
        status: "not_started",
        lat: null,
        lng: null,
        photos: [],
      },
      l6_ai: { status: "not_started" },
      l7_review: { status: "not_started", notes: "" },
      l8_customer: { status: "not_started" },
    },
    overallStatus: "incomplete",
    flagged: false,
    flagReasons: [],
    currentStep: 1,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Compute the badge tier a shop has earned based on its verification state.
 *
 * Progression:
 *   none    → nothing completed
 *   basic   → L1 phone AND email both verified
 *   verified → basic + L2 docs verified + L4 bank verified
 *   premium  → verified + L5 GPS verified + no flags
 *   trusted  → premium + L8 customer metrics verified
 */
export function computeBadgeTier(v: ShopVerification): BadgeTier {
  const { levels, flagged } = v;

  // L1: both phone and email must be verified
  const l1Done =
    levels.l1_contact.phoneStatus === "verified" && levels.l1_contact.emailStatus === "verified";
  if (!l1Done) return "none";

  // L2 + L4: documents and bank verified
  const l2Done = levels.l2_documents.status === "verified";
  const l4Done = levels.l4_bank.status === "verified";
  if (!l2Done || !l4Done) return "basic";

  // L5: GPS verified + no flags
  const l5Done = levels.l5_gps.status === "verified";
  if (!l5Done || flagged) return "verified";

  // L8: customer metrics verified
  const l8Done = levels.l8_customer.status === "verified";
  if (!l8Done) return "premium";

  return "trusted";
}

/** Count how many of the 8 verification levels have status 'verified'. */
export function getCompletedLevelCount(v: ShopVerification): number {
  const { levels } = v;
  let count = 0;

  // L1 counts as verified only when BOTH phone and email are verified
  if (
    levels.l1_contact.phoneStatus === "verified" &&
    levels.l1_contact.emailStatus === "verified"
  ) {
    count++;
  }

  // L2–L8 each have a single status field
  const singleStatusLevels = [
    levels.l2_documents,
    levels.l3_kyc,
    levels.l4_bank,
    levels.l5_gps,
    levels.l6_ai,
    levels.l7_review,
    levels.l8_customer,
  ] as const;

  for (const level of singleStatusLevels) {
    if (level.status === "verified") count++;
  }

  return count;
}

/** Total number of verification levels (L1–L8). */
export function getTotalLevelCount(): number {
  return 8;
}

/**
 * Get the step number (1–7) of the first incomplete wizard step.
 * Returns the step after the last completed one, or 1 if none are done.
 */
export function getNextIncompleteStep(v: ShopVerification): number {
  for (const step of VERIFICATION_STEPS) {
    if (!isStepComplete(v, step.id)) return step.id;
  }
  // All steps complete — return the last step
  return VERIFICATION_STEPS.length;
}

/** Get the required document types for a given business type. */
export function getRequiredDocsForType(type: BusinessType): DocumentType[] {
  return BUSINESS_TYPE_CONFIG[type].requiredDocs;
}

/**
 * Check whether a specific wizard step (1–7) is complete.
 * Each step maps to a verification level; completion requires 'verified' status.
 */
export function isStepComplete(v: ShopVerification, step: number): boolean {
  const { levels } = v;

  switch (step) {
    case 1:
      // L1: both phone and email must be verified
      return (
        levels.l1_contact.phoneStatus === "verified" && levels.l1_contact.emailStatus === "verified"
      );
    case 2:
      return levels.l2_documents.status === "verified";
    case 3:
      return levels.l3_kyc.status === "verified";
    case 4:
      return levels.l4_bank.status === "verified";
    case 5:
      return levels.l5_gps.status === "verified";
    case 6:
      return levels.l6_ai.status === "verified";
    case 7:
      return levels.l7_review.status === "verified";
    default:
      return false;
  }
}

// ─── localStorage Persistence ────────────────────────────────────────────────
// Keyed per-shop so multiple real shops (different logged-in sellers) can
// each keep their own verification progress instead of sharing one record.

const VERIFICATION_KEY_PREFIX = "nearcart-verification-";

export function verificationStorageKey(shopId: string): string {
  return `${VERIFICATION_KEY_PREFIX}${shopId}`;
}

/**
 * Load verification state for a shop from localStorage.
 * Returns a fresh empty state if nothing is stored or on parse error.
 */
export function loadVerification(shopId: string): ShopVerification {
  try {
    if (typeof window === "undefined") return createEmptyVerification(shopId);
    const raw = localStorage.getItem(verificationStorageKey(shopId));
    if (!raw) return createEmptyVerification(shopId);
    const parsed = JSON.parse(raw) as ShopVerification;
    // Make sure the stored data is for this shop
    if (parsed.shopId !== shopId) return createEmptyVerification(shopId);
    // Backfill merchantRef for states saved before backend integration.
    if (!parsed.merchantRef) parsed.merchantRef = genMerchantRef();
    
    // Deep merge / backfill with createEmptyVerification to prevent rendering crashes due to old schema
    const empty = createEmptyVerification(shopId);
    const merged: ShopVerification = {
      ...empty,
      ...parsed,
      levels: {
        ...empty.levels,
        ...(parsed.levels || {}),
        l1_contact: {
          ...empty.levels.l1_contact,
          ...((parsed.levels?.l1_contact) || {}),
        },
        l2_documents: {
          ...empty.levels.l2_documents,
          ...((parsed.levels?.l2_documents) || {}),
        },
        l3_kyc: {
          ...empty.levels.l3_kyc,
          ...((parsed.levels?.l3_kyc) || {}),
        },
        l4_bank: {
          ...empty.levels.l4_bank,
          ...((parsed.levels?.l4_bank) || {}),
        },
        l5_gps: {
          ...empty.levels.l5_gps,
          ...((parsed.levels?.l5_gps) || {}),
        },
        l6_ai: {
          ...empty.levels.l6_ai,
          ...((parsed.levels?.l6_ai) || {}),
        },
        l7_review: {
          ...empty.levels.l7_review,
          ...((parsed.levels?.l7_review) || {}),
        },
        l8_customer: {
          ...empty.levels.l8_customer,
          ...((parsed.levels?.l8_customer) || {}),
        },
      },
    };
    return merged;
  } catch {
    return createEmptyVerification(shopId);
  }
}

/** Persist verification state to localStorage. */
export function saveVerification(v: ShopVerification): void {
  try {
    if (typeof window === "undefined") return;
    localStorage.setItem(verificationStorageKey(v.shopId), JSON.stringify(v));
  } catch {
    /* ignore — quota exceeded or private browsing */
  }
}

/** All real shops' verification records currently in localStorage (for the admin queue). */
export function listAllVerifications(): ShopVerification[] {
  try {
    if (typeof window === "undefined") return [];
    const results: ShopVerification[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(VERIFICATION_KEY_PREFIX)) continue;
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw) as ShopVerification;
        if (parsed?.shopId) results.push(parsed);
      } catch {
        /* skip corrupt entry */
      }
    }
    return results;
  } catch {
    return [];
  }
}
