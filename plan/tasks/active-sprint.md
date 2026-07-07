# Active Sprint — Shop Verification System

**Sprint Goal:** Build multi-level shop verification for NearCart (Levels 1–7 UI + state, badges, admin queue).
**Started:** 2026-07-06
**Status:** Planning phase — awaiting approval on implementation plan.

---

## Current Context

- **Tech stack:** TanStack Start + React 19, Tailwind v4, shadcn/ui, Bun, no backend yet.
- **State pattern:** React Context + localStorage (see `src/lib/seller.tsx`, `src/lib/cart.tsx`).
- **Relevant plan docs:** `plan/05-shop-verification.md`, `plan/03-database-schema.md`, `plan/02-api-contracts.md`.
- **Implementation plan:** Reviewed, pending user approval on open questions (see below).

---

## Open Questions (Blocking)

- [ ] Should sellers be blocked from dashboard until Level 1 (phone+email) is done, or see limited mode with banner?
- [ ] Mock OTP/email on frontend, or wire to a real provider (Twilio/MSG91)?
- [ ] Business types to include: Restaurant, Pharmacy, Grocery, Retail, Salon, Electronics — also Bakery, Hardware, Stationery, Florist?
- [ ] Include Home Business registration path in MVP?
- [ ] Badge display: shop cards only, detail page only, or both?

---

## Phase 1: Verification State & Types

- [x] Create `src/lib/verification.ts` — types: `VerificationLevel`, `BadgeTier`, `BusinessType`, `LevelStatus`, `ShopVerification`
- [x] Business-type-to-required-docs mapping (from plan Level 2 table)
- [x] Risk tier mapping per business type (pharmacy=high, grocery=low)
- [x] Badge computation logic (which completed levels → which badge tier)
- [x] Fraud flag rules engine (duplicate GST, reused photos, GPS mismatch etc.)
- [x] Extend `ShopProfile` in `src/lib/seller.tsx` with `businessType`, `badgeTier`, `verificationStatus`
- [x] Add verification state to `SellerContextValue` + localStorage persistence
- [x] Add `businessType` and `badgeTier` to seed shop data in `src/lib/data.ts`

## Phase 2: Database Schema Updates (Plan Doc Only)

- [x] Add new enums to `plan/03-database-schema.md`: `business_type`, `badge_tier`, `verification_level_status`
- [x] Add `shop_verifications` table (one row per shop, tracks all 8 level statuses)
- [x] Add `bank_verifications` table (account, IFSC, penny-drop status)
- [x] Add `gps_verifications` table (lat/lng, address match)
- [x] Add `shop_photos` table (type, file_path, metadata for duplicate detection)
- [x] Add `fraud_flags` table (rule, severity, resolved status)
- [x] Add `business_type_requirements` config table (doc_type per business_type)
- [x] Extend `kyc_doc_type` enum with: fssai, drug_license, trade_license, udyam, shop_establishment

## Phase 3: Verification Wizard UI (Seller Onboarding)

- [x] Create route `src/routes/seller.onboarding.tsx` — main wizard page at `/seller/onboarding`
- [x] Create `src/components/seller/VerificationWizard.tsx` — wizard container (stepper, navigation, state)
- [x] Create `src/components/seller/verification/StepContactVerify.tsx` — Phone OTP + Email verification
- [x] Create `src/components/seller/verification/StepBusinessType.tsx` — Category selector cards
- [x] Create `src/components/seller/verification/StepDocumentUpload.tsx` — Dynamic doc list per type, file upload
- [x] Create `src/components/seller/verification/StepOwnerKYC.tsx` — PAN / Aadhaar input + name match
- [x] Create `src/components/seller/verification/StepBankDetails.tsx` — Account, IFSC, penny-drop sim
- [x] Create `src/components/seller/verification/StepShopPhotos.tsx` — Photo upload + GPS capture
- [x] Create `src/components/seller/verification/StepReviewSubmit.tsx` — Summary + submit
- [x] Wire wizard to verification state (save progress on each step)
- [x] Prevent selling if not verified (Added `VerificationLockGate` to wrap orders & products pages, and disabled settings open switch)

## Phase 4: Verification Badge Display (Customer-Facing)

- [x] Create `src/components/VerificationBadge.tsx` — badge component (4 tiers, 3 sizes, tooltip, glow animation)
- [x] Add badge to `src/components/ShopCard.tsx` — `sm` size next to shop name
- [x] Add badge to `src/routes/shop.$shopId.tsx` — `md` size on detail header + "What does this mean?" section

## Phase 5: Seller Dashboard Verification Status

- [x] Create `src/components/seller/VerificationStatusCard.tsx` — progress card for dashboard
- [x] Add `VerificationStatusCard` to `src/routes/seller.index.tsx`
- [x] Create route `src/routes/seller.verification.tsx` — full verification status page at `/seller/verification`
- [x] Synchronize open shop toggle with verification status (forces shop to remain closed unless verified)
- [~] Add verification nav item to `src/components/seller/SellerBottomNav.tsx` (Deferred: Entrypoints in settings and dashboard are sufficient)

## Phase 6: Admin Review Queue

- [x] Create route `src/routes/admin.verification.tsx` — review queue at `/admin/verification`
- [x] Build shop list with filters (business type, risk level, date)
- [x] Build approve / reject / request-more-info actions
- [x] Build document preview panel
- [x] Build verification detail side panel

## Phase 7: API Contracts Update (Plan Doc Only)

- [x] Add `§4b. Shop Verification 🟠` section to `plan/02-api-contracts.md`
- [x] Document all verification endpoints (start, contact, documents, kyc, bank, gps, submit)
- [x] Document admin verification endpoints (queue, approve, reject, request-info)

---

## Files That Will Be Created

```
src/lib/verification.ts                                    ← Phase 1
src/routes/seller.onboarding.tsx                           ← Phase 3
src/components/seller/VerificationWizard.tsx                ← Phase 3
src/components/seller/verification/StepContactVerify.tsx    ← Phase 3
src/components/seller/verification/StepBusinessType.tsx     ← Phase 3
src/components/seller/verification/StepDocumentUpload.tsx   ← Phase 3
src/components/seller/verification/StepOwnerKYC.tsx         ← Phase 3
src/components/seller/verification/StepBankDetails.tsx      ← Phase 3
src/components/seller/verification/StepShopPhotos.tsx       ← Phase 3
src/components/seller/verification/StepReviewSubmit.tsx     ← Phase 3
src/components/VerificationBadge.tsx                        ← Phase 4
src/components/seller/VerificationStatusCard.tsx            ← Phase 5
src/routes/seller.verification.tsx                          ← Phase 5
src/routes/admin.verification.tsx                           ← Phase 6
```

## Files That Will Be Modified

```
src/lib/seller.tsx          ← Phase 1 (add verification fields to ShopProfile + context)
src/lib/data.ts             ← Phase 1 (add businessType, badgeTier to seed shops)
src/components/ShopCard.tsx ← Phase 4 (add VerificationBadge)
src/routes/shop.$shopId.tsx ← Phase 4 (add VerificationBadge + info section)
src/routes/seller.index.tsx ← Phase 5 (add VerificationStatusCard)
src/components/seller/SellerBottomNav.tsx ← Phase 5 (add verification nav item)
plan/03-database-schema.md ← Phase 2 (new tables + enums)
plan/02-api-contracts.md   ← Phase 7 (new verification endpoints)
```
