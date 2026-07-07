# Backlog

Future tasks not yet scheduled into a sprint.

---

## Post-Verification Features

- [ ] Level 8: Customer Verification — track delivery success, ratings, complaints, refund rate after launch
- [ ] AI Fraud Detection — image similarity check, reverse image search, shop board OCR vs entered name
- [ ] Periodic License Expiry Checks — auto-flag shops with expiring FSSAI, Drug License, etc.
- [ ] Multi-shop per owner — allow one owner to manage multiple shops with separate verifications
- [ ] Verification Analytics — admin dashboard showing approval rates, avg time to verify, rejection reasons

## Auth System (Prerequisite for Real Verification)

- [ ] Implement phone OTP auth (POST /auth/otp/request, /auth/otp/verify)
- [ ] JWT session management with role claims
- [ ] Route guards for seller/partner/admin routes
- [ ] Role-based access control middleware
- [ ] Refresh token flow

## Backend Integration

- [ ] Connect Supabase/PostgreSQL
- [ ] Run database migrations (all tables from plan/03-database-schema.md)
- [ ] Replace localStorage state with real API calls
- [ ] File upload to Supabase Storage (KYC documents, shop photos)
- [ ] Integrate SMS provider for real OTP (MSG91 / Twilio)
- [ ] Integrate email provider for verification links
- [ ] Integrate payment provider for penny-drop bank verification (Razorpay / Cashfree)

## Cross-Platform Mobile Apps (React Native + Expo)

- [ ] Set up monorepo structure (Web app and Mobile apps sharing packages/)
- [ ] Create shared packages for Types, Supabase Client, and GPS/Proximity Utilities
- [ ] Initialize Expo Mobile App (targets both iOS and Android)
- [ ] Implement Mobile Buyer App UI (Discovery, Search, Cart, Orders)
- [ ] Implement Mobile Driver App with background GPS location tracking (Expo TaskManager + expo-location)
- [ ] Implement Merchant Verification Wizard screens on mobile (Camera uploads, GPS coordinate captures)
