// Server-only real business-document REGISTRY verification (Deepvue).
// SCAFFOLDED, NOT LIVE — no Deepvue account/keys exist yet (see
// plan/tasks/decisions.md). isConfigured() gates every call; when false
// (true today), verification/backend.server.ts's analyzeFile() keeps
// working exactly as it does now — AI-vision OCR only, no registry
// cross-check. Adding DEEPVUE_CLIENT_ID/DEEPVUE_CLIENT_SECRET to .env
// activates it, no further code changes needed.
//
// This is a materially different, stronger signal than the existing
// AI-vision pipeline: vision.ts's analyzeFile() only judges whether an
// uploaded image LOOKS like a real GST/FSSAI certificate (quality, OCR
// legibility, "does this look like a template"). It has no way to know
// whether the GSTIN/FSSAI number ON that document actually exists and is
// active in the real government registry. This module answers that
// question directly, via Deepvue's KYB APIs (which read from GSTN/FoSCoS
// data).
//
// UNVERIFIED against a live account — every request/response shape below
// is transcribed from Deepvue's own published docs (docs.deepvue.ai),
// not exercised against a real sandbox key. Same honest caveat as the
// Razorpay scaffold (src/lib/payments/backend.server.ts).

const BASE_URL = "https://production.deepvue.tech";

function credentials(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.DEEPVUE_CLIENT_ID;
  const clientSecret = process.env.DEEPVUE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function isConfigured(): boolean {
  return credentials() !== null;
}

// Deepvue access tokens are valid 24h — cache in module scope rather than
// re-authenticating on every verification call. Refreshed 5 min early.
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  const creds = credentials();
  if (!creds) throw new Error("Document verification not configured (DEEPVUE_CLIENT_ID/DEEPVUE_CLIENT_SECRET missing).");
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.token;

  const res = await fetch(`${BASE_URL}/v1/authorize`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: creds.clientId, client_secret: creds.clientSecret }),
  });
  if (!res.ok) throw new Error(`Deepvue authorize failed (${res.status}): ${(await res.text()).slice(0, 300)}`);

  const json = (await res.json()) as { access_token?: string; token?: string };
  const token = json.access_token ?? json.token;
  if (!token) throw new Error("Deepvue authorize: no token in response");

  cachedToken = { token, expiresAt: Date.now() + 23.5 * 60 * 60 * 1000 };
  return token;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function deepvueGet(path: string, params: Record<string, string>): Promise<any> {
  const creds = credentials();
  if (!creds) throw new Error("Document verification not configured.");
  const token = await getAccessToken();

  const url = new URL(`${BASE_URL}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "x-api-key": creds.clientSecret },
  });
  if (!res.ok) throw new Error(`Deepvue request failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

export type RegistryCheck = {
  verified: boolean;
  status: string | null;
  registryName: string | null;
  /** Dice-coefficient similarity (0..1) between the registry's name and the caller-supplied expected name, or null if either is missing. */
  nameMatchScore: number | null;
};

function nameSimilarity(a?: string | null, b?: string | null): number | null {
  if (!a || !b) return null;
  const tokens = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(" ").filter(Boolean));
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return null;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return Number(((2 * inter) / (ta.size + tb.size)).toFixed(2));
}

/** GSTIN format: 15 chars — 2-digit state code, 10-char PAN, entity code, 'Z', checksum. */
export const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z][A-Z\d]$/;
/** FSSAI license/registration numbers are 14 digits. */
export const FSSAI_PATTERN = /^\d{14}$/;
/** PAN format: 5 letters, 4 digits, 1 letter. */
export const PAN_PATTERN = /^[A-Z]{5}\d{4}[A-Z]$/;

export async function verifyGst(gstin: string, expectedName?: string): Promise<RegistryCheck> {
  const json = await deepvueGet("/v1/verification/gstinlite", { gstin_number: gstin });
  const data = json.data ?? {};
  const registryName: string | null = data.lgnm ?? data.tradeNam ?? null;
  return {
    verified: data.sts === "Active",
    status: data.sts ?? null,
    registryName,
    nameMatchScore: nameSimilarity(registryName, expectedName),
  };
}

export async function verifyFssai(fssaiNumber: string, expectedName?: string): Promise<RegistryCheck> {
  const json = await deepvueGet("/v1/business-compliance/fssai-verification", { fssai_id: fssaiNumber });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const detail = (json.data?.details ?? [])[0] as any;
  const registryName: string | null = detail?.company_name ?? null;
  return {
    verified: json.sub_code === "SUCCESS" && Boolean(detail),
    status: detail?.status_desc ?? null,
    registryName,
    nameMatchScore: nameSimilarity(registryName, expectedName),
  };
}

export async function verifyPan(panNumber: string, expectedName?: string): Promise<RegistryCheck> {
  const json = await deepvueGet("/v1/verification/panbasic", { pan_number: panNumber });
  const data = json.data ?? {};
  const registryName: string | null = data.full_name ?? null;
  return {
    verified: data.status === "VALID",
    status: data.status ?? null,
    registryName,
    nameMatchScore: nameSimilarity(registryName, expectedName),
  };
}

/** Picks whichever OCR-extracted field looks like a plausible number for the given doc type. */
export function pickRegistryNumber(
  docType: string,
  extractedFields: { licenseNumber?: string; registrationNumber?: string },
): string | null {
  const candidates = [extractedFields.registrationNumber, extractedFields.licenseNumber]
    .filter((v): v is string => Boolean(v))
    .map((v) => v.replace(/\s+/g, "").toUpperCase());

  if (docType === "gst") return candidates.find((c) => GSTIN_PATTERN.test(c)) ?? null;
  if (docType === "fssai") return candidates.find((c) => FSSAI_PATTERN.test(c)) ?? null;
  if (docType === "pan") return candidates.find((c) => PAN_PATTERN.test(c)) ?? null;
  return null;
}

/** Doc types this module can currently registry-check. Aadhaar/Udyam/drug_license/etc. are not wired up — see backlog.md. */
export function isSupportedDocType(docType: string): docType is "gst" | "fssai" | "pan" {
  return docType === "gst" || docType === "fssai" || docType === "pan";
}

export async function verifyByDocType(docType: "gst" | "fssai" | "pan", number: string, expectedName?: string): Promise<RegistryCheck> {
  if (docType === "gst") return verifyGst(number, expectedName);
  if (docType === "fssai") return verifyFssai(number, expectedName);
  return verifyPan(number, expectedName);
}

/**
 * A GSTIN's middle 10 characters ARE the PAN of the registered entity — not
 * a coincidence, the format is defined that way (2-digit state code, then
 * the 10-char PAN, then entity/checksum digits — see GSTIN_PATTERN above).
 * Extracting and comparing it against a separately uploaded PAN document is
 * a real fraud check that needs no external API/registry call at all: it
 * only needs both numbers to have been OCR-read correctly. Someone who
 * found or photographed a real shop's GST certificate but isn't actually
 * its owner would need a matching real PAN document in the same identity
 * too, not just the ability to re-upload a copied image of one document.
 */
export function panFromGstin(gstin: string): string | null {
  const clean = gstin.replace(/\s+/g, "").toUpperCase();
  return GSTIN_PATTERN.test(clean) ? clean.slice(2, 12) : null;
}

export type GstPanCrossCheck = {
  matched: boolean;
  gstinPan: string;
  documentPan: string;
};

/** Returns null (not "no cross-check possible" vs "mismatch") when either number doesn't even look like a real GSTIN/PAN — the caller decides what that means. */
export function crossCheckGstPan(gstin: string, panNumber: string): GstPanCrossCheck | null {
  const embedded = panFromGstin(gstin);
  const clean = panNumber.replace(/\s+/g, "").toUpperCase();
  if (!embedded || !PAN_PATTERN.test(clean)) return null;
  return { matched: embedded === clean, gstinPan: embedded, documentPan: clean };
}
