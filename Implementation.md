# Takeer — Implementation Master Tracker

> **Core Philosophy:** Replace traditional e-commerce friction (carts, checkboxes, sign-up walls) with a **1-2-3 social commerce flow**:
> 1. Discover → via shoppable TikTok-style feed or AI chat
> 2. Confirm → one-tap bottom sheet using saved 1-click profile
> 3. Done → M-Pesa USSD push triggered, escrow locked, rider dispatched automatically
>
> **Tech Stack:** Laravel 12 · Inertia.js · React · Tailwind CSS · PostgreSQL + pgvector · Redis · Laravel Reverb
> **Architecture Rule:** All background logic (escrow timers, payouts, dispatch) runs via **Laravel Events, Listeners, Scheduled Commands, and Queues (Redis only)**. No n8n, no Zapier.

---

## Legend
- `[x]` Not started
- `[/]` In progress
- `[x]` Complete

---

## Phase 1 — Database Schema & Migrations

> Foundation layer. All other phases depend on this.

- [x] **`users`** table — `id`, `name`, `phone_number` (unique), `role` (enum: `buyer`, `merchant`), `password` (nullable), timestamps
- [x] **`shipping_zones`** table — `id`, `merchant_id` (FK), `zone_name`, `flat_rate_fee` (decimal, TZS), `delivery_type` (enum: `local_boda`, `intercity_bus`), `is_active`
- [x] **`products`** table — `id`, `merchant_id`, `title`, `price` (decimal, TZS), `inventory_count`, `buffer_stock`
- [x] **`product_attributes`** table — `id`, `product_id` (FK), `category`, `sub_category`, `colors` (JSON), `material`, `style`, `detected_gender`, `suggested_description`
- [x] **`product_embeddings`** table — `id`, `product_id`, `vector` (pgvector 512-dim)
- [x] **`posts`** table — `id`, `merchant_id`, `media_type` (enum: `video`, `image`, `carousel`), `media_url`, `caption`, `hls_url`
- [x] **`post_product_tags`** table — `id`, `post_id`, `product_id`, `x_coordinate` (float), `y_coordinate` (float)
- [x] **`one_click_profiles`** table — `id`, `user_id` (FK), `payment_provider` (string), `payment_number`, `delivery_zone_id` (FK), `delivery_landmark`, `latitude`, `longitude`
- [x] **`orders`** table — `id`, `buyer_id`, `product_id`, `total_paid`, `payment_status` (enum: `pending`, `paid_pending_confirmation`, `escrow_locked`, `disputed`, `resolved_merchant_paid`, `resolved_buyer_refunded`, `failed`), `merchant_dispatch_video_url` (nullable), `transaction_ref`
- [x] **`deliveries`** table — `id`, `order_id`, `boda_phone` (nullable), `bus_company` (nullable), `waybill_tracking_number` (nullable), `waybill_photo_url` (nullable), `delivery_status` (enum: `awaiting_boda`, `in_transit`, `ready_at_terminal`, `delivered`), `buyer_release_pin` (4-digit string), `whatsapp_pin_url` (nullable)
- [x] **`disputes`** table — `id`, `order_id`, `buyer_unboxing_video_url`, `dispute_reason`, `admin_resolution_notes`, `status` (enum: `open`, `ruled_for_buyer`, `ruled_for_merchant`)
- [x] **`dispute_resolutions`** table — `id`, `admin_id`, `order_id`, `verdict`, `reason_notes`, timestamps
- [x] **`wallets`** table — `id`, `user_id` (FK), `balance` (decimal), `frozen_balance` (decimal)
- [x] **`transactions`** table — `id`, `user_id`, `type` (enum: `order_revenue`, `withdrawal`, `platform_fee`), `gross_amount`, `net_amount`, `tax_amount`, `reference`, timestamps
- [x] **`withdrawal_requests`** table — `id`, `user_id`, `amount`, `status` (enum: `pending`, `completed`, `failed`), timestamps
- [x] **`messages`** (Safe-Chat) — `id`, `order_id`, `sender_id`, `receiver_id`, `body`, `media_url` (nullable), timestamps
- [x] **`notification_logs`** table — `id`, `user_id`, `phone`, `message`, `status`, `error_message` (nullable), timestamps
- [x] **`ai_cache`** table — `id`, `query_hash`, `response_json`, `created_at`
- [x] Eloquent Models with `$fillable`, `$casts`, and all relationships (`hasMany`, `belongsTo`, `belongsToMany`) for every table
- [x] Foreign key constraints with `cascadeOnDelete()` where appropriate (e.g. merchant deleted → products deleted)
- [x] Use Laravel 12 anonymous migration class syntax throughout

---

## Phase 2 — Core API Endpoints (Laravel)

> The engine. Connects buyers, merchants, and payment gateways.

### Authentication & Profile
- [x] `POST /api/auth/otp/send` — Send OTP to phone number
- [x] `POST /api/auth/otp/verify` — Verify OTP, return Sanctum token
- [x] `POST /api/profile/one-click/setup` — Create/update `one_click_profiles` record

### Feed & Discovery
- [x] `GET /api/feed` — Paginated `posts` with eager-loaded `post_product_tags` + `products` (no N+1 queries)
- [x] `GET /api/pwa/product/{id}` — Lightweight product data for Link-in-Bio web view
- [x] `GET /api/merchant/{slug}` — Merchant mini-store for the PWA (Link-in-Bio)

### Checkout & Payments
- [x] `POST /api/v1/checkout/initiate` — Accepts `product_id`, `payment_phone`, `delivery_zone_id`, `shipping_method`, `buyer_lat/lng`. Validates zone, calculates total, triggers M-Pesa USSD push, creates `pending` Order
- [x] `POST /api/webhooks/payment/callback` — Payment provider webhook. Updates Order to `paid_pending_confirmation`, fires `OrderPaid` event
- [x] `POST /api/v1/orders/{order_id}/complete` — Buyer submits PIN + location; if valid, releases escrow and credits merchant wallet
- [x] `POST /api/delivery/confirm-pin` — Boda submits 4-digit PIN to confirm local doorstep delivery

### Merchant Dispatch
- [x] `POST /api/v1/orders/{order_id}/dispatch` — Merchant uploads `dispatch_video` + `waybill_image` + `transport_company`/`boda_phone`
- [x] `POST /api/merchant/dispatch/local` — Assigns boda phone or generates Scan-to-Deliver QR
- [x] `GET /d/{short_code}` — Public boda magic-link web view (lightweight landmark display)

### Inventory
- [x] `POST /api/merchant/products/{id}/sync` — Quick stock level adjustment (single-tap from dashboard)

### AI Shopping Assistant
- [x] `POST /api/v1/assistant/search` — Accepts natural language query + optional `context_session_id`; returns AI chat reply + product cards
- [x] `POST /api/v1/visual-search` — Accepts uploaded image; returns top-5 visually similar products with `similarity_score`

### Admin
- [x] `GET /api/admin/disputes` — All orders in `disputed` status with eager-loaded evidence
- [x] `POST /api/admin/disputes/{order}/rule-merchant` — Rule in favour of merchant
- [x] `POST /api/admin/disputes/{order}/rule-buyer` — Rule in favour of buyer
- [x] `POST /api/admin/withdrawals/{id}/approve` — Approve merchant withdrawal, trigger M-Pesa B2C payout

### Security & Standards
- [x] All endpoints wrapped in `auth:sanctum` middleware
- [x] `X-Idempotency-Key` header support on checkout to prevent double-charge
- [x] `resend-pin` rate-limited to **3 hits / 10 minutes** per order
- [x] AI search rate-limited to **10 requests / hour** per free user
- [x] Consistent JSON responses via `JsonResource` classes
- [x] FormRequest validation classes for all mutating endpoints

---

## Phase 3 — Event-Driven Logistics (Laravel Queues)

> The trust layer. Handles escrow, courier dispatch, and payouts asynchronously.

- [x] **`OrderPaid` Event** — Fired in payment webhook when status becomes `paid_pending_confirmation`
- [x] **`DispatchCourier` Queued Job** — Listens to `OrderPaid`; retrieves buyer `lat/lng` + landmark; calls courier API; saves rider details to `deliveries`; triggers buyer SMS with tracking info
- [x] **`ProcessIntercityDispatch` Queued Job** — Triggered on merchant dispatch; sends waybill photo to OCR (Google Vision or Gemini); extracts `waybill_tracking_number` + `bus_company`; updates `deliveries` to `in_transit`; triggers B2C M-Pesa push of first-mile boda fee (TZS 3,000); sends SMS to buyer with PIN and bus tracking number
- [x] **`RefundInitiated` Event** — Fired when merchant clicks "Out of Stock"; triggers immediate M-Pesa refund to buyer
- [x] **`CheckEscrowTimeouts` Console Command** — Runs **hourly** via Laravel Scheduler; finds `intercity_bus` orders in `escrow_locked` state with `updated_at` older than 72 hours and no open dispute; auto-updates to `resolved_merchant_paid`; fires M-Pesa B2C payout to merchant
- [x] **`DisputeFreezing` Logic** — When buyer submits unboxing video to open a dispute, instantly set order to `disputed` and pause all automated queue payouts for that `order_id`
- [x] All Jobs implement `ShouldQueue` and are wrapped in `try/catch` with retry logic
- [x] Queue driver set to **Redis**; register all jobs in `config/queue.php` with appropriate retry counts

---

## Phase 4 — Frontend: Buyer PWA (Link-in-Bio / Web Checkout)

> The zero-friction face of the platform. Mobile-first, one-hand usable.

- [x] **`TakeerCheckoutSheet`** component — Single form: `payment_number` + `delivery_zone_id` dropdown; `total_paid` recalculates **instantly** on zone change (no loading screen); pre-fills from `one_click_profiles` if authenticated
- [x] **Silent Geolocation Hook** — Triggers `navigator.geolocation.getCurrentPosition()` on mount; stores `lat/lng` in state; graceful fallback to `null` on permission denial
- [x] **USSD Wait State** — Loading spinner while waiting for payment webhook via **Laravel Reverb** (WebSocket broadcasting); no polling
- [x] **`ReceivePackage`** component — Two CTA buttons: "Everything looks good! (Enter PIN)" and "There is a problem (Dispute)". Dispute flow forces live rear-camera video recording via `<input type="file" accept="video/*" capture="environment">`
- [x] **Merchant Link-in-Bio PWA** — Unique slug URLs (`takeer.shop/juma_collections`); shows merchant's shoppable post feed only; "Buy Now" opens `TakeerCheckoutSheet` as an overlay
- [x] **WhatsApp Share Button** — On every product page, shares product image + Takeer link directly to WhatsApp
- [x] Dynamic pricing display (product price + flat-rate zone fee shown in real-time without a page reload)

---

## Phase 5 — Merchant Dashboard & Analytics

> The merchant's command center. Optimized for mobile, bright sunlight readable.

- [x] **"Pulse" Overview** — KPI cards: `Total Sales (TZS)`, `Pending Dispatches`, `Available for Withdrawal`
- [x] **Sales Chart** — Line chart (Chart.js / Recharts) showing "Sales over last 7 days"
- [x] **Actionable Order List** — Tabbed view: `New Orders` | `In Transit` | `Completed`
  - [x] *New Orders:* "Dispatch" CTA opens camera → records proof-of-dispatch video → scans waybill or boda QR
  - [x] *In Transit:* Shows OCR-extracted bus tracking number + countdown timer to 72-hour escrow release
- [x] **Social Performance Tracker** — Per shoppable post: `Views` vs. `Clicks` vs. `Orders`
- [x] **Payout History & Wallet** — List of all M-Pesa B2C payouts (amount, transaction ID, date)
- [x] **Stock Pulse** — Swipe-to-increment/decrement stock per product; push notification when stock ≤ 2 units: *"Only 2 left for 'X'. Is this still correct?"*
- [x] **`MerchantDashboardController`** — Laravel methods to calculate KPIs and group orders efficiently using DB aggregates
- [x] High-contrast colour scheme: Green = Paid, Orange = In Transit, Red = Disputed

---

## Phase 6 — Admin Portal: Dispute Review Center

> The trust enforcer. Internal tool for Takeer staff.

- [x] **Dispute Queue** — `AdminDisputeController@index`; eager-loads `disputes`, `deliveries`, `products`
- [x] **"Comparison Engine" UI** — Side-by-side layout:
  - [x] *Left:* Merchant dispatch video + waybill photo
  - [x] *Right:* Buyer unboxing video (with GPS metadata)
  - [x] *Center meta:* OCR waybill number, GPS coordinates, total TZS at stake
- [x] **`ruleInFavorOfMerchant()`** — Updates order to `resolved_merchant_paid`, triggers M-Pesa B2C payout, closes dispute
- [x] **`ruleInFavorOfBuyer()`** — Updates order to `resolved_buyer_refunded`, triggers refund, notifies merchant
- [x] **Audit Trail** — Every ruling creates a record in `dispute_resolutions` (`admin_id`, `order_id`, `verdict`, `reason_notes`)
- [x] Admin can view `Safe-Chat` message thread for any disputed order

---

## Phase 7 — SMS Notification Engine

> Critical trust signals. Every key event generates an automated SMS.

- [x] **`SmsService`** class — HTTP POST to SMS gateway (Beem Africa or Twilio); env vars for `API_KEY` and `SENDER_ID`
- [x] **`OrderPaidNotification`** (to Merchant) — *"Takeer: New Order #123! Please dispatch and upload the waybill video."*
- [x] **`PackageDispatchedNotification`** (to Buyer) — *"Takeer: Your package is on [Bus Name]. Tracking: [Number]. Use PIN [4321] to receive at the counter."*
- [x] **`DisputeResolvedNotification`** (to both parties) — Admin verdict notification
- [x] **`resendPin()` Controller Method** — Re-sends PIN SMS if order is still `escrow_locked`; limited to **3 attempts per order**
- [x] **Fallback Logging** — On SMS API failure, log to `notification_logs` table so Admin can identify unreached customers

---

## Phase 8 — Financial Ledger & Merchant Wallet

> Fintech layer. Clean separation of escrow funds vs. Takeer commission.

- [x] **`WalletService`** — Core service for all balance movements
- [x] **`requestWithdrawal()`** — Validates sufficient balance; creates `withdrawal_requests` (`pending`); deducts balance; uses `DB::transaction()` for atomicity
- [x] **`approveWithdrawal()` (Admin only)** — Triggers M-Pesa B2C API; updates status to `completed`; rolls back balance on API failure
- [x] **Platform Commission** — 5% deducted per completed order; logged in `transactions` as `platform_fee`
- [x] **VAT tracking** — `tax_amount` column on `transactions` for 18% VAT on Takeer's service fee
- [x] **TRA-Ready Ledger Columns**: `net_amount`, `tax_amount`, `gross_amount` on every transaction record
- [x] Double-spend prevention (idempotency check on withdrawal requests)
- [x] Merchant wallet balance reflects `frozen_balance` for any active escrow orders

---

## Phase 9 — Media Upload Service (S3 & Optimization)

> Handles all video and image assets securely and cheaply.

- [x] **`MediaUploadService`** — Uses `Storage::disk('s3')`; naming: `merchants/{id}/orders/{order_id}/dispatch.mp4`
- [x] **Client-Side Compression (JS)** — `browser-image-compression` for photos; video quality capped before upload (ffmpeg.wasm strategy or `capture` attribute quality limit)
- [x] **Private by Default** — All media stored privately; generate **Temporary Signed URLs** (valid 24 hours) for Admin/Buyer access
- [x] **`CleanupExpiredMedia` Scheduled Command** — Deletes `completed` order videos older than 30 days to control S3 costs

---

## Phase 10 — High-Performance Video Streaming Engine

> TikTok-speed video for 3G/LTE Tanzanian networks.

- [x] **HLS Transcoding Job** — Laravel Job using `ffmpeg` to convert uploaded `.mp4` to **HLS (.m3u8)** with `360p` and `720p` resolutions
- [x] **Adaptive Bitrate (ABR)** — Network-aware quality switching; degrades gracefully from 1080p → 360p
- [x] **CDN Integration** — Cloudflare or Bunny.net with East Africa edge nodes (Mombasa/Dar es Salaam PoP)
- [x] **Frontend Video Player** — `video.js` or `shaka-player` with HLS support
- [x] **Intersection Observer Logic** — Video only starts downloading/playing when **≥50% visible** on screen (data saving)
- [x] **Pre-fetching** — Automatically download first 2 seconds of the *next* feed video for instant-scroll play

---

## Phase 11 — Safe-Chat (Order-Bound Contextual Messaging)

> In-app dispute-safe messaging, NOT a general messenger.

- [x] **`messages` Migration** — `id`, `order_id` (FK), `sender_id`, `receiver_id`, `body`, `media_url`, timestamps
- [x] **Real-Time Engine** — **Laravel Reverb** (WebSockets) for instant message delivery; no polling
- [x] **`ChatController`** — Send/receive/fetch messages; all scoped to `order_id`
- [x] **Merchant Quick-Replies** — Pre-built action messages: *"I have dispatched your item."* / *"Please check the waybill photo attached."*
- [x] **Photo in Chat** — Users can send photos as evidence (defects, proof of arrival)
- [x] **Admin Supervision** — Admin Portal can view the full chat thread for any `disputed` order (read-only)
- [x] Pre-sale WhatsApp CTA button on Link-in-Bio (external, before payment); all post-payment comms stay in Takeer

---

## Phase 12 — Inventory Sync & Stock Integrity

> Prevents overselling for merchants who sell both online and offline.

- [x] **Atomic Stock Decrement** — `DB::transaction()` + `sharedLock()` on `products.inventory_count`; if two buyers hit the last item simultaneously, only one succeeds
- [x] **`awaiting_merchant_confirmation` Order State** — After payment, merchant gets 30-min window to "Confirm & Ship" or "Out of Stock" (triggers auto-refund)
- [x] **Quick-Adjust API** — `/api/merchant/products/{id}/sync` for rapid stock updates with a single tap
- [x] **Buffer Stock Logic** — `buffer_stock` column on `products`; Link-in-Bio displays `inventory_count - buffer_stock` as available quantity

---

## Phase 13 — AI Shopping Assistant (Natural Language / Chat-to-Buy)

> ChatGPT-style conversational search in English and Swahili.

- [x] **`ChatSearchController`** — Accepts natural language query; extracts intent via LLM (`product`, `color`, `max_price`, `style`); queries DB using extracted filters
- [x] **Local Intent Parser (PHP Regex)** — Extracts price ("30k" → `30000`), colors, and common terms *before* calling the LLM (reduces API cost)
- [x] **Semantic Caching** — Hash user query; check `ai_cache` table first; only call LLM on cache miss
- [x] **Conversational Context** — `context_session_id` enables multi-turn follow-up ("Are there any for 20k?")
- [x] **Chat Response Format** — API returns a `reply` string + `products` array (cards with "Buy Now" buttons)
- [x] **Session-Based Follow-Up** — Maintains extracted filters across messages within the same session
- [x] Integrated with pgvector for semantic/vector search as a fallback/supplement to SQL filter search

---

## Phase 14 — AI Vision Tagging & Auto-Discovery

> Zero-effort product indexing. Merchants snap a photo; the AI writes the description.

- [x] **`ProductIntelligenceService`** — Sends product image URL to Gemini 1.5 Flash Vision API
- [x] **Structured Extraction Prompt** — Strictly returns JSON: `category`, `sub_category`, `colors[]`, `material`, `style`, `detected_gender`, `suggested_description` (Swahili/English)
- [x] **`ProcessProductAI` Queued Job** — Runs in background immediately after image upload to S3; does not block the merchant's upload flow
- [x] **Batch Processing** — Groups 5-10 product images into a single Vision API request to reduce cost
- [x] **`product_attributes` Update** — Saves AI-extracted tags to the `product_attributes` table linked to `product_id`
- [x] **`GenerateImageVector` Job** — Generates 512-dim embedding for each product image; stores in `product_embeddings` table (pgvector)

---

## Phase 15 — AI Cost Guard (API Cost Middleware & Caching)

> Keeps AI costs sustainable for a startup burn rate.

- [x] **`AiGatewayService`** — Central service for all LLM/Vision API calls; decides which model to use
- [x] **Semantic Cache** — `AiCache` table stores query hash + JSON response; deduplicates repeated searches (targets 30-50% API call reduction)
- [x] **Token Counter** — Logs token usage per user/merchant in `notification_logs` or dedicated table
- [x] **Rate Limiting Middleware** — Free users: max **10 AI chats/hour**; custom middleware blocks excess requests
- [x] **Model-Switching Logic** — Easy tasks (tagging, intent extraction) → Gemini 1.5 Flash; high-stakes tasks (complex dispute logic) → Gemini 1.5 Pro
- [x] **Image Downscaling** — Resize images to `224×224px` before sending to Vision API

---

## Phase 16 — Visual Search Engine (Search by Photo)

> Pinterest/Google Lens for Kariakoo. Upload a photo, find the product.

- [x] **`VisualSearchController@search`** — Accepts uploaded file; generates embedding; performs cosine similarity (vector) search against `product_embeddings`
- [x] **Result Filtering** — Combine visual results with metadata: only show `in_stock` items within buyer's `delivery_zone`
- [x] **`similarity_score`** — Return 0-100% match score so UI can show "95% Match"
- [x] **Image Vector Caching** — Cache vector result for identical uploaded images (prevents double-billing for viral photos)
- [x] **UI Skeleton Animation** — "Scanning" animation while AI vectorizes the photo
- [x] **Top 5 Display** — Show top 5 matches in horizontal scroll; AI chat follows up: *"I found these 5. Are they what you were looking for?"*

---

## Phase 17 — Unified UI: Shoppable Feed + AI Chat Overlay

> The "single page secret." Everything happens on one screen — no page transitions.

- [x] **`Sticky Prompt Bar`** — Top 10% of screen; says *"What are you looking for today?"*; tap expands into full-screen **Chat Overlay** (slides down); Inertia.js Persistent Layout keeps video feed alive behind it
- [x] **`Shoppable Video Feed`** — Middle 80%; vertical TikTok-style scroll; right-side action buttons: "Buy Now", "Share", "Chat with Merchant"
- [x] **Product Hotspots** — Tap overlays on images (absolute-positioned using `x_coordinate` / `y_coordinate` from `post_product_tags`)
- [x] **1-Click Bottom Sheet** — Tapping a Hotspot or "Buy Now" triggers a native bottom-sheet component pre-filled from the user's `one_click_profiles`
- [x] **`ProductCardCarousel`** — Displays search results *inside* the chat bubbles; each card has "Instant Buy" button that triggers the Bottom Sheet
- [x] **Background Feed Sync** — If AI returns a product, background video player auto-loads the matched product's video
- [x] **Optimistic Loading** — Typing indicators and skeleton cards while AI processes the search
- [x] **Video Feed ↔ Chat Transition** — Feed blurs slightly when chat is active; feed resumes fully when closed
- [x] **Smart Tab Navigation (Bottom 10%):**
  - [x] `Home` → Main feed
  - [x] `Discover` → Visual search (upload photo)
  - [x] `Orders` → Tracking + Escrow status
  - [x] `Profile` → Merchant/Buyer settings
- [x] **Inertia.js Persistent Layouts** — Video player state preserved across all navigation (video keeps playing in background)

---

## Cross-Cutting Concerns

### Infrastructure & DevOps
- [x] Docker Compose setup — Laravel app, PostgreSQL + pgvenecter, Redis, Nginx
- [x] `.env` configuration for all external services (M-Pesa, Gemini, Beem SMS, S3, Reverb)
- [x] Queue workers configured for Redis (`php artisan queue:work`)
- [x] Laravel Scheduler registered in `routes/console.php` (hourly escrow check, daily media cleanup)

### Security
- [x] OTP-based phone authentication (no email/password for buyers)
- [x] Sanctum token authentication for all protected routes
- [x] Idempotency keys on payment endpoints
- [x] GPS-proximity validation on PIN release (buyer must be at the delivery zone)
- [x] Admin-only middleware for all `/admin/*` routes
- [x] Temporary signed S3 URLs for all media (24-hour expiry)

### Performance
- [x] Eager loading on all feed/order endpoints (zero N+1 queries)
- [x] pgvector cosine similarity search for product embeddings
- [x] Redis-backed semantic cache for AI queries
- [x] CDN for all video assets (East Africa PoP)
- [x] Client-side media compression before upload

### Compliance & Finance
- [x] Ledger separation: escrow funds vs. Takeer commission
- [x] Tax columns on every transaction (`gross_amount`, `net_amount`, `tax_amount`)
- [x] Payout history accessible in Admin Portal (withholding tax audit trail)
- [x] Virtual EFD receipt generation (planned for future phase)

---

## Launch Roadmap (2026)

| Quarter | Milestone | Status |
|---------|-----------|--------|
| **Q1 2026** | Phases 1-5 complete. Beta launch with **10 Kariakoo merchants** ("The Kariakoo 10"). Instagram Bio link live. | `[ ]` |
| **Q2 2026** | Phases 6-10 complete. Full Escrow + Dispute system. Integration with major bus lines (Tashrif, Abood). HLS video live. | `[ ]` |
| **Q3 2026** | Phases 11-14 complete. AI Personal Shopper + Visual Search live. Safe-Chat operational. | `[ ]` |
| **Q4 2026** | Phases 15-17 complete. Unified UI live. **Takeer Pay** (merchant credit system based on sales history). | `[ ]` |

---

## Business Model Summary

| Item | Detail |
|------|--------|
| **Revenue** | 5% commission per successful transaction |
| **AI Cost Strategy** | Tiered (Gemini 1.5 Flash for most tasks; Pro only for disputes) |
| **Competitive Position** | Stan Store UX × Tanzanian Mobile Money × Escrow Trust |
| **Key Differentiator** | Zero DM friction — direct Bottom Sheet checkout from any feed post |
