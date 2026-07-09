// Server-only merchant-verification pipeline.
//
// This module is the backend for the seller verification flow. It runs the
// full document/image verification pipeline: validation, SHA-256 duplicate
// detection, OCR + business-detail extraction + image-quality + authenticity
// checks (via Lovable AI vision), comparison against the registration form,
// a weighted confidence score, and a VERIFIED / UNDER_REVIEW / REJECTED
// decision. Files are stored in a PRIVATE Supabase Storage bucket and every
// action is written to an append-only audit trail (the `events` table).
//
// The `.server.ts` suffix keeps this out of the client bundle. It is loaded
// via `await import(...)` inside server-function handlers.
//
// EXTENSIBILITY: `analyzeFile` is intentionally structured as discrete
// stages. To add government-API checks (GST/FSSAI/PAN validation) or a
// human manual-review queue later, add a stage that writes an
// `mv.audit` / `mv.gov_check` event and folds its score into `decide()`.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import type {
  ExtractedFields,
  FileAnalysis,
  VerificationDecision,
  VerificationForm,
} from "@/lib/verification";

const BUCKET = "merchant-verification";
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const OCR_MODEL = "google/gemini-2.5-flash";

// ─── Supabase admin (service role) ──────────────────────────────────────────

let _admin: SupabaseClient | null = null;

function admin(): SupabaseClient {
  if (_admin) return _admin;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Verification backend not configured: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing.",
    );
  }
  _admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _admin;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function genDocId(): string {
  return `doc_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function extFromMime(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "application/pdf":
      return "pdf";
    default:
      return "bin";
  }
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function parseJsonLoose(raw: string): Record<string, unknown> {
  if (!raw) return {};
  const cleaned = raw
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Try to locate the first {...} block.
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        /* ignore */
      }
    }
    return {};
  }
}

// ─── Text similarity (for form comparison) ──────────────────────────────────

function tokens(s?: string): string[] {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((t) => t.length > 1);
}

/** Dice coefficient over token sets — robust to word order and extra tokens. */
function similarity(a?: string, b?: string): number {
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return (2 * inter) / (ta.size + tb.size);
}

function compareWithForm(
  extracted: ExtractedFields,
  form: VerificationForm,
): { matchScore: number; details: Record<string, number> } {
  const details: Record<string, number> = {};
  const pairs: [string, string | undefined, string | undefined][] = [
    ["businessName", extracted.businessName, form.businessName],
    ["ownerName", extracted.ownerName, form.ownerName],
    ["address", extracted.address, form.address],
  ];
  const scores: number[] = [];
  for (const [key, ex, fm] of pairs) {
    if (!fm) continue; // nothing on the form to compare against
    const s = similarity(ex, fm);
    details[key] = Number(s.toFixed(2));
    scores.push(s);
  }
  if (scores.length === 0) return { matchScore: 0.5, details }; // neutral when no form data
  const matchScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  return { matchScore, details };
}

// ─── AI vision: OCR + extraction + quality + authenticity ───────────────────

type VisionResult = {
  ocrText: string;
  extractedFields: ExtractedFields;
  quality: { score: number; legible: boolean; blurry: boolean; issues: string[] };
  authenticity: { looksGenuine: boolean; score: number; concerns: string[] };
  documentTypeMatch: boolean;
};

async function visionAnalyze(
  base64: string,
  mime: string,
  docType: string,
  category: "document" | "photo",
): Promise<VisionResult> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY missing");

  const isImage = mime.startsWith("image/");
  const mediaBlock = isImage
    ? { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } }
    : {
        type: "file",
        file: { filename: `document.${extFromMime(mime)}`, file_data: `data:${mime};base64,${base64}` },
      };

  const prompt =
    category === "photo"
      ? `You are verifying a shop photograph for an Indian hyperlocal marketplace (NearCart). The expected photo type is "${docType}" (e.g. shop front / board / interior / owner selfie).
Return STRICT JSON only, no prose, matching exactly:
{"ocrText": string, "extractedFields": {"businessName"?: string, "address"?: string}, "quality": {"score": number, "legible": boolean, "blurry": boolean, "issues": string[]}, "authenticity": {"looksGenuine": boolean, "score": number, "concerns": string[]}, "documentTypeMatch": boolean}
- quality.score and authenticity.score are 0..1. quality reflects sharpness/lighting/framing. authenticity flags stock/internet/reused images. documentTypeMatch is true if the image plausibly shows the expected "${docType}".`
      : `You are verifying an Indian business document for a marketplace (NearCart). Expected document type: "${docType}".
Return STRICT JSON only, no prose, matching exactly:
{"ocrText": string, "extractedFields": {"businessName"?: string, "ownerName"?: string, "licenseNumber"?: string, "registrationNumber"?: string, "address"?: string, "documentType"?: string, "expiryDate"?: string}, "quality": {"score": number, "legible": boolean, "blurry": boolean, "issues": string[]}, "authenticity": {"looksGenuine": boolean, "score": number, "concerns": string[]}, "documentTypeMatch": boolean}
- All scores are 0..1. Extract every readable field. documentTypeMatch is true if the document is actually a "${docType}". Flag tampering/edits/screenshots in authenticity.concerns.`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
    },
    body: JSON.stringify({
      model: OCR_MODEL,
      messages: [{ role: "user", content: [{ type: "text", text: prompt }, mediaBlock] }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`AI gateway ${res.status}: ${body.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = json.choices?.[0]?.message?.content ?? "";
  const parsed = parseJsonLoose(content);

  const q = (parsed.quality as VisionResult["quality"]) || {};
  const a = (parsed.authenticity as VisionResult["authenticity"]) || {};
  return {
    ocrText: String(parsed.ocrText ?? ""),
    extractedFields: (parsed.extractedFields as ExtractedFields) || {},
    quality: {
      score: clamp01(Number(q.score ?? 0.5)),
      legible: Boolean(q.legible ?? true),
      blurry: Boolean(q.blurry ?? false),
      issues: Array.isArray(q.issues) ? q.issues.map(String) : [],
    },
    authenticity: {
      looksGenuine: Boolean(a.looksGenuine ?? true),
      score: clamp01(Number(a.score ?? 0.5)),
      concerns: Array.isArray(a.concerns) ? a.concerns.map(String) : [],
    },
    documentTypeMatch: parsed.documentTypeMatch !== false,
  };
}

// ─── Confidence + decision ──────────────────────────────────────────────────

function decide(input: {
  quality: number;
  authenticity: number;
  matchScore: number;
  duplicate: boolean;
  docTypeMatch: boolean;
  ocrLen: number;
  category: "document" | "photo";
}): { confidence: number; decision: VerificationDecision } {
  const { quality, authenticity, matchScore, duplicate, docTypeMatch, ocrLen, category } = input;

  // Weighted score. Photos have no meaningful form match, so redistribute.
  let confidence =
    category === "photo"
      ? quality * 0.55 + authenticity * 0.45
      : quality * 0.25 + authenticity * 0.25 + matchScore * 0.35 + (ocrLen > 15 ? 0.15 : 0);

  if (!docTypeMatch) confidence -= 0.2;
  if (duplicate) confidence = Math.min(confidence, 0.15);
  confidence = clamp01(confidence);

  let decision: VerificationDecision;
  if (duplicate) {
    decision = "REJECTED";
  } else if (confidence < 0.35 || !docTypeMatch || quality < 0.3) {
    decision = "REJECTED";
  } else if (
    confidence >= 0.8 &&
    quality >= 0.5 &&
    authenticity >= 0.5 &&
    (category === "photo" || matchScore >= 0.5)
  ) {
    decision = "VERIFIED";
  } else {
    decision = "UNDER_REVIEW";
  }
  return { confidence: Number(confidence.toFixed(3)), decision };
}

// ─── Persistence (audit trail via the append-only events table) ─────────────

async function audit(merchantRef: string, action: string, detail: unknown): Promise<void> {
  await admin()
    .from("events")
    .insert({ name: "mv.audit", props: { merchantRef, action, detail, at: new Date().toISOString() } });
}

async function findDuplicate(
  sha256: string,
  merchantRef: string,
): Promise<{ duplicate: boolean; ofMerchant?: string }> {
  const { data } = await admin()
    .from("events")
    .select("props")
    .eq("name", "mv.document")
    .eq("props->>sha256", sha256)
    .limit(10);
  const other = (data || [])
    .map((r) => r.props as { merchantRef?: string })
    .find((p) => p?.merchantRef && p.merchantRef !== merchantRef);
  return other ? { duplicate: true, ofMerchant: other.merchantRef } : { duplicate: false };
}

async function storeFile(
  merchantRef: string,
  category: string,
  docId: string,
  ext: string,
  buffer: Buffer,
  mime: string,
): Promise<string> {
  const path = `${merchantRef}/${category}/${docId}.${ext}`;
  const { error } = await admin()
    .storage.from(BUCKET)
    .upload(path, buffer, { contentType: mime, upsert: true });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return path;
}

// ─── Public API (called from server functions) ──────────────────────────────

export type AnalyzeInput = {
  merchantRef: string;
  category: "document" | "photo";
  docType: string;
  fileName: string;
  mimeType: string;
  dataBase64: string;
  form?: VerificationForm;
};

export async function analyzeFile(input: AnalyzeInput): Promise<FileAnalysis> {
  const { merchantRef, category, docType, fileName, mimeType, dataBase64, form } = input;

  // 1. Server-side validation
  if (!ALLOWED_MIME.includes(mimeType)) {
    throw new Error(`Unsupported file type: ${mimeType}`);
  }
  const buffer = Buffer.from(dataBase64, "base64");
  if (buffer.length === 0) throw new Error("Uploaded file is empty");
  if (buffer.length > MAX_BYTES) throw new Error("File exceeds the 10 MB limit");

  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const docId = genDocId();
  const ext = extFromMime(mimeType);

  await audit(merchantRef, "file.received", { docType, category, sizeBytes: buffer.length, mimeType });

  // 2. Duplicate detection (global — same bytes uploaded by any other merchant)
  const dup = await findDuplicate(sha256, merchantRef);

  // 3. OCR + extraction + quality + authenticity (best-effort; never blocks)
  let vision: VisionResult;
  try {
    vision = await visionAnalyze(dataBase64, mimeType, docType, category);
  } catch (err) {
    vision = {
      ocrText: "",
      extractedFields: {},
      quality: { score: 0.4, legible: false, blurry: true, issues: ["Automated analysis unavailable"] },
      authenticity: { looksGenuine: true, score: 0.5, concerns: [] },
      documentTypeMatch: true,
    };
    await audit(merchantRef, "ai.error", { message: String(err).slice(0, 300) });
  }

  // 4. Compare extracted business details with the registration form
  const cmp =
    category === "photo"
      ? { matchScore: 1, details: {} as Record<string, number> }
      : compareWithForm(vision.extractedFields, form || {});

  // 5. Confidence + decision
  const { confidence, decision } = decide({
    quality: vision.quality.score,
    authenticity: vision.authenticity.score,
    matchScore: cmp.matchScore,
    duplicate: dup.duplicate,
    docTypeMatch: vision.documentTypeMatch,
    ocrLen: vision.ocrText.length,
    category,
  });

  const issues: string[] = [];
  if (dup.duplicate) issues.push("This exact file was already submitted by another merchant.");
  if (!vision.documentTypeMatch && category === "document")
    issues.push(`The file does not appear to be a valid ${docType}.`);
  if (cmp.matchScore < 0.4 && category === "document")
    issues.push("Business details on the document do not match your registration.");
  issues.push(...vision.quality.issues, ...vision.authenticity.concerns);

  // 6. Store the file securely (private bucket)
  const filePath = await storeFile(merchantRef, category, docId, ext, buffer, mimeType);

  const analysis: FileAnalysis = {
    docId,
    category,
    docType,
    fileName,
    filePath,
    sha256,
    sizeBytes: buffer.length,
    mimeType,
    confidence,
    decision,
    qualityScore: vision.quality.score,
    authenticityScore: vision.authenticity.score,
    matchScore: Number(cmp.matchScore.toFixed(3)),
    duplicate: dup.duplicate,
    ocrText: vision.ocrText,
    extractedFields: vision.extractedFields,
    matchDetails: cmp.details,
    issues: Array.from(new Set(issues)).slice(0, 12),
    createdAt: Date.now(),
  };

  // 7. Persist the document record + audit entry
  await admin().from("events").insert({ name: "mv.document", props: { merchantRef, ...analysis } });
  await audit(merchantRef, "file.analyzed", { docId, decision, confidence, duplicate: dup.duplicate });

  return analysis;
}

export type SubmissionView = {
  merchantRef: string;
  documents: FileAnalysis[];
  overall: {
    decision: VerificationDecision;
    confidence: number;
    documentCount: number;
    updatedAt: number | null;
  } | null;
};

export async function getSubmission(merchantRef: string): Promise<SubmissionView> {
  const { data: docRows } = await admin()
    .from("events")
    .select("props, created_at")
    .eq("name", "mv.document")
    .eq("props->>merchantRef", merchantRef)
    .order("created_at", { ascending: true });

  const { data: subRows } = await admin()
    .from("events")
    .select("props")
    .eq("name", "mv.submission")
    .eq("props->>merchantRef", merchantRef)
    .order("created_at", { ascending: false })
    .limit(1);

  // Keep only the latest analysis per (category, docType).
  const latest = new Map<string, FileAnalysis>();
  for (const row of docRows || []) {
    const p = row.props as FileAnalysis & { merchantRef: string };
    latest.set(`${p.category}:${p.docType}`, p);
  }

  const sub = subRows?.[0]?.props as
    | { overallDecision: VerificationDecision; overallConfidence: number; documentCount: number; updatedAt: number }
    | undefined;

  return {
    merchantRef,
    documents: Array.from(latest.values()),
    overall: sub
      ? {
          decision: sub.overallDecision,
          confidence: sub.overallConfidence,
          documentCount: sub.documentCount,
          updatedAt: sub.updatedAt ?? null,
        }
      : null,
  };
}

export async function finalizeSubmission(
  merchantRef: string,
  form?: VerificationForm,
): Promise<SubmissionView["overall"]> {
  const { documents } = await getSubmission(merchantRef);

  const avg =
    documents.length > 0
      ? documents.reduce((s, d) => s + (d.confidence || 0), 0) / documents.length
      : 0;
  const anyRejected = documents.some((d) => d.decision === "REJECTED");
  const anyReview = documents.some((d) => d.decision === "UNDER_REVIEW");

  let overallDecision: VerificationDecision;
  if (anyRejected) overallDecision = "REJECTED";
  else if (documents.length === 0 || anyReview) overallDecision = "UNDER_REVIEW";
  else overallDecision = "VERIFIED";

  const record = {
    merchantRef,
    overallDecision,
    overallConfidence: Number(avg.toFixed(3)),
    documentCount: documents.length,
    form: form || null,
    updatedAt: Date.now(),
  };

  await admin().from("events").insert({ name: "mv.submission", props: record });
  await audit(merchantRef, "submission.finalized", {
    overallDecision,
    overallConfidence: record.overallConfidence,
    documentCount: documents.length,
  });

  return {
    decision: overallDecision,
    confidence: record.overallConfidence,
    documentCount: documents.length,
    updatedAt: record.updatedAt,
  };
}

export async function getSignedFileUrl(path: string): Promise<{ url: string }> {
  const { data, error } = await admin().storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error) throw new Error(`Signed URL failed: ${error.message}`);
  return { url: data.signedUrl };
}
