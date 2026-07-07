# NearCart

## Connecting Retail Shops to Customers — Like Zomato, for Every Store

### Product Requirements Document

**Version:** 1.0

**Status:** Draft — For Review

**Prepared by:** Product Team

**Date:** June 2025

**Classification:** Confidential — Internal Use Only

---

## 1. Executive Summary

NearCart is a hyperlocal commerce platform that connects neighborhood retail shops — grocery stores, pharmacies, hardware stores, bakeries, and more — directly to customers within a defined radius.

Inspired by food delivery platforms such as Zomato and Swiggy, NearCart brings the same on-demand discovery, ordering, and delivery experience to all categories of retail.

The platform operates as a three-sided marketplace serving customers, retail shop owners, and delivery partners.

- Customers browse nearby shops, place orders, track deliveries in real time, and pay digitally.
- Shop owners manage catalogs, receive and fulfill orders, and access marketing and analytics tools.
- Delivery partners earn income through flexible, app-dispatched assignments.

---

## 2. Problem Statement

### 2.1 Customer Pain Points

- No single digital window to discover what local shops have in stock.
- Forced to visit multiple stores or call ahead to check availability.
- Limited to shop operating hours; cannot place advance or scheduled orders.
- No standardized digital payment or invoice trail for everyday retail purchases.

### 2.2 Retail Shop Owner Pain Points

- Lack of digital presence and discoverability beyond walk-in customers.
- No affordable tools for catalog management, promotions, or demand forecasting.
- Dependence on WhatsApp or phone for order taking — error-prone and unscalable.
- Limited access to last-mile delivery infrastructure for home delivery.

### 2.3 Delivery Partner Pain Points

- Fragmented gig opportunities spread across multiple apps.
- Lack of earnings transparency and predictable income.
- No consolidated hub for multi-category retail deliveries.

---

## 3. Goals & Success Metrics

### 3.1 Business Goals

- Onboard 500 retail shops in 3 cities within 6 months of launch.
- Achieve 50,000 monthly transacting users (MTU) within 12 months.
- Reach a 4.5% platform take-rate with sustainable unit economics by Month 18.
- Maintain delivery NPS > 60 and shop owner NPS > 50.

### 3.2 Key Metrics

| Metric | Target (Month 12) | Measurement |
| --- | --- | --- |
| Monthly Transacting Users | 50,000 | Unique users placing ≥1 order/month |
| Orders Per Day | 5,000+ | Total platform orders |
| Average Order Value (AOV) | ₹450–₹600 | GMV / number of orders |
| Shop Onboarding | 500 shops | Verified & live shops |
| Delivery TAT | < 45 minutes | Order placed → delivered |
| App Store Rating | ≥ 4.3 stars | Combined iOS + Android |
| Customer Repeat Rate | ≥ 40% | % users ordering 2+ times/month |

---

## 4. Target Audience

### 4.1 Customers

- Urban and semi-urban residents aged 22–45.
- Working professionals, homemakers, and students who value convenience.
- Users comfortable with food-delivery and e-commerce apps.
- Initial focus cities: Delhi NCR, Bengaluru, Mumbai.

### 4.2 Retail Shop Owners

- Kirana/general stores, pharmacies, bakeries, stationery, electronics shops.
- Owner-operated businesses with 1–10 employees.
- Shops within a 5 km delivery radius.
- Owners with a basic smartphone; technical literacy not required.

### 4.3 Delivery Partners

- Gig workers with a two-wheeler or bicycle.
- Individuals seeking supplementary or primary income.
- Age 18–40, with a valid driving license and smartphone.

---

## 5. User Personas

### Priya — The Busy Professional

- Age 31, software engineer in Bengaluru.
- Needs quick grocery, medicine, and snack delivery.
- Values reliability, real-time tracking, and easy UPI payments.

### Ramesh — The Kirana Shop Owner

- Age 47, owner of a family grocery store in Koramangala.
- Needs digital visibility, a simple order dashboard, and help with delivery.
- Wants to reach customers within a 3 km radius without extra staff.

### Ajay — The Delivery Partner

- Age 24, works for food delivery apps and owns a two-wheeler.
- Wants more orders, fair incentives, and transparent earnings tracking.

---

## 6. Product Scope

### 6.1 In Scope (v1.0)

- Customer mobile app (Android & iOS).
- Shop owner app / web dashboard.
- Delivery partner app (Android first).
- Platform admin dashboard.
- Core order management, real-time tracking, digital payments.
- Hyperlocal discovery with configurable radius.

### 6.2 Out of Scope (Post-MVP)

- Inventory-integrated POS systems.
- B2B / wholesale ordering.
- Subscription / loyalty programs.
- White-label solutions for shop chains.
- International expansion.

---

## 7. Feature Requirements

### 7.1 Customer App

| Feature | Description | Priority |
| --- | --- | --- |
| Onboarding & Auth | Phone OTP login; name, address, preference setup. | P0 |
| Hyperlocal Discovery | Shops within configurable radius; filters for category, rating, status. | P0 |
| Product Search & Browse | Full-text search; category browse; product detail pages. | P0 |
| Cart & Checkout | Multi-item cart; address selection; now/later delivery; promo codes. | P0 |
| Payment Gateway | UPI, cards, net banking, COD; saved payment methods. | P0 |
| Real-Time Order Tracking | Live map tracking and push notifications. | P0 |
| Order History & Reorder | Past orders, one-tap reorder, digital invoice. | P1 |
| Ratings & Reviews | Rate shops and delivery partners after delivery. | P1 |
| Referral & Coupons | Referral sharing and coupon redemption. | P1 |
| Chat Support | In-app support chat for order queries. | P2 |

### 7.2 Shop Owner App / Dashboard

| Feature | Description | Priority |
| --- | --- | --- |
| Onboarding & KYC | Shop registration, document upload, verification workflow. | P0 |
| Catalog Management | Add/edit/delete products; bulk CSV upload; image upload; stock toggles. | P0 |
| Order Dashboard | Accept/reject orders; view details; mark ready for pickup. | P0 |
| Availability Control | Open/close toggle; operating hours and holidays. | P0 |
| Earnings & Payouts | Daily/weekly earnings, settlement history, bank account management. | P0 |
| Promotions | Discounts, flash sales, minimum order free delivery. | P1 |
| Analytics Dashboard | Top-selling products, peak hours, retention metrics. | P1 |
| Inventory Alerts | Low-stock notifications and auto-hide out-of-stock items. | P2 |

### 7.3 Delivery Partner App

| Feature | Description | Priority |
| --- | --- | --- |
| Onboarding & KYC | Registration, document upload, background check. | P0 |
| Order Dispatch | Accept/decline orders and navigation to pickup/delivery. | P0 |
| Earnings Tracker | Trip earnings, daily/weekly summary, incentives. | P0 |
| Availability Toggle | Go online/offline and set preferred zones. | P0 |
| SOS & Safety | Emergency contact and live location sharing. | P1 |
| In-App Chat | Chat with customer and support. | P1 |

### 7.4 Platform Admin Dashboard

| Feature | Description | Priority |
| --- | --- | --- |
| Shop Management | Approve, suspend, remove shops; manage KYC queue. | P0 |
| Partner Management | Onboard/suspend delivery partners; manage incentives. | P0 |
| Order Ops | Override status, resolve disputes, manual refunds. | P0 |
| Finance & Settlements | Reconciliation, payout approvals, GST reporting. | P0 |
| Promotions Engine | Create/manage platform-wide coupons and banners. | P1 |
| Analytics & BI | City-level GMV, orders, AOV, funnel and retention. | P1 |

---

## 8. Key User Flows

### 8.1 Customer Order Flow

1. Open app and browse/search nearby shops.
2. Select shop, browse catalog, add items to cart.
3. Checkout with address confirmation and payment.
4. Shop receives order notification and accepts it.
5. Delivery partner is assigned and pickup begins.
6. Customer tracks delivery in real time.
7. Delivery completes and customer rates the experience.

### 8.2 Shop Owner Order Fulfillment Flow

1. Receive order notification.
2. Review and accept/reject within 5 minutes.
3. Prepare items and mark ready for pickup.
4. Confirm handoff with delivery partner via OTP or app tap.

### 8.3 Delivery Partner Flow

1. Go online and receive dispatch.
2. Accept order and navigate to shop.
3. Confirm pickup and navigate to customer.
4. Deliver order and confirm delivery.
5. Earnings credited automatically.

---

## 9. Non-Functional Requirements

| Area | Requirement | Target |
| --- | --- | --- |
| Performance | App cold start load time | < 3 seconds on 4G |
| Performance | Order placement to confirmation | < 5 seconds |
| Scalability | Concurrent active sessions | 10,000+ without degradation |
| Availability | Platform uptime | 99.9% |
| Security | Payment data | PCI-DSS Level 1 compliant |
| Security | User data storage | AES-256 at rest; TLS 1.3 in transit |
| Privacy | Data retention | PDPA/DPDP Act compliant |
| Localization | Language support | English + 3 regional languages (v1) |
| Accessibility | Screen reader & contrast | WCAG 2.1 AA |

---

## 10. Technical Architecture Overview

### 10.1 Platform Stack

- Frontend: React Native mobile; React.js web dashboard.
- Backend: Node.js microservices; REST + GraphQL APIs.
- Database: PostgreSQL; Redis; Elasticsearch.
- Real-Time: WebSockets / Firebase Realtime Database.
- Maps: Google Maps Platform.
- Payments: Razorpay or Stripe India.
- Cloud: AWS ECS, RDS, S3, CloudFront.
- Notifications: Firebase Cloud Messaging + Twilio SMS.

### 10.2 Core Microservices

- Auth Service: OTP login, tokens, KYC status.
- Catalog Service: product/shop CRUD, search indexing.
- Order Service: order lifecycle state machine.
- Dispatch Service: delivery partner assignment.
- Payment Service: payment initiation, webhooks, refunds.
- Notification Service: push, SMS, in-app alerts.
- Analytics Service: event tracking and reporting.

---

## 11. Monetization Model

| Revenue Stream | Description | Target Rate |
| --- | --- | --- |
| Commission on Orders | Platform fee charged to shops. | 8–12% |
| Delivery Fee | Charged to customers; partially retained by platform. | ₹20–₹49 |
| Shop Subscription | Premium listing and analytics. | ₹499–₹999/month |
| Promoted Listings | Top placement in discovery feed. | CPM/CPC |
| Customer Subscription | Free/discounted delivery pass. | ₹99–₹149/month |

---

## 12. Risks & Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Low shop adoption | Thin supply side and poor customer experience. | City onboarding team; 0% commission launch offer. |
| Delivery partner shortage | High TAT and cancellations. | Surge incentives and referral bonuses. |
| Incumbent competition | Price-sensitive market. | Focus on non-grocery retail categories. |
| Payment failures | Cart abandonment and trust loss. | Multiple payment fallbacks; COD support. |
| Data privacy breach | Regulatory/reputational damage. | Security audits and bug bounty program. |
| Fake reviews/fraud | Trust score erosion. | ML fraud detection and manual review. |

---

## 13. Development Roadmap

| Phase | Timeline | Key Deliverables |
| --- | --- | --- |
| Phase 0 — Foundation | Months 1–2 | Architecture, design system, API contracts, KYC flow, basic apps. |
| Phase 1 — MVP Launch | Months 3–4 | Order flow, tracking, payments, delivery app, admin dashboard. |
| Phase 2 — Hardening | Month 5 | Performance optimization, bug fixes, ratings, analytics. |
| Phase 3 — Growth | Months 6–8 | Promotions, shop analytics, subscriptions, regional languages. |
| Phase 4 — Scale | Months 9–12 | City expansion, B2B exploration, loyalty program. |

---

## 14. Open Questions & Dependencies

- Own delivery fleet, gig partners, or hybrid model?
- Top 3 launch cities and go-to-market budgets?
- Preferred payment gateway partner?
- KYC verification SLA: manual, automated, or third-party?
- Focus on one retail vertical before expanding?
- Required marketplace licensing under Indian regulations?

---

## 15. Appendix

### 15.1 Competitive Landscape

| Platform | Primary Vertical | Gap NearCart Fills |
| --- | --- | --- |
| Zomato / Swiggy Instamart | Food & fast groceries | Non-food retail categories. |
| Blinkit / Zepto | Dark store groceries | Neighborhood shops, no dark store capex. |
| Dunzo | Multi-category hyperlocal | Better shop tools and catalog management. |
| Urban Company | Services | Physical goods delivery marketplace. |

### 15.2 Glossary

| Term | Definition |
| --- | --- |
| AOV | Average Order Value; GMV / number of orders. |
| GMV | Gross Merchandise Value; total transacted value. |
| TAT | Turnaround Time; order placement to delivery. |
| MTU | Monthly Transacting Users; unique users completing ≥1 order. |
| KYC | Know Your Customer; identity/document verification. |
| P0 / P1 / P2 | Priority tiers: P0 = must-have, P1 = important, P2 = nice-to-have. |

---

*End of Document.*
