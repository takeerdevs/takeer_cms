Project will use laravel 12, Inertia.js, React, Tailwind CSS, and PostgreSQL with pgvector extension.

> ### **Project Overview: Takeer - Omnichannel Social Commerce Platform**
> 
> 
> **Tech Stack:** Laravel (Backend/API/Queues), Redis (Queue Driver), Flutter or React Native (Native App), React/Vue or Blade (PWA for Link-in-Bio).
> **Core Concept:** A frictionless, "Stan Store-style" checkout for physical goods. Features strict geo-fenced delivery, mixed-media shoppable social feeds, and instant mobile money checkout via 1-click saved profiles.
> **Key Rule:** All background automation and workflow routing must be handled strictly using Laravel's native Events, Listeners, and Queues (e.g., Redis). Do not use external workflow tools like n8n or Zapier for internal logistics.
> ---
> 
> 
> ### **Phase 1: Database Schema & Migrations**
> 
> 
> Generate Laravel migrations and Eloquent models for the following structure. Ensure all relationships are clearly defined in the models.
> **1. `users` (Buyers & Merchants)**
> * `id`, `name`, `phone_number` (unique), `role` (enum: buyer, merchant), `password` (nullable for buyers), timestamps.
> 
> 
> **2. `shipping_zones` (Geo-fencing)**
> * `id`, `merchant_id` (foreign key), `zone_name` (e.g., "Kinondoni", "Ilala"), `flat_rate_fee` (decimal), `is_active` (boolean).
> 
> 
> **3. `products` (Inventory)**
> * `id`, `merchant_id`, `shipping_zone_id`, `title`, `price` (decimal, TZS), `inventory_count` (integer).
> 
> 
> **4. `posts` & `post_product_tags` (The Shoppable Feed)**
> * `posts`: `id`, `merchant_id`, `media_type` (enum: video, image, carousel), `media_url`, `caption`.
> * `post_product_tags`: `id`, `post_id`, `product_id`, `x_coordinate` (float), `y_coordinate` (float).
> 
> 
> **5. `one_click_profiles` (The "Lazy Capture")**
> * `id`, `user_id` (foreign key), `payment_provider` (string, e.g., M-Pesa, Tigo Pesa), `payment_number` (string), `delivery_landmark` (string), `latitude` (decimal), `longitude` (decimal).
> 
> 
> **6. `orders` & `deliveries` (Transactions & Logistics)**
> * `orders`: `id`, `buyer_id`, `product_id`, `total_paid`, `payment_status` (enum: pending, success, failed), `transaction_ref`.
> * `deliveries`: `id`, `order_id`, `courier_api_id`, `rider_name`, `rider_phone`, `delivery_status` (enum: searching, dispatched, delivered), `whatsapp_pin_url` (nullable).
> 
> 
> ---
> 
> 
> ### **Phase 2: Core API Endpoints (Laravel)**
> 
> 
> Implement the following RESTful API routes and corresponding Controllers.
> **Authentication & Profile:**
> * `POST /api/auth/otp/send` -> Sends OTP to phone number.
> * `POST /api/auth/otp/verify` -> Authenticates and returns Sanctum/Passport token.
> * `POST /api/profile/one-click/setup` -> Creates/updates the `one_click_profiles` record.
> 
> 
> **Feed & Discovery:**
> * `GET /api/feed` -> Returns paginated `posts` with nested `post_product_tags` and `products`.
> * `GET /api/pwa/product/{id}` -> Fetches lightweight product data for the web "Link in Bio" view.
> 
> 
> **Checkout & Payments:**
> * `POST /api/checkout/initiate` -> Accepts `product_id` and buyer's IP/Location. Validates against `shipping_zones`. If valid, triggers USSD push via local payment gateway. Creates `pending` Order.
> * `POST /api/webhooks/payment/callback` -> Webhook listener for the payment provider. Updates `orders` status to `success`.
> 
> 
> ---
> 
> 
> ### **Phase 3: Event-Driven Logistics (Laravel Queues)**
> 
> 
> Implement the asynchronous dispatch logic to keep the API fast.
> **1. The Event:** Create an `OrderPaid` event that fires inside the payment webhook callback when status equals `success`.
> **2. The Listener/Job:** Create a `DispatchCourier` queued job that listens for `OrderPaid`.
> **3. Job Logic:** > * Retrieve the `latitude`, `longitude`, and `delivery_landmark` from the buyer's `one_click_profiles`.
> * Format a JSON payload.
> * Execute a `Http::post` request to the local courier's API.
> * Save the response (rider details) into the `deliveries` table.
> * Trigger an SMS notification to the buyer with the rider tracking info.
> 
> 
> ---
> 
> 
> ### **Phase 4: Frontend Logic Specifications**
> 
> 
> **PWA (Link in Bio / Web Checkout):**
> * Must use HTML5 Geolocation API silently on the checkout screen to capture Lat/Lng.
> * Checkout UI must be a single form field: "Phone Number & Delivery Landmark".
> * Must handle the USSD wait state gracefully (loading spinner while waiting for the webhook callback via broadcasting/WebSockets).
> 
> 
> **Native App (Shoppable Feed):**
> * Implement a vertical scrolling feed (TikTok style).
> * Images/Carousels must render the `x_coordinate` and `y_coordinate` from `post_product_tags` as absolute-positioned visual overlays (Hotspots).
> * Tapping a Hotspot or a "Buy" button must trigger a Bottom Sheet component natively, pulling data from the user's `one_click_profiles` for an instant 1-click confirmation.
> 
>