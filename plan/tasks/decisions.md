# Decisions Log

Key technical and design decisions made during implementation. This helps future AI agents (or humans) understand **why** something was done a certain way.

---

## Format

Each entry:

```
### YYYY-MM-DD — Short Title
**Context:** Why this decision came up.
**Decision:** What was decided.
**Alternatives considered:** What else was on the table.
**Consequence:** What this means for future work.
```

---

### 2026-07-06 — Frontend-first verification with localStorage

**Context:** The project has no backend yet (all mock data + localStorage). We need to build the shop verification system.

**Decision:** Build the entire verification wizard and state management on the frontend using React Context + localStorage, matching the existing pattern used by `seller.tsx`, `cart.tsx`, `partner.tsx`, and `tracking.tsx`.

**Alternatives considered:**
1. Wait for backend — would block all verification UI work.
2. Build a minimal backend first — too much scope for this sprint.

**Consequence:** When the real backend (Supabase/Postgres) is connected, the localStorage state will need to be replaced with API calls. The types and UI components should remain the same. The `verification.ts` types are designed to match the planned database schema exactly, so the migration should be straightforward.

---

### 2026-07-06 — Task tracking lives in plan/tasks/

**Context:** The user works with multiple AI coding agents and needs a way to track progress that any agent can read.

**Decision:** Created `plan/tasks/` folder in the project repo with:
- `README.md` — instructions for AI agents
- `active-sprint.md` — current sprint with checkbox tasks
- `backlog.md` — future work
- `decisions.md` — this file
- `done/` — completed task logs

**Alternatives considered:**
1. GitHub Issues — requires API access, not all AI agents can interact with it.
2. Separate tracking repo — too disconnected from the code.
3. Single TODO.md at root — doesn't scale, hard to track completed work.

**Consequence:** Every AI agent should read `plan/tasks/active-sprint.md` first to understand current state. The `done/` folder provides an audit trail.

---

### 2026-07-06 — Gating selling features via VerificationLockGate

**Context:** Non-verified shops should not be able to list products or accept orders.

**Decision:** Created a `<VerificationLockGate>` component. If the shop's verification status is not `approved`, this component blocks layout rendering and displays a lock overlay with progress stats and a CTA button pointing to onboarding.
We wrapped the main views in `seller.orders.tsx` and `seller.products.tsx` with this gate, disabled the "Open Shop" settings switch in `seller.settings.tsx` for non-verified shops, and added an effect hook in `SellerProvider` (`seller.tsx`) that automatically forces `shop.isOpen` to `false` if verification status is not `approved`.

**Alternatives considered:**
1. Global router-level redirect: Too disruptive since the seller still needs to access settings, verification history, and the dashboard index.
2. Silent disabling of buttons: Confusing UX; rendering an explicit lock overlay clearly explains *why* the page is locked.

**Consequence:** Gating is strictly enforced on the frontend. The dashboard index (`/seller`) remains accessible so sellers can see the `VerificationStatusCard` and click "Verify Shop".

---

### 2026-07-07 — Mobile App Strategy: React Native & Expo (TypeScript)

**Context:** The project requires a cross-platform mobile client for Buyers and Drivers, with key requirements for background GPS location tracking, Supabase integration, and zero development budget (solo founder).

**Decision:** Build the mobile apps using **React Native with Expo** (using a monorepo structure to share database schemas, types, validation rules, and Supabase client logic with the Vite web client).

**Alternatives considered:**
1. Flutter (Dart): Offers slightly more consistent UI rendering and standard widgets, but requires learning Dart and leads to 0% code reuse, doubling maintenance effort.
2. Native Android/iOS (Kotlin/Swift): Best system integration, but requires two independent developers/codebases, which is too expensive for a solo founder.

**Consequence:** NearCart's entire codebase remains in a single language ecosystem (TypeScript) and single framework context (React). We can share types, schemas (Zod), and GPS location helpers directly via a shared library.


