NearCart

Connecting Retail Shops to Customers — Like Zomato, for Every Store

Product Requirements Document



Version

1.0

Status

Draft — For Review

Prepared by

Product Team

Date

June 2025

Classification

Confidential — Internal Use Only







1. Executive Summary

NearCart is a hyperlocal commerce platform that connects neighborhood retail shops — grocery stores, pharmacies, hardware stores, bakeries, and more — directly to customers within a defined radius. Inspired by the success of food delivery platforms such as Zomato and Swiggy, NearCart brings the same on-demand discovery, ordering, and delivery experience to all categories of retail.

The platform operates as a three-sided marketplace serving customers, retail shop owners, and delivery partners. Customers browse a curated list of nearby shops, place orders, track deliveries in real time, and pay digitally. Shop owners manage their catalog, receive and fulfill orders, and gain data-driven marketing tools. Delivery partners earn income through flexible, app-dispatched assignments.



2. Problem Statement

2.1 Customer Pain Points

No single digital window to discover what local shops have in stock.

Forced to visit multiple stores or call ahead to check availability.

Limited to shop operating hours; cannot place advance or scheduled orders.

No standardized digital payment or invoice trail for everyday retail purchases.



2.2 Retail Shop Owner Pain Points

Lack of digital presence and discoverability beyond walk-in customers.

No affordable tools for catalog management, promotions, or demand forecasting.

Dependence on WhatsApp or phone for order taking — error-prone and unscalable.

Limited access to last-mile delivery infrastructure for home delivery.



2.3 Delivery Partner Pain Points

Fragmented gig opportunities spread across multiple apps.

Lack of earnings transparency and predictable income.

No consolidated hub for multi-category retail deliveries.



3. Goals & Success Metrics

3.1 Business Goals

Onboard 500 retail shops in 3 cities within 6 months of launch.

Achieve 50,000 monthly transacting users (MTU) within 12 months.

Reach a 4.5% platform take-rate (commission) with sustainable unit economics by Month 18.

Maintain delivery NPS > 60 and shop owner NPS > 50 at steady state.



3.2 Key Metrics

Metric

Target (Month 12)

Measurement

Monthly Transacting Users

50,000

Unique users placing ≥1 order/month

Orders Per Day

5,000+

Total platform orders

Average Order Value (AOV)

₹450–₹600

GMV / number of orders

Shop Onboarding

500 shops

Verified & live shops

Delivery TAT

< 45 minutes

Order placed → delivered

App Store Rating

≥ 4.3 stars

Combined iOS + Android

Customer Repeat Rate

≥ 40%

% users ordering 2+ times/month





4. Target Audience

4.1 Customers

Urban and semi-urban residents aged 22–45.

Working professionals, homemakers, and students who value convenience.

Users already comfortable with food-delivery and e-commerce apps.

Initial focus cities: Tier-1 metro areas (Delhi NCR, Bengaluru, Mumbai).



4.2 Retail Shop Owners

Kirana / general stores, pharmacies, bakeries, stationery, and electronics shops.

Owner-operated businesses with 1–10 employees.

Shops with a physical footprint within a 5 km delivery radius.

Owners with a basic smartphone; technical literacy not required.



4.3 Delivery Partners

Gig workers with a two-wheeler or bicycle.

Individuals seeking supplementary or primary income.

Age 18–40, with a valid driving license and smartphone.



5. User Personas

Priya — The Busy Professional (Customer)

Age 31, software engineer in Bengaluru. Priya works 10-hour days and has little time for errands. She wants to order groceries, medicines, and snacks from nearby shops and get them delivered within the hour. She values reliability, real-time tracking, and easy UPI payments.



Ramesh — The Kirana Shop Owner

Age 47, runs a 30-year-old family grocery store in Koramangala. Ramesh has a loyal customer base but is losing walk-in traffic to large supermarkets. He wants digital visibility, a simple order dashboard, and help with delivery so he can reach customers within a 3 km radius without hiring extra staff.



Ajay — The Delivery Partner

Age 24, undergraduate dropout with a two-wheeler. Ajay currently works for a food delivery app but wants more orders and higher earnings per hour. He needs an easy-to-use partner app, fair incentives, and transparent earnings tracking.



6. Product Scope

6.1 In Scope (v1.0 — MVP)

Customer mobile app (Android & iOS).

Shop owner app / web dashboard.

Delivery partner app (Android first).

Platform admin dashboard (internal).

Core order management, real-time tracking, and digital payments.

Hyperlocal discovery (shop & product search within configurable radius).



6.2 Out of Scope (Post-MVP)

Inventory-integrated POS systems.

B2B / wholesale ordering.

Subscription / loyalty reward programs.

White-label solutions for individual shop chains.

International expansion.



7. Feature Requirements

7.1 Customer App

Feature

Description

Priority

Onboarding & Auth

Phone OTP login; name, address, and preference setup.

P0

Hyperlocal Discovery

Show shops within a configurable radius (default 5 km); filter by category, rating, and open/closed status.

P0

Product Search & Browse

Full-text search across shops; browse by category; product detail with images and pricing.

P0

Cart & Checkout

Multi-item cart; delivery address selection; schedule delivery (now or later); promo code entry.

P0

Payment Gateway

UPI, cards, net banking, and cash on delivery (COD); saved payment methods.

P0

Real-Time Order Tracking

Live map tracking of delivery partner; status push notifications.

P0

Order History & Reorder

Past orders list; one-tap reorder; digital invoice download.

P1

Ratings & Reviews

Rate shop and delivery partner post-delivery; written review optional.

P1

Referral & Coupons

Referral code sharing; coupon redemption at checkout.

P1

Chat Support

In-app chat with support agent; order-specific queries.

P2





7.2 Shop Owner App / Dashboard

Feature

Description

Priority

Onboarding & KYC

Shop registration, document upload (GST, FSSAI, ID), and verification workflow.

P0

Catalog Management

Add/edit/delete products; bulk CSV upload; image upload; pricing and stock toggle.

P0

Order Dashboard

Accept/reject incoming orders; view order details; mark as ready for pickup.

P0

Availability Control

Open/close shop toggle; set operating hours and holiday schedule.

P0

Earnings & Payouts

Daily/weekly earnings summary; settlement history; bank account management.

P0

Promotions

Create discounts and flash sales; set minimum order value for free delivery.

P1

Analytics Dashboard

Top-selling products; peak order hours; customer retention metrics.

P1

Inventory Alerts

Low-stock notifications; auto-hide out-of-stock items.

P2





7.3 Delivery Partner App

Feature

Description

Priority

Onboarding & KYC

Partner registration; document upload (license, Aadhaar, vehicle RC); background check.

P0

Order Dispatch

Accept/decline assigned orders; pickup and delivery navigation via integrated maps.

P0

Earnings Tracker

Real-time earnings per trip; daily/weekly summary; incentive tracker.

P0

Availability Toggle

Go online/offline; configure preferred delivery zones.

P0

SOS & Safety

Emergency contact button; share live location with emergency contact.

P1

In-App Chat

Chat with customer for last-mile instructions; chat with support.

P1





7.4 Platform Admin Dashboard

Feature

Description

Priority

Shop Management

View, approve, suspend, or remove shops; manage KYC queue.

P0

Partner Management

Onboard, suspend, or remove delivery partners; manage incentive plans.

P0

Order Ops

Override order status; resolve disputes; manual refunds.

P0

Finance & Settlements

Reconciliation reports; payout approvals; GST reporting.

P0

Promotions Engine

Create and manage platform-wide coupons and banners.

P1

Analytics & BI

City-level GMV, orders, AOV; funnel analysis; cohort retention.

P1





8. Key User Flows

8.1 Customer Order Flow

Open app → browse or search nearby shops.

Select shop → browse catalog → add items to cart.

Proceed to checkout → confirm address → select payment.

Order placed → shop owner receives notification.

Shop accepts → prepares order → delivery partner assigned.

Customer tracks live → delivery partner picks up → delivers.

Order marked delivered → customer rates the experience.



8.2 Shop Owner Order Fulfillment Flow

Receive order notification on app/dashboard.

Review items → accept or reject (with reason) within 5 minutes.

Prepare items → mark as 'Ready for Pickup'.

Delivery partner arrives → confirm handoff via OTP or app tap.



8.3 Delivery Partner Flow

Go online → receive dispatch notification.

Accept order → navigate to shop for pickup.

Confirm pickup (OTP or scan) → navigate to customer address.

Deliver order → confirm delivery (OTP or customer tap).

Earnings credited to wallet automatically.



9. Non-Functional Requirements

Area

Requirement

Target

Performance

App load time (cold start)

< 3 seconds on 4G

Performance

Order placement to confirmation

< 5 seconds

Scalability

Concurrent active sessions

10,000+ without degradation

Availability

Platform uptime

99.9% (< 9 hrs downtime/year)

Security

Payment data

PCI-DSS Level 1 compliant

Security

User data storage

AES-256 at rest; TLS 1.3 in transit

Privacy

Data retention

PDPA/DPDP Act compliant

Localization

Language support

English + 3 regional languages (v1)

Accessibility

Screen reader & contrast

WCAG 2.1 AA





10. Technical Architecture Overview

10.1 Platform Stack

Frontend: React Native (cross-platform mobile); React.js (web dashboard).

Backend: Node.js microservices; REST + GraphQL APIs.

Database: PostgreSQL (transactional); Redis (caching & sessions); Elasticsearch (catalog search).

Real-Time: WebSockets / Firebase Realtime Database for live tracking.

Maps: Google Maps Platform (Places, Directions, Distance Matrix).

Payments: Razorpay or Stripe India.

Cloud: AWS (ECS + RDS + S3 + CloudFront) — multi-AZ deployment.

Notifications: Firebase Cloud Messaging (push) + Twilio (SMS).



10.2 Core Microservices

Auth Service — OTP login, token management, KYC status.

Catalog Service — product/shop CRUD, search indexing.

Order Service — order lifecycle state machine.

Dispatch Service — delivery partner assignment algorithm (proximity + rating + load).

Payment Service — payment initiation, webhook handling, refunds.

Notification Service — push, SMS, and in-app alerts.

Analytics Service — event tracking, aggregation, reporting.



11. Monetization Model

Revenue Stream

Description

Target Rate

Commission on Orders

Platform fee charged per order from shop

8–12% of order value

Delivery Fee

Charged to customer; partially retained by platform

₹20–₹49 per order

Subscription (Shops)

Premium shop listing & analytics (Month 6+)

₹499–₹999/month

Promoted Listings

Shops pay for top placement in discovery feed

CPM / CPC model

Customer Subscription

Monthly pass for free/discounted delivery (Month 9+)

₹99–₹149/month





12. Risks & Mitigations

Risk

Impact

Mitigation

Low shop adoption

Thin supply side → poor customer experience

Dedicated city-level onboarding team; 0% commission for first 3 months

Delivery partner supply crunch

High order TAT; cancellations

Surge incentives; partner referral bonuses

Incumbent competition (Blinkit, Zepto)

Price-sensitive market

Focus on non-grocery retail categories ignored by incumbents

Payment failures

Cart abandonment; trust erosion

Multiple payment fallbacks; COD as safety net

Data privacy breach

Regulatory and reputational damage

Quarterly security audits; bug bounty program

Fake reviews / fraud

Erosion of trust scores

ML-based fraud detection; manual review queue





13. Development Roadmap

Phase

Timeline

Key Deliverables

Phase 0 — Foundation

Months 1–2

Architecture design, design system, API contracts, KYC flow, basic shop & customer apps

Phase 1 — MVP Launch

Months 3–4

Core order flow, real-time tracking, payments, delivery partner app, admin dashboard

Phase 2 — Hardening

Month 5

Performance optimization, bug fixes, rating system, basic analytics

Phase 3 — Growth

Months 6–8

Promotions engine, shop analytics, subscription tiers, regional language support

Phase 4 — Scale

Months 9–12

City expansion playbook, B2B features exploration, customer loyalty program





14. Open Questions & Dependencies

Should NearCart employ its own delivery fleet, rely entirely on gig partners, or offer a hybrid model?

Which cities are the top 3 launch markets, and what is the go-to-market budget per city?

Is there a preferred payment gateway partner (Razorpay, PhonePe, Juspay)?

What is the KYC verification SLA — manual, automated, or third-party (DigiLocker, Aadhaar)?

Will the platform initially focus on one retail vertical (e.g., grocery only) before expanding?

Legal: What licensing is required to operate as a marketplace under India's e-commerce rules (IT Act, FDI policy)?



15. Appendix

15.1 Competitive Landscape

Platform

Primary Vertical

Gap NearCart Fills

Zomato / Swiggy Instamart

Food & fast groceries

Non-food retail (pharmacy, hardware, bakery, etc.)

Blinkit / Zepto

Dark store groceries

Existing neighborhood shops; no dark store capex

Dunzo

Multi-category hyperlocal

Better shop owner tools; richer catalog management

Urban Company

Services

Physical goods delivery; not a services marketplace





15.2 Glossary

Term

Definition





AOV

Average Order Value — total GMV divided by number of orders.





GMV

Gross Merchandise Value — total value of goods transacted on the platform.





TAT

Turnaround Time — time from order placement to delivery.





MTU

Monthly Transacting Users — unique users who complete ≥1 order in a month.





KYC

Know Your Customer — identity and document verification process.





P0 / P1 / P2

Priority tiers: P0 = must-have MVP, P1 = important, P2 = nice-to-have.









— End of Document —