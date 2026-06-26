# NearCart — Android App

A standalone native Android client for **NearCart** (*Connecting Retail Shops to
Customers — like Zomato, for every store*). Built with **Kotlin + Jetpack
Compose** and **Material 3**, matching the branding and core experience of the
NearCart web app.

This project is fully independent of the web application. The web app is
unchanged — nothing here imports from or modifies it.

---

## Open & run

1. Open **Android Studio** (Hedgehog or newer) → **Open** → select the
   `android_app/` folder.
2. Let Gradle sync. Android Studio will provision the Gradle wrapper
   automatically. (If you build from the CLI, run `gradle wrapper` once to
   generate `gradle/wrapper/gradle-wrapper.jar`, then use `./gradlew`.)
3. Pick an emulator/device and press **Run ▶**.

- **Min SDK:** 24 · **Target/Compile SDK:** 34 · **JDK:** 17
- **Package:** `com.nearcart.app`

---

## Architecture (MVVM)

```
com.nearcart.app
├── models      # Data classes (Shop, Product, Order, ...) — match web JSON shape
├── network     # Retrofit ApiService + RetrofitClient (auth interceptor)
├── repository  # NearCartRepository + bundled MockData fallback
├── viewmodel   # Home / Shop / Cart / Orders ViewModels (StateFlow)
├── ui          # Compose screens, components, navigation, theme
└── utils       # SessionManager (auth token), formatters
```

- **UI** observes **ViewModels** (`StateFlow`), which call the **Repository**.
- The **Repository** calls the **network** layer, transparently falling back to
  `MockData` when the backend is offline (see "Backend" below).

## Branding

Theme tokens are converted from the web app's oklch design system
(`src/styles.css`):

| Token       | Web (oklch)              | Android (hex) |
|-------------|--------------------------|---------------|
| Primary     | `oklch(0.62 0.15 152)`   | `#259F56`     |
| Accent      | `oklch(0.72 0.17 55)`    | `#F3821D`     |
| Background  | `oklch(0.99 0.006 120)`  | `#FBFCF8`     |
| Foreground  | `oklch(0.22 0.03 160)`   | `#0D1F16`     |

Typography targets **Plus Jakarta Sans** (matching the web). Drop the font files
into `app/src/main/res/font/` and wire them into `Type.kt` for a pixel-exact
match; the platform sans-serif is used as a fallback today.

## Features (parity with web buyer app)

- Discovery home with location, search bar, categories, nearby shops
- Search across shops / products / areas
- Shop detail with product list and add-to-cart
- Single-shop cart rule (adding from another shop resets the cart)
- Checkout: address, payment method, price breakdown, place order
- Orders list and order detail with a 5-step status timeline
  (Placed → Accepted → Preparing/Ready → Out for Delivery → Delivered)

---

## Backend — required changes (not applied automatically)

The web app currently ships **mock/local data** (no live REST backend yet), so
this Android app uses the same bundled mock catalog via `MockData`. To connect
both clients to a real backend, the following is needed **on the backend side**:

1. Expose REST endpoints matching `network/ApiService.kt`:
   - `GET  /api/categories`
   - `GET  /api/shops`
   - `GET  /api/shops/{shopId}`
   - `GET  /api/shops/{shopId}/products`
   - `GET  /api/orders`
   - `POST /api/orders`
2. Add an **auth endpoint** issuing a bearer token (JWT/session). The app
   already attaches `Authorization: Bearer <token>` via `RetrofitClient` and
   persists it through `SessionManager`.
3. Enable CORS / mobile access as appropriate.

Once available:
- Set the real base URL in `app/build.gradle.kts` (`API_BASE_URL`).
- Flip `useRemote = true` in `NearCartApplication` to use live data
  (automatic mock fallback remains for offline resilience).

No UI or ViewModel changes are required for the switch.
