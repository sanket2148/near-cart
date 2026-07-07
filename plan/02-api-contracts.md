# NearCart — API Documentation / Contracts

**Version:** 1.0 · Companion to PRD v1.0, Technical Architecture & Database Schema.

> Defines every endpoint upfront so AI tools stay consistent across sessions — they won't invent random field names or response shapes. Field names here are authoritative and match the database schema.

---

## 1. Conventions

- **Base path:** `/api/v1`. All requests/responses are JSON.
- **Auth:** `Authorization: Bearer <jwt>`. JWT carries `sub` (user id) + `roles[]`. Role enforced per endpoint.
- **Money:** integer paise.
- **IDs:** UUID strings.
- **Timestamps:** ISO 8601 UTC.
- **Idempotency:** mutations that move money/create orders accept header `Idempotency-Key`.
- **Errors:** consistent envelope (see §11). HTTP status reflects category.
- **Pagination:** `?limit=20&cursor=<opaque>`; responses return `{ data, next_cursor }`.
- **Roles tags below:** 🟢 customer · 🟠 shop_owner · 🔵 partner · 🟣 admin · ⚪ public.

---

## 2. Auth & profile

### POST /auth/otp/request ⚪
Request an OTP for a phone number.
```jsonc
// req
{ "phone": "+919876543210" }
// res 200
{ "request_id": "uuid", "expires_in": 300 }
```

### POST /auth/otp/verify ⚪
Verify OTP, create user if new, return tokens.
```jsonc
// req
{ "phone": "+919876543210", "code": "123456" }
// res 200
{
  "access_token": "jwt", "refresh_token": "jwt",
  "user": { "id": "uuid", "phone": "+91...", "full_name": null, "roles": ["customer"] },
  "is_new_user": true
}
```

### POST /auth/refresh ⚪
`{ "refresh_token" } → { access_token, refresh_token }`

### GET /auth/me 🟢🟠🔵🟣
Returns current user + roles + KYC status.

### PATCH /auth/me 🟢🟠🔵🟣
```jsonc
{ "full_name": "Priya R", "email": "priya@x.com" }
```

### POST /auth/roles 🟢
Self-onboard into a new role (e.g. apply as shop_owner / partner). Triggers KYC flow.
```jsonc
{ "role": "shop_owner" } // → { "role": "shop_owner", "kyc_status": "pending" }
```

---

## 3. Addresses 🟢

| Method | Path | Purpose |
|---|---|---|
| GET | `/addresses` | List my addresses |
| POST | `/addresses` | Add address |
| PATCH | `/addresses/{id}` | Update |
| DELETE | `/addresses/{id}` | Remove |
| POST | `/addresses/{id}/default` | Set default |

```jsonc
// POST /addresses req
{ "label":"Home","line1":"12 MG Rd","line2":null,"city":"Bengaluru",
  "pincode":"560001","lat":12.9716,"lng":77.5946,"is_default":true }
```

---

## 4. KYC 🟠🔵

### POST /kyc/documents
Upload metadata after pushing file to signed storage URL.
```jsonc
{ "doc_type": "gst", "file_path": "kyc/uuid/gst.pdf" }
// res → { "id":"uuid","doc_type":"gst","status":"submitted" }
```

### GET /kyc/documents
List my submitted docs + statuses.

---

## 5. Discovery & catalog ⚪🟢

### GET /shops/nearby ⚪
Hyperlocal discovery. Core customer entry point.
```text
?lat=12.97&lng=77.59&radius_m=5000&category=grocery&open=true&sort=distance&limit=20
```
```jsonc
// res
{ "data": [
  { "id":"uuid","name":"Ramesh Stores","category":"grocery",
    "logo_path":"...","rating_avg":4.5,"rating_count":230,
    "distance_m":820,"is_open":true,"delivery_radius_m":3000,
    "eta_minutes":25 }
], "next_cursor": null }
```

### GET /shops/{id} ⚪
Shop detail + hours + categories present.

### GET /shops/{id}/products ⚪
```text
?category=...&in_stock=true&q=milk&limit=30&cursor=...
```

### GET /search/products ⚪
Cross-shop full-text search within radius.
```text
?q=paracetamol&lat=..&lng=..&radius_m=5000
```
Returns products grouped by shop with `price_amount`, `in_stock`, `distance_m`.

---

## 6. Cart & orders 🟢

> Cart is held client-side; the server validates and prices at checkout.

### POST /orders/quote 🟢
Validate cart, compute totals, delivery fee, discount — **before** placing.
```jsonc
// req
{ "shop_id":"uuid","address_id":"uuid",
  "items":[{"product_id":"uuid","quantity":2}],
  "promo_code":"NEAR50","scheduled_for":null }
// res
{ "items_amount":24000,"delivery_amount":3000,"discount_amount":5000,
  "total_amount":22000,"eta_minutes":35,"promo_valid":true }
```

### POST /orders 🟢
Place order. Requires `Idempotency-Key`. Returns order + payment intent (unless COD).
```jsonc
// req
{ "shop_id":"uuid","address_id":"uuid",
  "items":[{"product_id":"uuid","quantity":2}],
  "payment_method":"upi","promo_code":"NEAR50","scheduled_for":null }
// res 201
{ "order": { "id":"uuid","status":"created","total_amount":22000, ... },
  "payment": { "id":"uuid","gateway_ref":"order_xyz","amount":22000,
               "method":"upi","status":"created" } }   // omitted for COD
```

### GET /orders 🟢🟠🔵
List orders scoped to caller's role (customer→own, shop→shop's, partner→assigned).
```text
?status=active|past&limit=20&cursor=...
```

### GET /orders/{id} 🟢🟠🔵🟣
Full detail: items, status, events timeline, partner info, OTPs (role-filtered).

### POST /orders/{id}/cancel 🟢
Customer cancels (only in allowed states). May trigger refund.

### GET /orders/{id}/track 🟢
Live tracking snapshot + realtime channel name.
```jsonc
{ "status":"out_for_delivery",
  "partner": { "name":"Ajay","phone_masked":"+9198****10","rating_avg":4.7,
               "lat":12.96,"lng":77.60 },
  "eta_minutes":8, "channel":"order:uuid:tracking" }
```

### POST /orders/{id}/review 🟢
```jsonc
{ "shop_rating":5,"partner_rating":5,"comment":"Fast!" }
```

---

## 7. Payments 🟢 + webhooks ⚪(signed)

### POST /payments/{id}/verify 🟢
Confirm client-side gateway success (signature check server-side).
```jsonc
{ "gateway_payment_id":"pay_xyz","gateway_signature":"..." }
// res → { "status":"captured","order_status":"paid" }
```

### POST /api/public/payments/webhook ⚪(signature-verified)
Gateway → server reconciliation. Verify signature before processing. Idempotent.
Handles: `payment.captured`, `payment.failed`, `refund.processed`.

---

## 8. Shop owner 🟠

### Catalog
| Method | Path | Purpose |
|---|---|---|
| GET | `/shop/products` | My products |
| POST | `/shop/products` | Add product |
| PATCH | `/shop/products/{id}` | Edit (price, stock toggle) |
| DELETE | `/shop/products/{id}` | Remove |
| POST | `/shop/products/bulk` | CSV bulk upload |

```jsonc
// POST /shop/products
{ "name":"Aashirvaad Atta 5kg","category_id":"uuid","price_amount":28000,
  "mrp_amount":30000,"unit":"5kg","in_stock":true,"image_path":"..." }
```

### Shop control
| Method | Path | Purpose |
|---|---|---|
| GET | `/shop` | My shop profile |
| PATCH | `/shop` | Edit profile / delivery radius |
| POST | `/shop/open` | Toggle open/closed `{ "is_open": true }` |
| GET/PUT | `/shop/hours` | Operating hours |

### Order ops
| Method | Path | Purpose |
|---|---|---|
| POST | `/shop/orders/{id}/accept` | Accept (within 5 min) |
| POST | `/shop/orders/{id}/reject` | Reject `{ "reason" }` |
| POST | `/shop/orders/{id}/ready` | Mark ready for pickup |
| POST | `/shop/orders/{id}/handoff` | Confirm pickup `{ "pickup_otp" }` |

### Money
| Method | Path | Purpose |
|---|---|---|
| GET | `/shop/earnings` | `?period=day|week` summary |
| GET | `/shop/payouts` | Settlement history |
| GET/PUT | `/shop/bank` | Bank account |

### Promotions & analytics
`POST /shop/promotions`, `GET /shop/analytics?metric=top_products|peak_hours|retention`.

### Verification 🟠
| Method | Path | Purpose |
|---|---|---|
| POST | `/shop/verification/start` | Start verification flow, select business type |
| POST | `/shop/verification/contact` | Request OTP for mobile or verification link for email |
| POST | `/shop/verification/contact/verify` | Verify contact OTP/link token |
| POST | `/shop/verification/documents` | Upload document metadata (GST, FSSAI, License, etc.) |
| POST | `/shop/verification/kyc` | Submit owner KYC details (PAN, Aadhaar) |
| POST | `/shop/verification/bank` | Add bank account details and request penny drop |
| POST | `/shop/verification/bank/verify` | Verify bank penny drop success |
| POST | `/shop/verification/gps` | Submit shop GPS coordinates and physical photos |
| POST | `/shop/verification/submit` | Submit the registration for official review |
| GET | `/shop/verification/status` | Retrieve current multi-level verification status & badge |

---

## 9. Delivery partner 🔵

| Method | Path | Purpose |
|---|---|---|
| POST | `/partner/online` | Toggle `{ "is_online": true }` |
| POST | `/partner/location` | Push location `{ "lat","lng" }` (frequent) |
| GET | `/partner/assignments` | Current offers + active |
| POST | `/partner/assignments/{id}/accept` | Accept dispatch |
| POST | `/partner/assignments/{id}/decline` | Decline |
| POST | `/partner/orders/{id}/pickup` | Confirm pickup `{ "pickup_otp" }` |
| POST | `/partner/orders/{id}/deliver` | Confirm delivery `{ "delivery_otp" }` |
| GET | `/partner/earnings` | `?period=day|week` + incentives |
| POST | `/partner/sos` | Trigger safety alert |

---

## 10. Admin 🟣

| Method | Path | Purpose |
|---|---|---|
| GET | `/admin/shops` | List/filter incl. KYC queue |
| POST | `/admin/shops/{id}/approve` / `/suspend` / `/remove` | Lifecycle |
| GET | `/admin/partners` | List partners |
| POST | `/admin/partners/{id}/approve` / `/suspend` | Lifecycle |
| GET | `/admin/orders` | All orders, filters |
| POST | `/admin/orders/{id}/status` | Override status `{ "status","note" }` |
| POST | `/admin/orders/{id}/refund` | Manual refund `{ "amount","reason" }` |
| GET | `/admin/finance/settlements` | Reconciliation |
| POST | `/admin/payouts/{id}/approve` | Approve payout |
| POST | `/admin/promotions` | Platform coupons/banners |
| GET | `/admin/analytics` | `?metric=gmv|orders|aov|funnel|cohort&city=` |

---

## 11. Error envelope

```jsonc
{ "error": {
    "code": "ORDER_INVALID_STATE",
    "message": "Order cannot be cancelled after pickup.",
    "field": null,
    "request_id": "uuid"
} }
```

| HTTP | code family | meaning |
|---|---|---|
| 400 | `VALIDATION_*` | bad input |
| 401 | `AUTH_REQUIRED` | missing/expired token |
| 403 | `FORBIDDEN_ROLE` | wrong role |
| 404 | `NOT_FOUND` | resource missing/not owned |
| 409 | `CONFLICT_*` / `ORDER_INVALID_STATE` | state/idempotency conflict |
| 422 | `BUSINESS_RULE_*` | e.g. shop closed, out of radius |
| 429 | `RATE_LIMITED` | OTP/abuse throttling |
| 500 | `INTERNAL` | unexpected |

---

## 12. Realtime channels

| Channel | Subscriber | Payload |
|---|---|---|
| `order:{id}:tracking` | customer | partner lat/lng + status + ETA |
| `order:{id}:status` | customer, shop | status transitions |
| `partner:{id}:dispatch` | partner | new assignment offers |
| `shop:{id}:orders` | shop | incoming orders |

---

## 13. Rules for AI sessions

1. Never invent field names — use the ones here (they match the DB schema).
2. Status changes only via the dedicated endpoints, never direct DB writes from clients.
3. Money endpoints require `Idempotency-Key`.
4. Always verify webhook signatures before trusting payloads.
5. Respect role tags — enforce server-side, never trust client role claims.
