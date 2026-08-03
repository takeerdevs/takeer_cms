# ADR-005: Direct seller payout orchestration

## Regulatory assumptions
Takeer may authorise release of an order allocation; only the PSP pays the verified seller beneficiary.

## Alternatives
Merchant-selected withdrawals; aggregate sweeps; or order-allocated PSP payout instructions submitted by a durable queue.

## Selected decision
Create a provider payout and allocation only after release eligibility, then submit the exact amount with a stable idempotency key and await authenticated PSP completion.

## Provider dependency
Seller onboarding, beneficiary verification, payout method, submerchant identifiers, idempotency, status, and callback support must be certified.

## Security consequences
No arbitrary amount input or internal debit exists; payout completion is impossible without authenticated provider evidence.

## Clean-schema impact
Payouts reference seller PSP profiles and order allocations; no wallet, float, or treasury reservation is created.

## Failure handling
Submission failures and unknown timeouts become provider exceptions and are retried/reconciled with the same idempotency key.

## Rollback
Pause payout submission, preserve `release_requested`/`payout_processing` state, and query the provider before retrying.

## Approvers
Payments engineering, finance, security, operations, counsel, and the PSP.
