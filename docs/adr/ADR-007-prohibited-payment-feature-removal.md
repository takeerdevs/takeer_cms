# ADR-007: Prohibited payment feature removal

## Regulatory assumptions
No production balances or liabilities require compatibility, so prohibited features can be removed from the source and fresh schema.

## Alternatives
Keep disabled wallet tables; add a read-only compatibility layer; or delete wallet, withdrawal, treasury, and placeholder callback implementation.

## Selected decision
Delete the prohibited implementation, routes, screens, services, migrations, settings, and tests; retain only order-specific provider records and approved external-POS reporting.

## Provider dependency
No provider treasury or corporate float is represented by Takeer; provider status is recorded from the provider.

## Security consequences
There is no balance-edit or arbitrary cash-out surface for privilege escalation or account takeover.

## Clean-schema impact
Fresh migrations do not create wallet, withdrawal, or Takeer treasury tables; obsolete columns are removed.

## Failure handling
Legacy references fail closed and are reviewed as architecture regressions.

## Rollback
Rollback means reverting the code change before deployment, never restoring a customer-money feature in production.

## Approvers
Board representative, counsel, finance, security, engineering, and operations.
