
> ### **Project Overview: Takeer - Omnichannel Social Commerce Platform**
> 
> 
> **Tech Stack:** Laravel (Backend/API/Queues), Redis (Queue Driver), Flutter or React Native (Native Merchant App), React/Vue or Blade (PWA for Link-in-Bio).
> **Core Concept:** A frictionless, "Stan Store-style" checkout for physical goods in Tanzania. Features 1-click Mobile Money (M-Pesa/Tigo Pesa) checkouts, mixed-media shoppable social feeds, and a localized escrow system.
> **Strict Architectural Rule:** All background automation, timers, and workflow routing must be handled strictly using Laravel's native Events, Listeners, Scheduled Tasks, and Queues (e.g., Redis). **Do not use external workflow tools like n8n or Zapier under any circumstances.**
> ---
> 
> 
> ### **Phase 1: Database Schema & Migrations**
> 
> 
> Generate Laravel migrations and Eloquent models for the following structure.
> **1. `users` (Buyers & Merchants)**
> * `id`, `name`, `phone_number` (unique), `role` (enum: `buyer`, `merchant`), timestamps.
> 
> 
> **2. `shipping_zones` (Local & Intercity Matrix)**
> * `id`, `merchant_id` (foreign key), `zone_name` (e.g., "Kinondoni", "Singida - Bus"), `flat_rate_fee` (decimal, TZS), `delivery_type` (enum: `local_boda`, `intercity_bus`).
> 
> 
> **3. `products` & `posts` (Inventory & Social Feed)**
> * `products`: `id`, `merchant_id`, `title`, `price` (decimal, TZS), `inventory_count`.
> * `posts`: `id`, `merchant_id`, `media_type` (enum: `video`, `image`, `carousel`), `media_url`, `caption`.
> * `post_product_tags`: `id`, `post_id`, `product_id`, `x_coordinate`, `y_coordinate`.
> 
> 
> **4. `one_click_profiles` (The "Lazy Capture")**
> * `id`, `user_id`, `payment_provider` (string), `payment_number` (string), `delivery_zone_id` (foreign key), `delivery_landmark` (string), `latitude`, `longitude` (captured via HTML5 GPS).
> 
> 
> **5. `orders` (Escrow & Transactions)**
> * `id`, `buyer_id`, `product_id`, `total_paid`, `payment_status` (enum: `pending`, `escrow_locked`, `disputed`, `resolved_merchant_paid`, `resolved_buyer_refunded`), `merchant_dispatch_video_url` (string, nullable).
> 
> 
> **6. `deliveries` (Logistics State Machine)**
> * `id`, `order_id`, `boda_phone` (string, nullable), `bus_company` (string, nullable), `waybill_tracking_number` (string, nullable), `waybill_photo_url` (string, nullable), `delivery_status` (enum: `awaiting_boda`, `in_transit`, `ready_at_terminal`, `delivered`), `buyer_release_pin` (4-digit string).
> 
> 
> **7. `disputes` (Fraud Management)**
> * `id`, `order_id`, `buyer_unboxing_video_url`, `dispute_reason`, `admin_resolution_notes`, `status` (enum: `open`, `ruled_for_buyer`, `ruled_for_merchant`).
> 
> 
> ---
> 
> 
> ### **Phase 2: Core API Endpoints (Laravel)**
> 
> 
> **Feed & Checkout (PWA):**
> * `GET /api/feed` -> Returns paginated `posts` with nested `post_product_tags` and `products`.
> * `POST /api/checkout/initiate` -> Accepts `product_id` and buyer's zone. Calculates total, triggers Mobile Money USSD push API. Creates `pending` Order.
> 
> 
> **Logistics & Dispatch:**
> * `POST /api/merchant/dispatch/local` -> Merchant assigns a boda phone number or generates a "Scan-to-Deliver" QR code payload.
> * `POST /api/merchant/dispatch/intercity` -> Merchant uploads the 5-sec dispatch video and the photo of the printed bus waybill.
> 
> 
> **The Boda "Magic Link":**
> * `GET /d/{short_code}` -> Public, lightweight web view for the boda to see the drop-off landmark.
> * `POST /api/delivery/confirm-pin` -> Boda submits the 4-digit buyer PIN to release local funds.
> 
> 
> ---
> 
> 
> ### **Phase 3: Asynchronous Logic & Queues**
> 
> 
> **1. Intercity Waybill Processing (The OCR Job):**
> * When `POST /api/merchant/dispatch/intercity` is hit, dispatch a `ProcessWaybillOCR` job.
> * Send the uploaded waybill photo to Google Cloud Vision API. Extract the `waybill_tracking_number` and `bus_company`.
> * Update `deliveries` table. Instantly push the first-mile delivery fee (e.g., TZS 3,000) to the merchant's local boda via B2C M-Pesa API.
> * Send SMS to buyer: *"Package on bus. Show tracking [number] at terminal. Reply to this SMS with PIN [1234] when received."*
> 
> 
> **2. The 72-Hour Escrow Clock (Scheduled Task):**
> * Create a Laravel Console Command (`php artisan escrow:check-timeouts`) running hourly.
> * Find all orders where `delivery_type` is `intercity_bus`, status is `escrow_locked`, and `updated_at` is older than 72 hours.
> * If the buyer hasn't replied with the PIN or opened a dispute, auto-update status to `resolved_merchant_paid` and trigger the M-Pesa B2C payout to the merchant.
> 
> 
> **3. Dispute Freezing:**
> * If a buyer submits an "At the Counter" unboxing video via the PWA link, instantly update order status to `disputed`. Pause all automated queue payouts for this `order_id` until Admin review.
> 
> 
> ---
> 
> 
> ### **Phase 4: Frontend Flow Requirements**
> 
> 
> **Buyer PWA Checkout:**
> * Must use HTML5 Geolocation API silently to capture Lat/Lng on the single-field checkout form.
> * Display dynamic pricing instantly when the user changes the `delivery_zone_id` dropdown (no loading screens).
> 
> 
> **Merchant Native App:**
> * **Upload Flow:** 3 taps. Select media -> Tap screen to add Hotspot -> Link Product -> Publish.
> * **Dispatch Flow:** App must prompt the merchant to record a 5-second video (showing the item going into the box) *before* unlocking the camera to scan the waybill or the boda's QR code.
> 
> 
> **Buyer Receive Flow:**
> * The SMS tracking link opens a web page with two buttons: 1. "Enter PIN" (Releases funds). 2. "Report Issue" (Mandates an immediate video upload using the `<input type="file" accept="video/*" capture="environment">` HTML attribute to force live camera recording at the bus terminal).
> 
> 