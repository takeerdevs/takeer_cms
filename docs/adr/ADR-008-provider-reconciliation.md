# ADR-008: Provider reconciliation

## Regulatory assumptions
Reconciliation verifies order/provider evidence; it is not a safeguarding or merchant-balance ledger.

## Alternatives
Trust callbacks only; reconcile a Takeer treasury balance; or ingest provider exports/status evidence into dated runs and breaks.

## Selected decision
Run daily provider reconciliation for pay-ins, payouts, refunds, fees, and reversals, with explicit source hash, expected/actual totals, and break ownership.

## Provider dependency
Each provider must supply a transaction export, statement, balance/status API, or equivalent evidence and reference format.

## Security consequences
Reports are hashed, mismatches alert operations, and no manual balance edit is permitted to clear a break.

## Clean-schema impact
`provider_reconciliation_runs` and `provider_reconciliation_breaks` store dated exception evidence linked to orders and payout records.

## Failure handling
Missing, duplicate, stale, unmatched, or amount/currency-mismatched records remain open until provider evidence resolves them.

## Rollback
Pause affected provider direction and retain the incomplete run for investigation.

## Approvers
Finance, operations, payments engineering, security, compliance, and the provider.
