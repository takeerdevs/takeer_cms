> **Act as a Senior Fintech Backend Developer specializing in Digital Wallets and Payout Systems.**
> We are building the **Financial Ledger** for Takeer. This handles the movement of funds from Escrow to the Merchant's withdrawable balance.
> **Your Task:**
> Generate the Migrations, Models, and Controller logic for the **Merchant Wallet** and **Withdrawal Request** flow.
> **Strict Requirements:**
> 1. **The Ledger Table (`wallets`):** >    * `user_id`, `balance` (decimal), `frozen_balance` (for active escrow orders).
> 2. **Transaction History (`transactions`):** >    * Record every movement: `order_revenue`, `withdrawal`, `platform_fee`.
> 3. **The Withdrawal Flow:** >    * **Method `requestWithdrawal**`: Validates the merchant has enough balance, creates a `withdrawal_requests` record with status `pending`, and deducts the balance.
> * **Method `approveWithdrawal` (Admin Only)**: Triggers the *Mock* M-Pesa B2C API to send money to the merchant's phone and updates status to `completed`.
> 
> 
> 4. **Safety Checks:** >    * Use **Database Transactions** (`DB::beginTransaction()`) to ensure that if the M-Pesa API fails, the merchant's balance is rolled back and not lost.
> * Prevent double-spending (ensure a merchant cannot click "Withdraw" twice rapidly).
> 
> 
> 
> 
> **Output:**
> Please provide the Migrations for `wallets` and `withdrawal_requests`, the `WalletService` logic, and the `WithdrawalController`.

---

### **Kwanini Phase 8 ni Muhimu kwa Biashara Yako?**

1. **Cash Flow:** Unakaa na pesa ya mauzo kwenye bank account ya Takeer kwa muda mrefu kidogo, jambo linalokupa "Liquidity."
2. **Profitability:** Unapunguza gharama za miamala (Transaction fees). Badala ya miamala 10 ya TZS 5,000, unafanya muamala 1 wa TZS 50,000.
3. **Merchant Loyalty:** Muuzaji akiona "Balance" yake inakua ndani ya app, anahamasika kuuza zaidi ili afikishe kiasi kikubwa cha kutoa.

---
