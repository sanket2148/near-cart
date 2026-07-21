# Task: Server-Side Verification Pipeline (Phase 8 of the Shop Verification sprint)

**Completed:** 2026-07-10
**Sprint:** Shop Verification System Sprint (continuation of `2026-07-06-shop-verification-system.md`)

## Summary

Added a real server-side document-analysis pipeline behind the verification wizard built in the earlier phases of this sprint: SHA-256 duplicate detection, AI-vision OCR + quality/authenticity scoring (Lovable AI gateway, `google/gemini-2.5-flash`), form-match scoring, and a weighted confidence score producing a `VERIFIED`/`UNDER_REVIEW`/`REJECTED` decision per uploaded document/photo. Wired the wizard's upload steps to call it for real instead of hardcoding statuses.

## Files Created

- `src/lib/verification/backend.server.ts` — the pipeline itself (validation, dedup, vision analysis, scoring, decision).
- `src/lib/verification/api.functions.ts` — server-function entry points (`submitVerificationFile`, `getVerificationSubmission`, `finalizeVerification`, `getVerificationFileUrl`).

## Files Modified

- `src/components/seller/verification/StepDocumentUpload.tsx` / `StepShopPhotos.tsx` — real `<input type="file">`, `fileToBase64()` (new helper in `verification.ts`), call `submitVerificationFile`; per-doc/photo status now comes from the returned `FileAnalysis.decision`.
- `src/components/seller/verification/StepReviewSubmit.tsx` — calls `finalizeVerification` on submit (async, loading state), maps the real overall decision to `overallStatus`/`flagged`/`flagReasons`.
- `src/lib/verification.ts` — added `fileToBase64()`, `FileAnalysis`/`ExtractedFields`/`VerificationDecision` types shared between client and server.

## Notes

- Uploaded documents/photos are stored in a private Supabase Storage bucket (`merchant-verification`); every pipeline action is written to an append-only audit trail via the generic `events` table (`mv.audit`/`mv.document`/`mv.submission` event names) rather than purpose-built tables.
- `getVerificationSubmission` and `getVerificationFileUrl` were unused at the time this phase closed — no caller needed submission-resume or admin document-preview yet. (Both are now used — `admin.verification.tsx`'s deep-detail view and the localStorage-fallback path — see the backend-build-out sprint's done/ entry.)
- **Confirmed mismatch, left open at the time:** `plan/03-database-schema.md` §3 defines dedicated `shop_photos`/`fraud_flags`/`kyc_documents`/`bank_verifications`/`gps_verifications` tables, but this pipeline wrote everything to the generic `events` table instead. This was picked back up and partially closed during the later backend-build-out sprint (per-level status columns on `shop_verifications` now sync for real; the document/photo/bank/GPS *detail* tables are still unused — see `plan/tasks/decisions.md`, 2026-07-15, "Verification pipeline migration, scoped to per-level status sync only").
- This entry closes out `active-sprint.md`'s "Phase 8" section, which was left unarchived when this sprint otherwise wrapped up on 2026-07-06 — see `2026-07-06-shop-verification-system.md` for Phases 1–7.
