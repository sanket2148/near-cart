// Server functions (typed RPC) for the merchant-verification backend.
//
// These are the public "backend APIs" the seller UI calls. Handlers load the
// server-only pipeline (`backend.server.ts`) via dynamic import so it never
// leaks into the client bundle.
//
// Every function requires a real session (authMiddleware) and verifies the
// caller owns `shopId` — this module used to be entirely unauthenticated,
// keyed only by a client-generated `merchantRef` with no ownership check at
// all, the highest-severity gap in the authorization-hardening plan (Phase
// 6, done last on purpose). See plan/tasks/decisions.md, 2026-07-19.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth-session/middleware";
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
  shopId: z.string().min(1),
  category: z.enum(["document", "photo"]),
  docType: z.string().min(1).max(60),
  fileName: z.string().min(1).max(200),
  mimeType: z.string().min(1).max(120),
  // ~10 MB binary ≈ 14M base64 chars; allow headroom.
  dataBase64: z.string().min(1).max(15_000_000),
  form: FormSchema,
});

export const submitVerificationFile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(SubmitFileSchema)
  .handler(async ({ context, data }): Promise<FileAnalysis> => {
    const be = await import("./backend.server");
    return be.analyzeFile({ ...data, callerId: context.uid });
  });

export const getVerificationSubmission = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .inputValidator(z.object({ merchantRef: z.string().min(3).max(80), shopId: z.string().min(1) }))
  .handler(async ({ context, data }) => {
    const be = await import("./backend.server");
    return be.getSubmission(data.merchantRef, data.shopId, context.uid);
  });

export const finalizeVerification = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      merchantRef: z.string().min(3).max(80),
      shopId: z.string().min(1),
      form: FormSchema,
    }),
  )
  .handler(async ({ context, data }) => {
    const be = await import("./backend.server");
    return be.finalizeSubmission(data.merchantRef, data.shopId, context.uid, data.form);
  });

export const getVerificationFileUrl = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(z.object({ path: z.string().min(1).max(300), shopId: z.string().min(1) }))
  .handler(async ({ context, data }) => {
    const be = await import("./backend.server");
    return be.getSignedFileUrl(data.path, data.shopId, context.uid);
  });
