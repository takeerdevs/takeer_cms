# ADR-002: PSP selection and marketplace contract

## Regulatory assumptions
Provider licensing and product approval are external evidence, not claims that can be manufactured by application code.

## Alternatives
Enable any pay-in gateway; use a corporate collection account with manual payouts; or enable only providers that certify the marketplace product.

## Selected decision
Enable a provider only after written confirmation covers marketplace collection, verified sellers, PSP custody, order release, direct payout, refund, split fees, callbacks, and records.

## Provider dependency
Provider-specific terms, onboarding identifiers, callback keys, payout/refund APIs, status queries, and exports are mandatory configuration inputs.

## Security consequences
Provider credentials and callback verification are separated by direction where supported; raw callback secrets are redacted.

## Clean-schema impact
Provider profiles, attempts, events, payouts, refunds, and reconciliation records reference `payment_providers`; no provider treasury is created.

## Failure handling
An uncertified direction fails closed and places the related order in provider exception.

## Rollback
Disable the provider/channel and retain existing order and provider evidence for reconciliation.

## Approvers
Payments counsel, compliance, finance, security, engineering, and the provider signatory.
