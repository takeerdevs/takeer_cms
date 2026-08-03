# ADR-003: Order settlement data model

## Regulatory assumptions
Takeer may record commerce allocations and provider-reported status, but those records are not a stored-value account or claim managed as a wallet.

## Alternatives
Aggregate merchant balances; reuse the old transactions/wallet ledger; or create immutable order-linked attempts, events, settlements, and transitions.

## Selected decision
Use one `order_settlements` record per order, integer minor units, immutable fee/rule snapshots, and append-only transition evidence.

## Provider dependency
Amounts, currencies, seller allocations, and release timing must match the PSP-approved split/settlement contract.

## Security consequences
Amounts are server-derived, callback values are rechecked under lock, provider references are unique, and event payloads are encrypted.

## Clean-schema impact
The replacement migration creates payment attempts, provider events, order settlements, payout allocations, refunds, and reconciliation tables only.

## Failure handling
Mismatched amounts, currencies, provider references, or states are rejected into review without fulfillment or payout.

## Rollback
Stop new payment initiation and reconcile provider transactions; do not migrate back to mutable balances.

## Approvers
Engineering, finance, security, operations, and counsel.
