# Takeer Marketplace Payment Boundary and Compliance Implementation Plan

**Company:** AVLY TECH GROUP LIMITED  
**Platform:** Takeer  
**Primary jurisdiction:** United Republic of Tanzania, initially Tanzania Mainland  
**Business model:** Marketplace and commerce technology platform  
**Payment model:** Collections, custody, refunds, settlement, and seller payouts performed by licensed payment service providers  
**Version:** 1.0  
**Prepared:** 3 August 2026  
**Status:** Proposed implementation plan

## 1. Purpose

This document defines the work required to bring Takeer's implementation back within its intended business boundary:

> Takeer connects buyers and independent sellers, manages orders and fulfillment, and provides marketplace customer-protection workflows. Takeer is not a payment service provider, does not issue electronic money, does not provide deposit or stored-value accounts, and does not take custody of buyer or seller funds. Licensed payment service providers perform payment collection, custody, refunds, settlement, and seller payout.

The existing platform was implemented with features that go beyond this intended model, including merchant wallets, frozen balances, withdrawal requests, manual withdrawal policies, aggregate balance sweeping, and Takeer-managed provider treasury records. Because Takeer has not been deployed and has no production balances to preserve, this plan deletes those features immediately and replaces them with order-specific payment and PSP-settlement records. No compatibility layer, data migration, read-only legacy mode, or transitional wallet support is required.

The implementation goal is to make the following true in law, contract, product design, code, accounting, and daily operations:

1. Takeer controls commerce decisions, not customer money.
2. A licensed PSP controls every regulated money movement.
3. Every payment, hold, release, refund, and seller payout remains tied to specific Takeer orders.
4. Sellers see commerce and payout statuses, not a Takeer-issued wallet.
5. Takeer never allows users to deposit, store, spend, transfer, or withdraw monetary value held by Takeer.
6. Takeer's commission is collected through a PSP-approved split or settlement mechanism.
7. PSP callbacks and API responses are authenticated, idempotent, amount-matched, and auditable.
8. User agreements and product language accurately describe Takeer's marketplace role.

This plan is designed to achieve the strongest practical compliance position for the stated model. No software document can guarantee “100% compliance” by itself. Final compliance also depends on provider licences and product approvals, executed contracts, bank and settlement structures, actual operating conduct, Tanzanian legal advice, and any required Bank of Tanzania (BoT) confirmation.

## 2. Scope

### 2.1 In scope

- Buyer checkout on Takeer.
- Payment initiation through licensed PSP APIs.
- PSP-hosted, PSP-controlled, or MNO payment approval.
- Payment confirmation and failure callbacks.
- Physical product delivery and buyer receipt workflows.
- Instant and delayed digital-product fulfillment.
- Services, courses, subscriptions, events, bundles, and other Takeer sellable types.
- Conditional order release instructions to the PSP.
- Direct PSP payouts to sellers.
- PSP split settlement of Takeer's platform fees where supported.
- Refunds and reversals executed by the PSP.
- Marketplace disputes, returns, fraud review, and compliance exceptions.
- Seller KYC/KYB linkage and PSP onboarding status.
- Order-to-PSP reconciliation.
- Immediate deletion of wallet, withdrawal, and Takeer treasury features before deployment.
- Buyer, merchant, payment, refund, privacy, and fee terms.

### 2.2 Explicitly out of scope and prohibited

Unless Takeer later obtains separate legal advice and required regulatory authorisation, the platform must not provide:

- Buyer or seller stored-value wallets.
- User deposits or cash top-ups.
- Peer-to-peer transfers.
- Merchant-to-merchant transfers.
- Buyer-to-buyer transfers.
- The ability to spend marketplace earnings inside Takeer.
- Cash-in or cash-out services.
- Arbitrary merchant withdrawal amounts from a Takeer balance.
- Takeer-controlled pooled seller funds.
- Takeer-funded payout float used to settle seller obligations.
- Lending, overdraft, credit, or advance products based on unsettled sales.
- Cross-border payment or payout services without separately approved provider and legal arrangements.
- Takeer-issued payment instruments or electronic money.
- Claims that Takeer itself is BoT-licensed, operates escrow, guarantees payment, or provides banking services.

## 3. Regulatory and contractual foundation

### 3.1 Conservative legal position

Takeer should be structured as an e-commerce marketplace consuming services from licensed PSPs. The platform should not rely solely on calling itself a “commercial agent.” Product labels do not override actual control of funds.

The National Payment Systems Act, 2015 prohibits operating a payment system without a licence and defines regulated concepts broadly enough that actual fund-transfer, routing, or electronic payment activity must be considered carefully. The Act's “payment system provider agent” is appointed by a licensed payment system provider, not merely by a marketplace seller.

Primary references:

- [National Payment Systems Act, 2015](https://www.bot.go.tz/Publications/Acts%2C%20Regulations%2C%20Circulars%2C%20Guidelines/Acts/en/2020030902433783.pdf)
- [Payment Systems Licensing and Approval Regulations, 2015](https://www.bot.go.tz/Publications/NPS/GN-THE%20PAYMENT%20SYSTEMS%20LICENSING%20AND%20APPROVAL%20REGULATIONS%202015.pdf)
- [Electronic Money Regulations, 2015](https://www.bot.go.tz/Publications/Acts%2C%20Regulations%2C%20Circulars%2C%20Guidelines/Regulations/sw/2020030903230325.pdf)
- [BoT Financial Consumer Protection](https://www.bot.go.tz/DFDI/ConsumerProtection)
- [BoT Payment System laws and regulations](https://www.bot.go.tz/PaymentSystem/regulations?lang=en)

### 3.2 Required external confirmation

Before production rollout of the target model, Takeer must obtain:

1. A short written opinion from qualified Tanzanian payments counsel confirming that the final architecture and contracts keep Takeer within its intended marketplace role or identifying any required approval.
2. Written confirmation from each enabled PSP that its licence and approved product cover the exact collection, conditional settlement, marketplace/submerchant, split, refund, and payout flow being used.
3. A signed provider agreement identifying which party controls funds and confirming that seller funds do not become Takeer operating cash.
4. Written allocation of KYC/KYB, AML/CFT, sanctions screening, complaints, refund, reconciliation, data, incident, and record-retention responsibilities.
5. BoT approval, notification, no-objection, sandbox outcome, or other engagement only where counsel or the PSP determines it is required.

### 3.3 PSP due-diligence questionnaire

Selcom, AzamPay, ClickPesa, or any future provider must answer these questions in writing before being enabled:

| Question | Required answer/evidence |
| --- | --- |
| Who is the licensed contracting entity? | Legal name, registration, licence/approval evidence, product name |
| Is marketplace collection supported? | Contract or product schedule, not a sales email alone |
| Are sellers merchants or submerchants? | Onboarding model and seller identifier format |
| Who holds funds pending delivery? | PSP-controlled account and legal/accounting treatment |
| Can settlement wait for an order release instruction? | Approved workflow and maximum permitted period |
| Can the PSP pay each seller directly? | Payout API/product terms and beneficiary rules |
| Can Takeer's fee be split automatically? | Split-settlement instructions and tax treatment |
| How are refunds and reversals executed? | API, limits, source of refund funds, status callbacks |
| How are failed or unknown payouts handled? | Status API, reconciliation report, retry rules |
| How are payout beneficiaries verified? | Name enquiry, account verification, or provider onboarding process |
| What callback authentication is required? | Signature/MAC specification, timestamp, nonce, key rotation |
| What reconciliation evidence is available? | Balance API, transaction export, settlement file, statement frequency |
| Is Takeer considered an agent or outsourced technology provider? | Contractual classification and any BoT notification/approval |
| What records must Takeer retain? | Duration, format, retrieval and audit obligations |
| Where is payment data processed and stored? | Hosting/data location and privacy terms |

If a provider only offers a normal corporate collection account followed by Takeer-controlled bulk payouts, it does not automatically satisfy this model. The contract must explicitly cover third-party marketplace sellers and the intended conditional settlement flow.

## 4. Non-negotiable business boundaries

These rules must become architecture constraints and automated acceptance tests.

### Boundary 1 — PSP custody

Buyer funds must enter and remain within the licensed PSP's approved collection and settlement structure until the PSP completes a seller payout, Takeer fee settlement, refund, or other authorised disposition.

Takeer must not:

- Receive marketplace principal into an ordinary AVLY TECH GROUP operating account.
- Treat merchant principal as company cash.
- Use incoming buyer funds to finance operations.
- Represent an application balance as money held by Takeer for the user.

### Boundary 2 — Order-specific records

Every amount displayed by Takeer must be derived from identified orders and PSP events. A merchant “pending earnings” total is permitted only as a calculated report:

```text
sum(order seller allocations with status pending_release)
```

It must not be a mutable balance that can be transferred, topped up, spent, or withdrawn.

### Boundary 3 — PSP-executed payouts

Takeer may request or authorise payout for released order allocations. The PSP must execute the payout directly to the verified seller beneficiary.

Takeer must not:

- Debit an internal wallet to create a payout.
- Allow the seller to enter any arbitrary withdrawal amount.
- Pay sellers from Takeer's unrelated operating funds.
- Mark a payout completed without authenticated PSP evidence.

### Boundary 4 — PSP-executed refunds

Takeer may decide marketplace refund eligibility and send a refund instruction, but the PSP must perform the regulated money movement using the original transaction or another contractually approved route.

### Boundary 5 — No hidden regulated feature

The following product behaviour is prohibited even if renamed:

- “Earnings balance” that behaves like a wallet.
- “Credits” convertible to cash.
- “Pending payout” that can remain indefinitely at merchant choice.
- “Internal settlement” that nets unrelated users.
- “Escrow” where Takeer controls the pooled money.

## 5. Target architecture

### 5.1 Physical-product flow

```text
1. Buyer creates order on Takeer
2. Takeer creates immutable payment attempt with expected amount/currency
3. Licensed PSP collects payment
4. PSP sends authenticated payment confirmation
5. Takeer validates callback and marks order paid/pending fulfillment
6. PSP retains funds under its approved marketplace arrangement
7. Takeer coordinates shipping, delivery, receipt, return and dispute windows
8. Release condition is met
9. Takeer sends idempotent order release/payout instruction to PSP
10. PSP pays verified seller and settles Takeer's approved fee
11. PSP confirms payout
12. Takeer records payout status and closes order settlement
```

### 5.2 Instant digital-product flow

```text
1. Buyer creates order and payment attempt
2. PSP confirms exact payment
3. Takeer grants access idempotently
4. Order becomes release eligible under the approved digital policy
5. Takeer instructs PSP payout
6. PSP pays seller and confirms outcome
```

Digital access must not be granted from an unauthenticated callback.

### 5.3 Delayed digital work or services

Custom digital work, bookings, services, and milestone-based products may require a fulfillment hold. The PSP contract must support the required settlement timing. Each release must remain tied to an order or documented milestone.

### 5.4 Failed payout flow

```text
PSP payout fails or remains unknown
  ↓
Takeer records provider exception against exact order allocations
  ↓
No Takeer wallet is credited
  ↓
PSP status is reconciled
  ↓
Retry through PSP or request verified beneficiary correction
  ↓
PSP completes payout or funds remain within PSP-approved structure
```

## 6. Current implementation findings and required disposition

| Current area | Problem | Required disposition |
| --- | --- | --- |
| `wallets.balance` | Persistent merchant monetary balance | Delete wallets schema, model, services, controllers, routes, tests and UI before deployment |
| `wallets.frozen_balance` | Aggregate funds represented as Takeer-held escrow | Replace with per-order PSP settlement status |
| Merchant Wallet UI | Allows arbitrary withdrawal requests | Replace with Earnings and Payouts reporting; remove amount-entry withdrawal flow |
| `withdrawal_requests` | Models seller-initiated cash-out | Replace with PSP payout records generated from released orders |
| Manual withdrawal defaults | Permits indefinite merchant-controlled storage | Remove policy and automatic/manual withdrawal choice |
| `AutomaticWithdrawalService` | Sweeps aggregate wallet, possibly from several orders | Replace with order-allocation payout orchestration |
| Provider treasury accounts | Makes Takeer appear to manage payout float | Delete Takeer treasury schema, services and admin controls; use PSP status/reconciliation records instead |
| Selcom callback verification | Returns `true` unconditionally | Implement and enforce provider-documented authentication before state change |
| Placeholder M-Pesa webhook | Signature verification omitted | Delete route and controller path; add M-Pesa later only as a fresh verified PSP adapter |
| Shared success processor | Does not receive validated amount/currency event | Accept a validated provider-event object and recheck expectations under lock |
| Payout credential verification | Marks record verified after account step-up | Add PSP beneficiary verification and provider reference |
| Terms | Vague payments-facilitator and held-funds language | Replace with accurate marketplace and PSP terms |
| Merchant Agreement | Contains non-contract commentary and unrelated content | Replace with clean, counsel-approved agreement and clickwrap evidence |
| Audit trail | Does not preserve complete raw pay-in validation chain | Add append-only provider event and transition records |

## 7. Data model redesign

### 7.1 Design principle

Takeer needs a commerce settlement ledger, not a customer-money ledger. It records what the PSP reports about specific orders. It must not create a freely spendable claim against Takeer.

### 7.2 `marketplace_seller_payment_profiles`

Stores the seller's relationship with a PSP, not Takeer-issued account value.

```text
id
merchant_id
payment_provider_id
provider_merchant_id
provider_submerchant_id nullable
onboarding_status
kyc_status
beneficiary_status
payouts_enabled
collections_enabled
provider_country_code
provider_currency_codes
provider_status_reference
onboarded_at nullable
verified_at nullable
suspended_at nullable
last_synced_at nullable
restrictions json nullable
metadata json nullable
timestamps
```

Constraints:

- Unique provider seller identifier per provider.
- Payout cannot be created unless `payouts_enabled` and beneficiary status is verified.
- Collections cannot begin where the PSP requires seller onboarding and it is incomplete.

### 7.3 `payment_attempts`

```text
id
public_id
order_id
payment_provider_id
payment_provider_channel_id
provider_merchant_id nullable
takeer_reference
expected_amount_minor
expected_currency
expected_country_code
payment_phone_encrypted nullable
payment_phone_hash nullable
state
idempotency_key
provider_request_reference nullable
provider_transaction_reference nullable
request_snapshot json
response_snapshot json nullable
initiated_at
expires_at
confirmed_at nullable
failed_at nullable
timestamps
```

Important rules:

- Use integer minor units for comparison.
- Order price, currency, seller and fee snapshot become immutable at initiation.
- A retry creates a new attempt; it must not rewrite the previous attempt.
- Provider transaction reference must be unique within the provider.

### 7.4 `provider_events`

Append-only journal of inbound callbacks and relevant status responses.

```text
id
public_id
payment_provider_id
direction
event_type
provider_event_id nullable
provider_transaction_reference nullable
takeer_reference nullable
received_at
source_ip nullable
raw_body_encrypted
raw_body_sha256
filtered_headers json nullable
signature_present
signature_valid
replay_key
amount_minor nullable
currency nullable
validation_state
validation_errors json nullable
processed_at nullable
processing_result nullable
related_type nullable
related_id nullable
timestamps
```

Rules:

- Record raw request bytes before JSON normalisation.
- Encrypt raw payloads and prevent ordinary application-log duplication.
- Do not update or delete processed events through the application.
- Duplicate events return a provider-compatible acknowledgement without repeating business actions.

### 7.5 `order_settlements`

One order-level record describing the PSP-reported financial lifecycle.

```text
id
order_id
merchant_id
payment_provider_id
payment_attempt_id
currency
buyer_paid_amount_minor
seller_amount_minor
takeer_fee_amount_minor
provider_fee_amount_minor nullable
tax_amount_minor nullable
refunded_amount_minor default 0
payout_eligible_amount_minor default 0
paid_out_amount_minor default 0
settlement_state
hold_reason nullable
release_rule_snapshot json
release_eligible_at nullable
release_requested_at nullable
refund_requested_at nullable
closed_at nullable
timestamps
```

Invariants:

- Seller amount plus disclosed fee/tax components must reconcile to buyer-paid amount according to the PSP contract.
- Paid-out amount must never exceed payout-eligible seller amount.
- Refunded amount must never exceed the refundable order amount.
- Settlement is not a transferable user balance.

### 7.6 `provider_payouts`

Records direct PSP payout of released seller allocations.

```text
id
public_id
merchant_id
payment_provider_id
seller_payment_profile_id
currency
amount_minor
state
provider_payout_reference nullable
provider_idempotency_key
due_at
submitted_at nullable
completed_at nullable
failed_at nullable
failure_code nullable
failure_message nullable
retry_count default 0
next_retry_at nullable
last_provider_event_id nullable
metadata json nullable
timestamps
```

### 7.7 `provider_payout_allocations`

```text
id
provider_payout_id
order_settlement_id
amount_minor
timestamps
```

Rules:

- Sum of payout allocations equals payout amount.
- An order allocation cannot be paid twice.
- A payout can batch several released orders only if the PSP contract requires or permits it.
- The seller cannot select an arbitrary amount.

### 7.8 `provider_refunds`

```text
id
public_id
order_settlement_id
payment_provider_id
provider_transaction_reference
amount_minor
currency
reason_code
state
requested_by_type
requested_by_id nullable
provider_refund_reference nullable
provider_idempotency_key
requested_at
completed_at nullable
failed_at nullable
last_provider_event_id nullable
metadata json nullable
timestamps
```

### 7.9 Components to delete before deployment

There is no production or customer data to preserve. Remove the prohibited model at source instead of adding migrations that later drop it.

Delete:

- The migration that creates `wallets` and every later migration that alters wallets.
- The migration that creates `withdrawal_requests` and every later migration that alters withdrawals.
- The migrations that create `provider_treasury_accounts` and `provider_treasury_reservations`.
- Wallet and withdrawal Eloquent models where they are no longer used by a permitted non-payment feature.
- Wallet, automatic withdrawal, withdrawal quote/accounting/recovery, and Takeer treasury services.
- Merchant withdrawal, wallet ledger, payout quote, admin withdrawal, and platform-wallet routes.
- Wallet, withdrawal, payout-settings, platform-wallet, and treasury administration screens that depend on Takeer-held balances.
- Seeders, settings, permissions, notifications, jobs, tests, and translations that enable or imply a Takeer wallet or arbitrary withdrawal.
- The unauthenticated placeholder M-Pesa webhook route and implementation.

The existing `transactions` table must be reviewed field by field. Retain it only if it is converted into an order/payment audit record with no wallet semantics; otherwise replace it with `payment_attempts`, `provider_events`, and `order_settlements` and delete it before the first production migration is applied.

Repository-wide searches for `wallet`, `frozen_balance`, `withdrawal`, `treasury`, `cashout`, `cash_out`, and direct `paid_out_at` mutations must return only explicitly approved order-reporting terminology or tests that prohibit these behaviours.

## 8. Payment initiation controls

### 8.1 Server-calculated amount

The server must calculate the final amount from immutable order inputs. Never accept the payable amount, commission, seller allocation, or currency as authoritative client input.

### 8.2 PSP and seller eligibility

Before payment initiation:

- Confirm the provider and channel are enabled for the buyer's country and currency.
- Confirm the seller is eligible under the provider's marketplace model where required.
- Confirm the provider can settle or pay out to the seller.
- Confirm the order has a valid release rule.
- Confirm terms and disclosures were accepted or displayed as required.
- Store an immutable PSP routing and fee snapshot.

### 8.3 Idempotency

- Require a client checkout idempotency key.
- Generate a separate provider idempotency key.
- Repeated requests must return the original attempt, not create duplicate PSP collections.
- Expired or terminal attempts require a new explicit retry.

### 8.4 No simulated payment in production

Simulation code must be impossible to execute in production, regardless of request parameters. Enforce environment and provider configuration checks at service boundaries, and add a deployment assertion that fails when simulation is enabled in production.

## 9. Callback security and payment confirmation

### 9.1 Mandatory validation pipeline

Every pay-in, payout, refund, and reversal callback must pass:

1. Provider-specific route resolution.
2. Request size and content-type validation.
3. Raw payload preservation.
4. Signature or MAC verification using provider documentation.
5. Timestamp, nonce, certificate, or replay-window validation where supported.
6. Unique provider event or deterministic replay key.
7. Exact Takeer reference lookup.
8. Exact provider and channel match.
9. Exact expected amount and currency match.
10. Provider transaction reference uniqueness.
11. Seller/submerchant match when provided.
12. Independent status query for high-risk, ambiguous, unsigned, or provider-required events.
13. Atomic locked state transition.
14. Post-commit order event and fulfillment action.

### 9.2 Failure behaviour

If any material field fails validation:

- Preserve the event.
- Do not mark the order paid.
- Do not grant digital access.
- Do not dispatch physical fulfillment based solely on that event.
- Do not release or pay the seller.
- Place the event into operations review.
- Alert on security-sensitive failures.
- Return only the acknowledgement required by the PSP, without exposing internal details.

### 9.3 Provider adapter contract

Create a common interface that returns a verified domain event:

```text
verifyRawCallback(request): CallbackVerificationResult
parseVerifiedCallback(verificationResult): ProviderEventData
queryPaymentStatus(providerReference): ProviderPaymentStatus
createPayment(paymentAttempt): ProviderPaymentInstruction
requestOrderPayout(providerPayout): ProviderPayoutInstruction
queryPayoutStatus(providerReference): ProviderPayoutStatus
requestRefund(providerRefund): ProviderRefundInstruction
queryRefundStatus(providerReference): ProviderRefundStatus
```

Controllers must not parse provider payloads and update orders directly.

### 9.4 Immediate security fixes

- Delete the placeholder M-Pesa webhook route and implementation. A future M-Pesa integration must be added through the verified provider adapter contract as a new feature.
- Replace Selcom's unconditional `verifyCallback()` result.
- Require verification inside Selcom callback controllers.
- Confirm AzamPay's current callback signature protocol against its official integration contract; do not rely on assumed field order.
- Validate Flutterwave or any other provider using its current documented protocol and independent transaction verification where required.
- Implement ClickPesa only after the same adapter and certification requirements are met.
- Stop logging full callback bodies and personal information to ordinary logs.

## 10. Order fulfillment and release

### 10.1 Formal settlement states

Recommended states:

```text
awaiting_payment
payment_confirmed
pending_fulfillment
release_eligible
release_requested
payout_processing
paid_out
refund_requested
refunded
disputed
provider_exception
compliance_hold
closed
```

Use a domain state machine. Controllers and administrators must not set these fields directly.

### 10.2 Release policies

Each order stores the exact release policy in force at purchase. For every sellable category, define:

- Payment confirmation requirement.
- Fulfillment evidence.
- Buyer confirmation process.
- Review or dispute window.
- Automatic release condition.
- Maximum normal hold period.
- Refund eligibility.
- Exception reason codes.
- Required communications.

Example categories:

| Category | Possible release event, subject to PSP/legal approval |
| --- | --- |
| Instant digital download | Verified payment plus successful entitlement grant |
| Course or membership | Verified payment plus access activation; refund policy snapshot applies |
| Custom digital work | Buyer acceptance or expiry of disclosed review period |
| Physical local delivery | Buyer receipt confirmation or delivery proof plus review-window expiry |
| Forwarder/intercity delivery | Verified handoff/pickup event plus disclosed review period |
| Service/booking | Completion evidence or buyer acceptance under service terms |

### 10.3 Release instruction

When an order becomes release eligible:

1. Lock the order settlement.
2. Confirm it is paid, not refunded, not already allocated, and has no active dispute or compliance hold.
3. Create a provider payout or add the order to a permitted PSP batch.
4. Allocate the exact seller amount.
5. Commit locally.
6. Submit the idempotent PSP payout instruction through a durable queue.
7. Record response and await authenticated completion evidence.

`paid_out_at` must represent PSP-confirmed payout, not merely Takeer's release decision.

### 10.4 Holds and disputes

Holds are order-state restrictions, not Takeer custody accounts. Every hold must include:

- Order and amount affected.
- Reason code.
- Policy/legal basis.
- Evidence.
- Actor and approval.
- Start and review deadline.
- Maximum expiry where legally allowed.
- Buyer and seller notification.
- Final release/refund outcome.

## 11. Direct PSP seller payouts

### 11.1 Seller experience

Replace the Wallet page with Earnings and Payouts:

- Pending payment confirmation.
- Payment confirmed; fulfillment required.
- Pending release.
- Release eligible.
- Payout submitted to PSP.
- Payout completed with reference.
- Payout failed; action required.
- Refunded or disputed.

The page must not provide:

- A withdraw amount input.
- “Withdraw all.”
- Transfer to another user.
- Top-up.
- Spend balance.
- Cash-like available balance controlled by the merchant.

### 11.2 Payout beneficiary verification

Merchant account authentication and financial beneficiary verification are different controls.

Target process:

1. Merchant completes Takeer KYC/KYB appropriate to account type.
2. Seller is onboarded with the PSP where required.
3. Seller supplies payout account through PSP-hosted onboarding or Takeer transmits it securely under contract.
4. PSP verifies account/network and beneficiary identity where supported.
5. Takeer records PSP verification status and reference.
6. Payouts remain disabled until verification succeeds.
7. Credential changes trigger step-up authentication, out-of-band notice, cooling-off period, and PSP re-verification.

Use states such as:

```text
draft
pending_provider_verification
verified
rejected
suspended
expired
```

Do not set `verified` solely because the merchant entered valid-looking details.

### 11.3 Payout batching

Per-order payout is preferred. If provider minimums make batching necessary:

- Confirm batching is permitted under the PSP product.
- Keep funds within the PSP's approved structure.
- Link every payout amount to order settlement allocations.
- Disclose threshold and maximum waiting time to sellers.
- Trigger automatically; seller must not choose indefinite storage.
- Never convert the batch total into a Takeer wallet balance.

## 12. Platform fees and profitability

Takeer remains entitled to earn marketplace fees. The safe implementation is:

1. Takeer calculates the fee under a snapshotted fee policy.
2. Buyer and seller disclosures show who bears the fee.
3. The PSP uses split settlement or another contractually approved settlement instruction.
4. The seller principal is paid directly to the seller.
5. Takeer's fee is paid directly to AVLY TECH GROUP's designated account.
6. Provider charges and taxes are separately recorded.

Do not collect the full seller principal into Takeer's operating account and later pay sellers merely to deduct commission.

Finance and Tanzanian tax advisers must confirm:

- VAT treatment of Takeer's service fee.
- Tax invoice or fiscal receipt obligations.
- Seller responsibility for customer sales receipts.
- Provider-fee documentation.
- Withholding obligations for relevant seller/creator arrangements.

## 13. Refunds, reversals, and chargebacks

### 13.1 Refund process

1. Takeer determines eligibility under the snapshotted marketplace policy.
2. Authorised service creates an idempotent provider refund record.
3. PSP performs refund through original rail where possible.
4. PSP callback/status query confirms outcome.
5. Takeer updates order settlement and entitlements/fulfillment.
6. Buyer and seller receive clear status communication.

### 13.2 After seller payout

If a refund or chargeback occurs after the PSP paid the seller:

- Follow the PSP contract and Merchant Agreement.
- Record any merchant debt or reserve transparently.
- Do not silently create a negative wallet.
- Do not deduct unrelated order proceeds without a clearly disclosed and enforceable contractual mechanism.
- Maintain evidence and appeal process.

### 13.3 Unknown and duplicate outcomes

Never issue a second refund or payout merely because the first API call timed out. Query provider status and reconcile before retrying.

## 14. Seller identity, KYC/KYB, and provider onboarding

Takeer's marketplace responsibilities remain important even when the PSP handles payments.

### 14.1 Individual sellers

Collect and verify the risk-appropriate identity, contact and address information required by platform policy and the PSP arrangement.

### 14.2 Businesses

Collect and verify as required:

- Legal business name.
- Business type.
- Registration/BRELA information.
- TIN and relevant licences.
- Registered and operating address.
- Directors or authorised representative.
- Ultimate beneficial owners where required.
- Expected category, volume and ticket size.
- PSP seller/submerchant identifier.

### 14.3 Responsibility matrix

Create a signed matrix covering:

| Control | Takeer | PSP | Shared/evidence |
| --- | --- | --- | --- |
| Marketplace seller eligibility |  |  |  |
| Identity/business verification |  |  |  |
| Beneficial ownership |  |  |  |
| Beneficiary account verification |  |  |  |
| Sanctions/PEP screening |  |  |  |
| Transaction monitoring |  |  |  |
| Suspicious activity escalation/reporting |  |  |  |
| Complaints |  |  |  |
| Refunds/chargebacks |  |  |  |
| Record retention |  |  |  |
| Regulatory requests |  |  |  |

No control may be assumed to be “handled by the PSP” without contractual confirmation.

## 15. Terms, disclosures, and clickwrap

### 15.1 Required documents

Create clean, counsel-approved documents:

1. Buyer Terms of Service.
2. Merchant Marketplace Agreement.
3. Payment and PSP Processing Terms.
4. Refund, Return, Cancellation, and Dispute Policy.
5. Fee and Payout Schedule.
6. Privacy Notice and merchant data-use terms.
7. Restricted Products and Services Policy.
8. Complaints and Redress Procedure.

The existing `MERCHANT_AGREEMENT.md` must not be used as an executable agreement in its present form because it contains drafting commentary, strategic advice, an unrelated NDA, and unsupported regulatory claims.

### 15.2 Core merchant disclosures

Subject to counsel wording:

- Seller remains the seller of record for its goods/services unless a different model is expressly adopted.
- Takeer provides marketplace, ordering, fulfillment, dispute, and customer-protection technology.
- Named licensed PSPs process payment and payout.
- Takeer does not offer a deposit or general-purpose wallet.
- Earnings shown in Takeer are order-status reports, not transferable electronic money.
- PSP onboarding and processing terms may apply.
- Seller appoints/authorises the required parties only within the contractually approved flow.
- Payment discharge, reversal, fraud, and chargeback treatment is clear.
- Release triggers, review windows, refunds, fees, payout timing, failed payouts, and account changes are explained.
- Takeer can pause an order release for a documented dispute, fraud, legal, or compliance reason.

### 15.3 Buyer disclosures

Before payment, show:

- Seller identity.
- Product/service and fulfillment terms.
- Total price, currency, delivery fee, and applicable charges.
- PSP/payment method.
- Refund and dispute summary.
- Whether settlement waits for delivery or access confirmation.
- Contact and complaint route.

### 15.4 Versioned acceptance evidence

Add:

```text
legal_documents
- document_type
- version
- effective_at
- content_hash_sha256
- immutable_storage_uri
- approval_reference
- status

legal_acceptances
- legal_document_id
- user_id
- merchant_id nullable
- accepted_at
- ip_address
- user_agent
- locale
- acceptance_action
- evidence_payload
```

Rules:

- No preselected acceptance.
- Store exact document version and hash.
- Require re-acceptance for material changes before new sales or payouts.
- Make evidence exportable.

## 16. Order-to-PSP reconciliation

Takeer does not need to operate a safeguarding ledger if the PSP controls funds, but it must reconcile its commerce records to provider evidence.

### 16.1 Reconciliation objectives

For each provider, channel, seller, currency, and business date identify:

- Takeer payment attempts versus PSP transactions.
- Confirmed PSP payments versus paid Takeer orders.
- Takeer release requests versus PSP payout instructions.
- PSP completed payouts versus Takeer paid-out orders.
- Takeer refund requests versus PSP completed refunds.
- Duplicate, missing, mismatched, reversed, or stale transactions.
- Provider fees and Takeer split amounts.

### 16.2 Reconciliation records

```text
provider_reconciliation_runs
- provider_id
- business_date
- source_type
- source_reference
- source_hash
- expected_count / actual_count
- expected_amount_minor / actual_amount_minor
- currency
- difference_amount_minor
- status
- started_at / completed_at
- reviewed_by / reviewed_at

provider_reconciliation_breaks
- reconciliation_run_id
- break_type
- order_id nullable
- payment_attempt_id nullable
- provider_payout_id nullable
- provider_reference nullable
- amount_minor
- currency
- severity
- status
- owner
- first_seen_at
- resolution
- resolved_at nullable
- approved_by nullable
```

### 16.3 Schedule

- Near-real-time status reconciliation for ambiguous callbacks.
- Frequent polling for pending pay-ins and payouts.
- Daily provider transaction/settlement reconciliation.
- Monthly provider and fee summary review.
- Immediate alert for paid-without-provider-confirmation, payout duplication, amount mismatch, or unexplained material break.

## 17. Audit trail and record retention

### 17.1 Required audit chain

For each order, Takeer must reconstruct:

```text
order created
→ payment attempt created
→ PSP request
→ authenticated PSP payment event
→ fulfillment events
→ release decision and evidence
→ PSP payout request
→ authenticated payout result
→ refund/dispute events if any
→ final settlement state
```

### 17.2 Immutability

- Provider events are append-only.
- Financial status changes create transition records.
- Corrections use reversal/compensating events rather than history edits.
- Administrator actions capture actor, reason, previous state, new state, approval, and evidence.
- Prohibit direct balance edits because the target system has no user balance.

### 17.3 Retention

Adopt a counsel- and PSP-approved retention schedule covering payment, marketplace, tax, AML/KYC, contract, complaint, dispute, and privacy requirements. Design payment transaction evidence for at least the applicable regulatory period; where PSP-agent or payment-system requirements apply, account for the ten-year transaction-record requirement in the Payment Systems Licensing and Approval Regulations.

Support legal holds and authorised destruction. Do not delete records subject to a dispute, investigation, audit, regulatory request, or litigation.

## 18. Security and access controls

- MFA for administrators and sensitive merchant actions.
- Step-up authentication for payout-beneficiary changes.
- Cooling-off period after beneficiary change.
- Role separation between customer support, payment operations, compliance, finance, and system administration.
- Maker-checker approval for manual refunds, release overrides, dispute resolutions, and payout retries above thresholds.
- Least-privilege PSP credentials separated by collection, payout, refund, and query purpose where supported.
- Secrets stored in an approved secret manager.
- Key rotation, revocation, ownership, and expiry records.
- Redaction of phone numbers, tokens, signatures, account details, and KYC data from ordinary logs.
- Encryption of sensitive provider payloads and credentials.
- Monitoring for callback failures, replay attacks, account takeover, and unusual payout changes.
- Tested payment kill switches by provider and direction.
- Security review and penetration test before general availability.

## 19. Consumer complaints and marketplace disputes

Takeer remains responsible for providing an accessible marketplace complaint process even where PSP payment complaints are escalated to the provider.

Case records should include:

- Buyer or seller.
- Order and PSP reference.
- Complaint category.
- Received, acknowledged, due and resolved timestamps.
- Communications and evidence.
- Takeer decision.
- PSP escalation and provider case reference.
- Refund or payout outcome.
- Root cause and corrective action.

Provide understandable English and Swahili information. Define internal and provider escalation timelines. Do not send users back and forth without a named case owner.

## 20. Immediate removal of prohibited payment features

Takeer has not been deployed, so there are no customer balances, seller liabilities, completed withdrawals, or production payment records to migrate. Remove the prohibited design completely before building the replacement flow.

### 20.1 Delete database structures

- Delete wallet creation and alteration migrations.
- Delete withdrawal-request creation and alteration migrations.
- Delete provider treasury account and reservation migrations.
- Remove wallet and withdrawal foreign keys or columns from unrelated tables.
- Remove wallet, withdrawal, and treasury seed data and admin settings.
- Remove enum values such as `takeer_wallet`. If bookkeeping needs a non-cash external-payment category, give it an accurate provider-neutral name such as `external_psp` and ensure it cannot activate platform value.
- Update the base migration chain so a fresh database never creates these structures.

Do not add “drop legacy tables” migrations. With no production database to preserve, the correct day-one schema is one that never contains the prohibited tables.

### 20.2 Delete backend behaviour

- Delete wallet and withdrawal models that have no permitted remaining purpose.
- Delete `WalletService`, `AutomaticWithdrawalService`, `WithdrawalPolicyService`, withdrawal quote/accounting/failure-recovery services, and Takeer treasury services.
- Delete merchant wallet and withdrawal controllers and endpoints.
- Delete admin withdrawal approval, platform-wallet, payout-policy, and treasury endpoints.
- Remove wallet creation from buyer registration, merchant registration, checkout, posts, chat, and all other paths.
- Replace every wallet credit/debit or escrow-release call with the new order-settlement or PSP payout service.
- Remove manual balance adjustment and administrator payout-completion behaviour.
- Delete the placeholder M-Pesa webhook instead of retaining a disabled compatibility path.

### 20.3 Delete frontend behaviour

- Delete the current merchant Wallet and withdrawal modal.
- Delete admin Withdrawals, Platform Wallet, and Takeer treasury screens.
- Remove wallet permissions, navigation, dashboard cards, notifications, translations, help text, and deep links.
- Build a new Earnings and Payouts page from order settlement and PSP payout records. Do not reuse wallet request/response structures.

### 20.4 Delete tests and replace them with boundary tests

- Delete tests that assert wallet crediting, frozen balances, manual withdrawals, automatic wallet sweeping, Takeer treasury reservations, or administrator approval of withdrawals.
- Add tests that fail if prohibited tables, routes, services, UI actions, or settings exist.
- Add a clean-database schema test asserting that `wallets`, `withdrawal_requests`, `provider_treasury_accounts`, and `provider_treasury_reservations` do not exist.
- Add an architecture test asserting payment and release services do not reference wallet or withdrawal classes.

### 20.5 Removal exit criteria

- A fresh migration succeeds without prohibited tables or columns.
- Repository searches show no active wallet, withdrawal, or Takeer treasury implementation.
- No route permits deposits, balances, cash-out, arbitrary withdrawals, or internal transfers.
- No callback, release, refund, dispute, checkout, or fulfillment path mutates a user balance.
- Only approved marketplace reporting terminology remains.

## 21. Application change map

This is the initial repository impact map. Exact edits should follow approved ADRs.

| Component | Intended change |
| --- | --- |
| `app/Payments/PaymentCallbackProcessor.php` | Replace wallet crediting with validated payment event and `order_settlements` creation |
| `app/Http/Controllers/Api/PaymentWebhookController.php` | Delete placeholder M-Pesa webhook; future support must use a new verified provider adapter |
| `app/Http/Controllers/Api/Payments/SelcomCallbackController.php` | Enforce callback verification and validated event processing |
| `app/Payments/Drivers/Selcom/SelcomGateway.php` | Implement real callback authentication |
| AzamPay/Flutterwave/ClickPesa adapters | Confirm current provider protocol and implement common verified adapter contract |
| `app/Services/WalletService.php` | Delete |
| `app/Services/AutomaticWithdrawalService.php` | Delete; create a separate order-allocated PSP payout orchestrator |
| `app/Services/WithdrawalPolicyService.php` | Delete |
| `app/Http/Controllers/Api/MerchantWalletController.php` | Delete; create a separate Earnings and Payouts reporting controller |
| `app/Http/Controllers/Api/MerchantPayoutCredentialController.php` | Add provider verification states and remove local automatic verification |
| `app/Services/ProviderTreasuryService.php` | Delete; provider operational state belongs in PSP status and reconciliation services |
| `resources/js/Pages/Merchant/Wallet.jsx` | Delete; build a new Earnings and Payouts page from order and PSP records |
| Admin payout and platform wallet pages | Delete; build separate PSP exceptions, reconciliation, and provider-status operations |
| `resources/js/Pages/Terms.jsx` | Replace with approved marketplace/PSP role disclosures |
| `MERCHANT_AGREEMENT.md` | Retire as executable agreement; replace with clean legal document |
| `bootstrap/app.php` | Add payout recovery, reconciliation, stale-release, and exception monitoring schedules |
| Checkout and chat payment simulations | Enforce non-production-only execution and use shared payment-attempt domain |
| Delivery and buyer escrow controllers | Replace wallet release calls with settlement release service |
| Refund/admin dispute handlers | Replace wallet debits with PSP refund and settlement adjustments |

## 22. Required ADRs and specifications

Create and approve:

1. `ADR-001-marketplace-payment-boundary.md`
2. `ADR-002-psp-selection-and-marketplace-contract.md`
3. `ADR-003-order-settlement-data-model.md`
4. `ADR-004-provider-callback-authentication.md`
5. `ADR-005-direct-seller-payout-orchestration.md`
6. `ADR-006-refunds-disputes-and-release-rules.md`
7. `ADR-007-prohibited-payment-feature-removal.md`
8. `ADR-008-provider-reconciliation.md`
9. `ADR-009-payment-record-retention-and-privacy.md`

Every ADR must contain regulatory assumptions, alternatives, selected decision, provider dependency, security consequences, clean-schema impact, failure handling, rollback, and approvers.

## 23. Implementation phases

### Phase 0 — Confirm business and regulatory boundary

Deliverables:

- Board-approved statement that Takeer is not pursuing a PSP or stored-value business model.
- Final money-flow diagram.
- Provider questionnaire responses.
- Selected PSP marketplace product.
- Counsel opinion and BoT engagement decision.
- Responsibility matrix.

Exit criteria:

- The selected provider contract supports the target flow.
- No unresolved question about who holds and pays seller funds.

### Phase 1 — Delete out-of-bound payment features

Deliverables:

- Delete the unauthenticated placeholder M-Pesa callback.
- Enforce Selcom callback verification or keep Selcom production integration disabled.
- Production guards around all simulation payment paths.
- Delete wallet, withdrawal, payout-policy, and Takeer treasury migrations, models, services, controllers, routes, UI, settings, permissions, and tests.
- Clean-database and architecture-boundary tests proving prohibited features do not exist.
- Feature flags for collection, PSP payout, release, and refunds.

Exit criteria:

- No callback can create a paid order without authentication and amount/currency validation.
- A fresh database contains no wallet, withdrawal, or Takeer treasury schema.
- No prohibited payment feature remains callable or visible.

### Phase 2 — Build payment attempts and provider events

Deliverables:

- New migrations and models.
- Common PSP adapter contract.
- Secure provider callback pipeline.
- Replay protection.
- Independent provider status verification.
- Sensitive log redaction.

Exit criteria:

- Every paid order has one validated provider event matching exact expected values.

### Phase 3 — Build order settlement domain

Deliverables:

- `order_settlements` and state machine.
- Category release-rule snapshots.
- Settlement transition audit.
- Payment processor no longer credits wallets.
- Earnings reporting derived from order settlements.

Exit criteria:

- New transactions create no wallet or frozen-balance movement.
- Merchant totals are fully derivable from orders.

### Phase 4 — Direct PSP seller payouts

Deliverables:

- PSP seller payment profiles.
- Provider beneficiary verification statuses.
- Payout and payout-allocation domain.
- Idempotent payout queue and status recovery.
- PSP split-fee integration where supported.
- Earnings and Payouts UI without withdrawals.

Exit criteria:

- Every payout is PSP-executed and fully allocated to orders.
- Takeer holds no merchant-selected cash balance.

### Phase 5 — Refunds, disputes, and release conversion

Deliverables:

- PSP refund domain.
- Formal dispute/hold state machine.
- All existing delivery and digital release paths use settlement release service.
- Refund, failed payout, and unknown-status operations queues.

Exit criteria:

- No active flow manipulates wallet balances for release or refund.

### Phase 6 — Terms, KYC linkage, complaints, and reconciliation

Deliverables:

- Counsel-approved legal documents.
- Versioned clickwrap.
- PSP seller onboarding status.
- Provider reconciliation runs and break management.
- Complaints and PSP escalation case management.
- Record-retention and privacy controls.

Exit criteria:

- Sellers cannot collect or receive payouts without required agreement and provider readiness.

### Phase 7 — Clean implementation verification

Deliverables:

- Fresh installation and full migration rehearsal from an empty database.
- Repository-wide prohibited-feature scan.
- Route, permission, menu, job, event, notification, and configuration review.
- Architecture tests confirming all commerce money paths use PSP and order-settlement services.
- Removal of unused dependencies, dead code, obsolete tests, and misleading terminology.

Exit criteria:

- No wallet, withdrawal, internal cash-out, or Takeer treasury implementation exists.
- The first production deployment creates only the compliant target schema.

### Phase 8 — Controlled production pilot

Deliverables:

- Low-volume, capped merchant cohort.
- Real payment, delivery release, payout, refund, failed payout, and dispute certification.
- Daily provider reconciliation.
- Security test and production-readiness review.
- Legal, compliance, finance, operations, security, engineering, PSP, and Board sign-offs.

Exit criteria:

- All definition-of-done controls pass using real production evidence.

### Phase 9 — Scale-up

- Expand sellers, volume and categories in cohorts.
- Review callback errors, payout time, reconciliation breaks, refunds, disputes, fraud, and complaints before every increase.
- Keep new providers, countries, currencies, wallets, credit and cross-border flows disabled until separately reviewed.

## 24. Feature flags and kill switches

Implement centrally audited flags:

```text
payments_collection_enabled
provider_{key}_payin_enabled
provider_{key}_payout_enabled
provider_{key}_refund_enabled
payment_release_enabled
automatic_order_payout_enabled
cross_border_payments_enabled = false
currency_{code}_enabled
```

Production changes require actor, reason, ticket/reference, timestamp, old/new value, and maker-checker approval for high-risk flags.

Kill switches must be able to stop independently:

- New payment initiation.
- Callback processing after safe event preservation.
- Order release.
- Seller payout submission.
- Refund submission.
- A single provider, channel, currency, or country.

## 25. Automated test plan

### 25.1 Boundary tests

- New buyer payment never creates or increments a wallet.
- Release never moves an internal merchant balance.
- Merchant cannot request an arbitrary withdrawal.
- Merchant cannot transfer, spend, deposit, or top up earnings.
- Every displayed earnings amount is derived from order settlements.
- Every payout allocation references released orders.
- Application cannot mark beneficiary verified without provider/manual verification evidence.
- Takeer fee and seller amount use the PSP-approved allocation.

### 25.2 Callback tests

- Valid signature accepted.
- Missing, invalid and malformed signature rejected.
- Raw-body alteration rejected.
- Replay and duplicate events do not repeat fulfillment or payout.
- Wrong amount rejected.
- Wrong currency rejected.
- Wrong seller/submerchant rejected.
- Wrong provider/channel rejected.
- Duplicate provider reference rejected.
- Provider status disagreement enters review.
- Concurrent successful callbacks produce one transition.

### 25.3 Settlement tests

- Physical order cannot release before eligible fulfillment evidence.
- Active dispute blocks release.
- Review-window auto-release is idempotent.
- Digital access grant and release are idempotent.
- Paid-out status requires PSP completion evidence.
- Payout failure does not create wallet credit.
- Payout timeout does not trigger duplicate payout.
- Batched payout exactly equals its order allocations.

### 25.4 Refund tests

- Refund is linked to original PSP transaction.
- Duplicate refund request is idempotent.
- Partial refund respects remaining refundable amount.
- Refund cannot exceed payment.
- Completed refund revokes or adjusts entitlement where policy requires.
- Post-payout refund records transparent merchant recovery treatment.

### 25.5 Clean-schema and architecture tests

- Fresh migrations do not create wallet, withdrawal, or Takeer treasury tables.
- Prohibited wallet and withdrawal routes are absent.
- Prohibited services and models are absent from the container and source tree.
- Payment, release, refund, dispute and payout code has no dependency on deleted features.
- Rollback and retry behaviour does not duplicate payments, payouts, or refunds.

### 25.6 Legal and access tests

- Merchant must accept current required agreements.
- Exact accepted document hash is exportable.
- Material document change blocks new activity until re-acceptance.
- Unauthorised staff cannot release, refund, retry, or change beneficiary.
- Maker-checker thresholds are enforced.

## 26. Provider certification scenarios

Run in sandbox and then controlled low-value production:

1. Successful collection.
2. Buyer rejection/failure.
3. Timeout followed by eventual success.
4. Duplicate success callback.
5. Forged/invalid callback.
6. Amount and currency mismatch.
7. Independent payment status query.
8. Physical delivery release.
9. Digital access release.
10. Direct seller payout success.
11. Payout failure.
12. Unknown payout status and recovery.
13. Beneficiary change and verification.
14. Full and partial refund.
15. Duplicate refund.
16. Provider reversal/chargeback.
17. Settlement/transaction export reconciliation.
18. Callback key rotation.
19. Provider outage and kill-switch exercise.

Retain provider sign-off and transaction references as compliance evidence.

## 27. Monitoring and alerts

Monitor:

- Signature validation failures.
- Replay attempts.
- Payment amount/currency mismatches.
- Paid orders without validated PSP event.
- Valid PSP payments without matched Takeer order.
- Release-eligible orders not submitted within SLA.
- Payouts processing or unknown beyond threshold.
- PSP payout completed without allocations.
- Order paid out more than once.
- Refund mismatch or duplicate.
- Reconciliation differences and ageing.
- Beneficiary changes followed by payout attempts.
- Seller PSP onboarding expiry or suspension.
- Any reintroduction of wallet, withdrawal, internal transfer, or Takeer treasury terminology or code.
- Privileged override volume.
- Complaints approaching deadlines.

High-severity alerts must name an owner and, where appropriate, automatically pause the affected provider or money-movement direction.

## 28. Required operating procedures

Document and train staff on:

1. PSP seller onboarding and eligibility.
2. Beneficiary verification and changes.
3. Payment callback mismatch review.
4. Order release review and overrides.
5. Failed/unknown payout handling.
6. Refund, reversal and chargeback processing.
7. Buyer disputes and merchant evidence.
8. Provider reconciliation and break resolution.
9. Consumer complaints and PSP escalation.
10. Payment security incidents and provider key compromise.
11. Provider outage and kill-switch activation.
12. Prohibited-feature detection and architecture-boundary enforcement.
13. Record retention, legal hold and authorised destruction.
14. New provider/country/currency approval.

Every procedure must define owner, backup, inputs, service level, steps, approval thresholds, evidence, escalation, version, training date, and review frequency.

## 29. Compliance evidence pack

Maintain:

- Business model and boundary approval.
- Money-flow diagram.
- Legal opinion and BoT correspondence where applicable.
- PSP licence/product evidence and executed contract.
- Responsibility matrix.
- Provider onboarding and certification evidence.
- ADRs and architecture approvals.
- Legal document versions and acceptance exports.
- Callback security test results.
- Penetration test and remediation.
- Daily/monthly reconciliation evidence.
- Clean-schema verification and prohibited-feature removal evidence.
- KYC/KYB and beneficiary verification control samples.
- Complaint, dispute, refund and incident registers.
- Access reviews, key rotations, backups and kill-switch exercises.
- Production readiness and Board sign-off.

## 30. Definition of done

The remediation is complete only when:

- Takeer's production architecture matches the approved marketplace money flow.
- Enabled PSP contracts cover marketplace collection, conditional settlement, direct seller payout, refunds and Takeer fees as implemented.
- Counsel has confirmed the classification and any required BoT engagement is complete.
- Buyer funds do not enter Takeer's ordinary operating account as seller principal.
- Wallets, frozen balances, withdrawal requests, withdrawal policies, and Takeer treasury structures do not exist in the production schema or active code.
- Sellers cannot deposit, transfer, spend, store indefinitely, or withdraw arbitrary value through Takeer.
- Merchant earnings are derived exclusively from order settlement records.
- Every seller payout is executed by a licensed PSP and allocated to specific released orders.
- Every refund is PSP-executed and linked to its original payment/order.
- Every enabled callback is authenticated, replay-protected, amount/currency matched and idempotent.
- Payout beneficiary status comes from an approved verification process.
- Terms accurately identify Takeer as marketplace and PSPs as payment processors.
- Agreement acceptance is versioned and provable.
- Order, payment, delivery, release, payout, refund and dispute events form a complete audit chain.
- Daily reconciliation identifies and resolves PSP/order differences.
- A fresh production migration creates only the approved marketplace and PSP integration schema.
- Repository, route, UI and architecture tests prove wallet, withdrawal and platform-treasury features were deleted rather than disabled.
- Automated tests, provider certification, security review and controlled pilot pass.
- Legal, compliance, finance, operations, security, engineering, PSP and Board approvals are recorded.

## 31. Post-launch guardrail

Any proposal involving the following automatically triggers a new legal and architecture review before implementation:

- Wallets or stored balances.
- Cash top-ups or cash-outs.
- Earnings spent inside Takeer.
- User-to-user transfers.
- Seller advances, credit or lending.
- Takeer-controlled payout float.
- Cross-border payments or payouts.
- New countries or currencies.
- New PSP or payment method.
- Changes to who legally holds funds.
- Longer settlement holds.
- Takeer becoming merchant of record.

This guardrail prevents gradual product expansion from unintentionally moving Takeer back into payment-provider activity.

---

## Appendix A — Prioritised backlog

### P0 — Immediate boundary and security

- Select and contract the PSP marketplace product.
- Obtain targeted legal classification.
- Delete the unauthenticated placeholder M-Pesa callback.
- Implement Selcom callback verification before enabling it.
- Add amount/currency/provider/reference validation.
- Delete wallet, withdrawal, withdrawal-policy, and Takeer treasury implementation.
- Add feature flags and production kill switches.
- Add clean-schema and prohibited-feature architecture tests.

### P1 — Replacement money flow

- Build payment attempts and provider events.
- Build order settlements and release state machine.
- Build PSP seller profiles and beneficiary verification state.
- Build direct PSP payouts and order allocations.
- Build PSP refunds.
- Remove wallet credits from all payment and release paths.
- Replace Merchant Wallet UI with Earnings and Payouts.

### P2 — Compliance operations and launch assurance

- Replace legal documents and add clickwrap.
- Build reconciliation and exception queues.
- Formalise complaints and dispute procedures.
- Verify from an empty database that prohibited payment structures are absent.
- Complete repository-wide dead-code and misleading-terminology removal.
- Complete provider production certification and penetration testing.
- Run controlled pilot and collect approvals.

## Appendix B — Prohibited implementation shortcuts

- Do not rename `wallet` to `earnings` while preserving arbitrary withdrawals.
- Do not treat a normal corporate collection account as a marketplace safeguarding arrangement without provider confirmation.
- Do not route full seller principal through Takeer's operating account merely to deduct commission.
- Do not accept a callback because it contains a valid-looking order reference.
- Do not use IP allowlists as a substitute for cryptographic authentication.
- Do not mark payout accounts verified merely because an OTP was successful.
- Do not mark an order `paid_out` when Takeer only submitted a payout.
- Do not retry unknown payout or refund requests without provider reconciliation.
- Do not sweep aggregate balances while claiming settlement is order-specific.
- Do not manually edit balances or settlement totals to fix reconciliation.
- Do not use “escrow,” “BoT approved,” “guaranteed,” or “instant payout” without legal and factual support.
- Do not assume all responsibilities move to the PSP unless the contract says so.

## Appendix C — Success statement

At successful completion, Takeer should be able to demonstrate the following in one sentence and with supporting evidence:

> Takeer records and manages marketplace orders, fulfillment and customer-protection decisions, while licensed PSPs exclusively collect, control, refund and settle the corresponding money directly to verified sellers and AVLY TECH GROUP's disclosed fee account.
