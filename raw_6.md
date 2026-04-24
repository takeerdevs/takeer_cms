> **Act as a Senior Full-Stack Developer specializing in Internal Admin Tools and Fraud Operations.**
> We are building the **Takeer Admin Portal**. This is the internal system used by Takeer staff to review evidence and settle disputes.
> **Your Task:**
> Generate the Laravel Controller, Routes, and a Tailwind-based Blade/React view for the **Dispute Review Center**.
> **Strict Requirements:**
> 1. **Dispute Queue:**
> * Create an `AdminDisputeController@index` that fetches all `orders` where `status = 'disputed'`.
> * Include eager loading for `disputes`, `deliveries`, and `products` to show the full context.
> 
> 
> 2. **The "Comparison Engine" (The UI):**
> * Create a side-by-side layout:
> * **Left Column (Merchant Proof):** Display the `merchant_dispatch_video` and the `waybill_photo`.
> * **Right Column (Buyer Proof):** Display the `buyer_unboxing_video` uploaded at the terminal/doorstep.
> * **Center Meta:** Show the OCR-extracted waybill number, the GPS coordinates where the buyer recorded their video, and the total TZS at stake.
> 
> 
> 
> 
> 3. **The Final Judgment (The Logic):**
> * **Method `ruleInFavorOfMerchant(Order $order)**`: Updates order status to `resolved_merchant_paid`, triggers the M-Pesa B2C payout job, and closes the dispute.
> * **Method `ruleInFavorOfBuyer(Order $order)**`: Updates order status to `resolved_buyer_refunded`, triggers a refund process, and notifies the merchant of the loss.
> 
> 
> 4. **Audit Trail:**
> * Every decision must create a record in a `dispute_resolutions` table containing: `admin_id`, `order_id`, `verdict` (merchant/buyer), and `reason_notes`.
> 
> 
> 
> 
> **Output:**
> Please provide the Migration for `dispute_resolutions`, the Controller logic, and a clean, high-density Admin UI layout.

---

### **Why Phase 6 is a Game Changer for Your Pitch**

When you show this to an investor, you aren't just showing an app; you are showing an **Operational System**.

* It proves you have a plan for when things go wrong.
* It shows that Takeer is the "Source of Truth" because you have both videos and the Waybill data in one screen.
