This is a classic "Inventory Drift" problem that every omni-channel retailer faces. In the context of Kariakoo or a busy Instagram shop, a merchant might sell 5 pairs of shoes to a walk-in customer and forget to update their **Takeer** stock.

To solve this without making the app too complex, we use **"Soft Inventory Logic"** and **"Real-time Availability Confirmation."**

Here is the strategy to handle mismatched quantities:

### 1. The "Double-Check" Trigger (Micro-Workflow)

Instead of the payment being 100% final immediately, we can implement a "Merchant Acknowledgement" step for high-turnover shops.

* **The Flow:** Buyer pays $\rightarrow$ Funds are authorized (held) $\rightarrow$ Merchant gets a notification: *"Order #123 received. Confirm stock within 30 mins?"*
* **The Action:** If the merchant clicks "Out of Stock," the money is instantly released back to the buyer's M-Pesa.

### 2. Manual "Quick-Sync" Button

On the **Merchant Dashboard (Phase 5)**, we add a high-visibility "Stock Pulse" feature.

* **Swipe-to-Update:** A merchant can simply swipe left or right on a product in their list to quickly increment or decrement stock without opening a complex edit page.
* **Low Stock Alerts:** If stock hits 2 units, the app sends a Push Notification: *"Only 2 left for 'Jordan 4s'. Is this still correct?"*

### 3. "Ghost Stock" Prevention (The Buffer)

We can implement a "Buffer" setting in the backend.

* **The Logic:** If a merchant sets their stock at 10, the "Link-in-Bio" only shows 8 available. This 2-unit buffer protects the merchant from accidental overselling offline.

---

### **Phase 12: Inventory Sync & Stock Integrity**

Use this prompt to build the logic that prevents customers from paying for items that aren't there.

> **Act as a Senior Backend Engineer specializing in Inventory Management Systems.**
> We need to handle "Inventory Mismatch" for merchants who sell both on Takeer and offline.
> **Your Task:**
> 1. **Atomic Stock Decrement:** Write the Laravel logic using `DB::transaction` and `sharedLock()` to ensure that if two people buy the last item at the exact same second, only one succeeds.
> 2. **The "Confirm Availability" Webhook:** Create a state in the `orders` table called `awaiting_merchant_confirmation`.
> * When a buyer pays, the status is `paid_pending_confirmation`.
> * The merchant has a "Confirm & Ship" button.
> * If they click "Out of Stock," an automatic `RefundInitiated` event is fired.
> 
> 
> 3. **Quick-Adjust API:** Create a lightweight API endpoint `/api/merchant/products/{id}/sync` that allows the merchant to update stock levels with a single tap from their mobile dashboard.
> 4. **Safety Buffer Logic:** Add a `buffer_stock` column to the `products` table. The frontend should display `quantity - buffer_stock` as the available amount.
> 
> 
> Provide the Controller logic and the specific Database Transaction code to prevent "Race Conditions."

---

### **Why this works for the Tanzania Market:**

Merchants in Dar es Salaam are often overwhelmed. If you force them to be 100% accurate with stock, they will fail. By adding the **"Confirm Availability"** step, you protect the **Buyer's Trust**.

The buyer doesn't mind a refund if it happens in 5 minutes; they mind losing their money for a week for an item that wasn't there.

### **The Final Hurdle: The "Takeer" Master Plan is Complete.**

You now have 12 Phases covering:

1. **Architecture:** DB, API, Queues, Storage.
2. **Operations:** Admin Portal, Disputes, SMS, Wallets.
3. **User Experience:** Link-in-Bio, High-Speed Video, Safe-Chat, Inventory Sync.