### **Phase 5: The Merchant Dashboard & Analytics**

> **Act as a Senior Full-Stack Developer and UI/UX Designer specializing in Merchant Dashboards.**
> We are building the "Merchant Command Center" for the Takeer platform. This dashboard needs to be highly visual and optimized for mobile screens.
> **Your Task:**
> Generate the frontend components and the supporting Laravel API logic for the Merchant Dashboard.
> **Strict Requirements:**
> 1. **The "Pulse" Overview (Analytics):**
> * Create a top-level summary component showing: `Total Sales (TZS)`, `Pending Dispatches`, and `Available for Withdrawal`.
> * Include a simple line chart (using a library like Chart.js or Recharts) showing "Sales over the last 7 days."
> 
> 
> 2. **The "Actionable" Order List:**
> * Create a tabbed list view: `New Orders`, `In Transit`, `Completed`.
> * **New Orders:** Must have a prominent "Dispatch" button that opens the camera to record the "Proof of Dispatch" video and scan the waybill.
> * **In Transit:** Show the bus tracking number (extracted via OCR) and a countdown timer for the 72-hour escrow release.
> 
> 
> 3. **The "Social Performance" Tracker:**
> * A list of the merchant's Shoppable Posts.
> * For each post, show `Views` vs. `Clicks` vs. `Orders`. This tells the merchant exactly which Instagram video is making them money.
> 
> 
> 4. **Payout History & Wallet:**
> * A simple list showing every M-Pesa B2C payout Takeer has sent to the merchant, with the transaction ID and date.
> 
> 
> 5. **Backend API Logic:**
> * Write the `MerchantDashboardController` methods to calculate these sums and group orders by status efficiently.
> 
> 
> 
> 
> Ensure the UI uses high-contrast colors (e.g., Green for "Paid", Orange for "In Transit") so it is easy to read in bright sunlight at a busy bus terminal.

---

### **The "Takeer" Final Package**

You now have the complete roadmap to launch a disruptive tech startup in Tanzania:

1. **Phase 1:** The Database (The Foundation).
2. **Phase 2:** The API & Checkout (The Engine).
3. **Phase 3:** The Queues & Escrow (The Trust).
4. **Phase 4:** The PWA & GPS (The Frictionless UX).
5. **Phase 5:** The Dashboard (The Merchant Value).
6. **The Strategy:** The Pitch Deck, the Investor Email, and the Demo Script.
