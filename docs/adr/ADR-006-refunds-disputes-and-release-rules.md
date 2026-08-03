# ADR-006: Refunds, disputes, and release rules

## Regulatory assumptions
Takeer decides marketplace eligibility and evidence; the PSP executes the refund or settlement movement.

## Alternatives
Debit a Takeer wallet; mark refunds complete at approval; or create an order-linked provider refund and await provider outcome.

## Selected decision
Snapshot release/refund policy at order creation, record disputes and holds as order states, and keep refund amounts requested separate from amounts completed.

## Provider dependency
The PSP must support original-rail refunds, partial refunds, reversals, status queries, callbacks, and post-payout recovery terms.

## Security consequences
Active disputes block release; refunds are idempotent and linked to the original provider transaction.

## Clean-schema impact
`provider_refunds` and settlement transitions replace wallet debits and escrow-release mutations.

## Failure handling
Unknown refunds remain pending/provider exception; no second refund is sent without provider reconciliation.

## Rollback
Pause new releases/refunds while preserving policy snapshots, evidence, and provider cases.

## Approvers
Operations, customer protection, finance, payments engineering, counsel, and the PSP.
