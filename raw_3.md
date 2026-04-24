> **Act as a Senior Backend Architect specializing in Laravel Event-Driven Architecture and Background Queues.**
> We are continuing the development of the "Takeer" social commerce platform. Assume the Database schema (Phase 1) and Core API Endpoints (Phase 2) are already implemented. We are strictly using Laravel's native queue system (Redis) and scheduled tasks. Do not suggest or use external workflow tools.
> **Your Task:**
> Execute Phase 3 of the blueprint. Generate the Laravel Events, Listeners, Queued Jobs, and the Scheduled Command required to handle the logistics and escrow payouts.
> **Strict Requirements:**
> 1. **The Payment Event:** Create an `OrderPaid` event.
> 2. **Intercity Dispatch Job:** Create a queued job called `ProcessIntercityDispatch`.
> * It should accept an `Order` and the uploaded waybill photo URL.
> * *Mock* a Google Cloud Vision OCR call to extract a `waybill_tracking_number`.
> * Update the `deliveries` table status to `in_transit`.
> * *Mock* an M-Pesa B2C API call to instantly pay the first-mile boda their TZS 3,000 fee.
> 
> 
> 3. **The 72-Hour Escrow Clock:** Create a Laravel Console Command (`CheckEscrowTimeouts`).
> * Query the `orders` table for `payment_status = 'escrow_locked'` where the `updated_at` timestamp is older than 72 hours.
> * For each matching order, verify there is no open dispute in the `disputes` table.
> * Update the order status to `resolved_merchant_paid`.
> * *Mock* the M-Pesa B2C payout to the merchant.
> 
> 
> 4. **Scheduler Setup:** Show me exactly how to register this `CheckEscrowTimeouts` command to run hourly in Laravel 11's routing/console configuration.
> 
> 
> Output the code logically, separated by file names. Use robust `try/catch` blocks inside the Jobs to handle potential API failures, and ensure the Jobs implement `ShouldQueue`.