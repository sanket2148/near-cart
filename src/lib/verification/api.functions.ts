// Server functions (typed RPC) for the merchant-verification backend.
//
// These are the public "backend APIs" the seller UI calls. Handlers load the
// server-only pipeline (`backend.server.ts`) via dynamic import so it never
// leaks into the client bundle.
//
// NOTE: with the app's current open role-switching (no seller login), these
// are unauthenticated endpoints keyed by `merchantRef`. When real auth is
// added, attach `requireSupabaseAuth` and scope records to the user id.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { FileAnalysis } from "@/lib/verification";

const FormSchema = z
  .object({
    businessName: z.string().max(200).optional(),
    ownerName: z.string().max(200).optional(),
    address: z.string().max(400).optional(),
    businessType: z.string().max(80).optional(),
  })
  .optional();

const SubmitFileSchema = z.object({
  merchantRef: z.string().min(3).max(80),
  category: z.enum(["document", "photo"]),
  docType: z.string().min(1).max(60),
  fileName: z.string().min(1).max(200),
  mimeType: z.string().min(1).max(120),
  // ~10 MB binary ≈ 14M base64 chars; allow headroom.
  dataBase64: z.string().min(1).max(15_000_000),
  form: FormSchema,
});

export const submitVerificationFile = createServerFn({ method: "POST" })
  .inputValidator(SubmitFileSchema)
  .handler(async ({ data }): Promise<FileAnalysis> => {
    const be = await import("./backend.server");
    return be.analyzeFile(data);
  });

export const getVerificationSubmission = createServerFn({ method: "GET" })
  .inputValidator(z.object({ merchantRef: z.string().min(3).max(80) }))
  .handler(async ({ data }) => {
    const be = await import("./backend.server");
    return be.getSubmission(data.merchantRef);
  });

export const finalizeVerification = createServerFn({ method: "POST" })
  .inputValidator(z.object({ merchantRef: z.string().min(3).max(80), form: FormSchema }))
  .handler(async ({ data }) => {
    const be = await import("./backend.server");
    return be.finalizeSubmission(data.merchantRef, data.form);
  });

export const getVerificationFileUrl = createServerFn({ method: "POST" })
  .inputValidator(z.object({ path: z.string().min(1).max(300) }))
  .handler(async ({ data }) => {
    const be = await import("./backend.server");
    return be.getSignedFileUrl(data.path);
  });
