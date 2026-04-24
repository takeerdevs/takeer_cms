> **Act as a Senior Backend Architect specializing in Laravel and RESTful API development.**
> We are continuing the development of the "Takeer" social commerce platform. Assume the database schema, models, and relationships from Phase 1 are already in place.
> **Your Task:**
> Execute Phase 2 of the blueprint. Generate the Laravel API Routes (`routes/api.php`), FormRequest classes for validation, and the core Controllers required for the Feed, Checkout, and Webhook flows.
> **Strict Requirements:**
> 1. **API Standards:** Use Laravel 11 best practices. Return consistent JSON responses (e.g., using Laravel's `JsonResource` or standard `response()->json()`).
> 2. **Performance:** In the `FeedController`, use eager loading (`with()`) for the `post_product_tags` and `products` to strictly prevent N+1 query problems when scrolling the feed.
> 3. **Security:** Use FormRequests for incoming data validation, especially on the checkout endpoint.
> 4. **Generate the following Controllers and Methods:**
> * `FeedController@index`: Returns a paginated list of posts with their associated media and product tags.
> * `ProfileController@setupOneClick`: Validates and saves/updates a user's `one_click_profiles` record (Phone, Provider, Zone ID, Lat/Lng).
> * `CheckoutController@initiate`:
> * Accepts `product_id` and `delivery_zone_id`.
> * Validates the zone matches the product's allowed zones.
> * Calculates `total_paid` (Product Price + Zone Flat Rate).
> * Creates an `Order` with `payment_status = 'pending'`.
> * *Mock* the external M-Pesa USSD API call and return a success response to the frontend.
> 
> 
> * `PaymentWebhookController@handle`:
> * Receives the mock callback from M-Pesa.
> * Finds the Order, updates `payment_status` to `success`.
> * Fires a native Laravel Event called `OrderPaid` (just write the `Event::dispatch` code; we will build the listener in Phase 3).
> 
> 
> 
> 
> 
> 
> Please output the code logically, starting with the Routes, then the FormRequests, and finally the Controllers.
