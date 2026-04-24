
> **Act as a Senior Backend Developer specializing in SMS Gateways and Laravel Notification Systems.**
> We are building the **Notification Engine** for Takeer. This system must handle critical SMS alerts for PINs, Payment Confirmations, and Dispute Updates.
> **Your Task:**
> Generate the Laravel Notification classes and the Service Integration for an SMS Provider (e.g., Beem or Twilio).
> **Strict Requirements:**
> 1. **SMS Service Provider:** Create a `SmsService` class that handles the API post request to an SMS gateway. Use placeholders for `API_KEY` and `SENDER_ID`.
> 2. **Core Notifications:** Generate three (3) Laravel Notification classes:
> * `OrderPaidNotification`: Sent to the **Merchant** when a buyer pays. *"Takeer: New Order #123! Please dispatch and upload the waybill video."*
> * `PackageDispatchedNotification`: Sent to the **Buyer** when the waybill is scanned. *"Takeer: Your package is on [Bus Name]. Tracking: [Number]. Use PIN [4321] to receive at the counter."*
> * `DisputeResolvedNotification`: Sent to both parties when the Admin makes a ruling in Phase 6.
> 
> 
> 3. **The "Resend PIN" Logic:** >    * Create a Controller method `resendPin(Order $order)` that checks if the order is still `escrow_locked` and re-triggers the SMS. Limit this to 3 attempts per order to prevent SMS cost bloat.
> 4. **Fallback Mechanism:** Ensure that if the SMS API fails, the error is logged in a `notification_logs` table so the Admin can see which customers didn't get their PINs.
> 
> 
> **Output:**
> Please provide the `SmsService`, the Notification classes, and the `notification_logs` migration.

---

### **Kwanini Phase 7 ni Muhimu?**

1. **Trust:** Mteja akipata SMS ya "PIN" mara tu baada ya kulipia, anajisikia salama.
2. **Speed:** Boda au Karani wa basi hawezi kusubiri mteja atafute-tafute PIN. Lazima iwe kwenye SMS yake ya kawaida.
3. **Cost Control:** Kwa kutumia `notification_logs`, utajua ni kiasi gani unatumia kwenye SMS kila mwezi na wapi kuna matatizo ya network.

---
