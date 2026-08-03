# ADR-001: Marketplace payment boundary

## Regulatory assumptions
Takeer operates as an e-commerce marketplace and does not issue stored value, hold customer funds, or operate a payment system. Tanzania counsel and each PSP must confirm the classification and any BoT engagement before production.

## Alternatives
Operate a Takeer wallet/escrow ledger; collect principal into an AVLY operating account; or use a licensed PSP marketplace product.

## Selected decision
Use a PSP-controlled collection, refund, settlement, and direct seller-payout flow. Takeer stores only order-specific commerce and provider-status records.

## Provider dependency
The enabled PSP contract must identify the licensed entity, custody structure, seller onboarding, split fees, release, payout, refund, and reconciliation capabilities.

## Security consequences
All state-changing callbacks require cryptographic authentication, exact order matching, replay protection, and locked transitions.

## Clean-schema impact
Wallet, withdrawal, treasury, and arbitrary-balance structures are absent; settlement tables are tied to orders and provider identifiers.

## Failure handling
Unknown provider results enter provider exception/reconciliation review and never create a Takeer balance.

## Rollback
Disable collection, release, payout, or refund flags and preserve provider events; do not reintroduce the deleted wallet model.

## Approvers
Engineering, finance, compliance, board representative, counsel, and the contracting PSP.
