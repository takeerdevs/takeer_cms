# ADR-004: Provider callback authentication

## Regulatory assumptions
An order reference alone is not evidence of payment. Provider-specific authentication and status requirements govern trust.

## Alternatives
Trust payloads by reference/IP; authenticate only in controllers; or record raw requests and use a verified adapter pipeline.

## Selected decision
Record raw bytes first, authenticate with the provider adapter, enforce timestamp/replay and exact amount/currency/provider checks, then transition state atomically.

## Provider dependency
Signature/MAC algorithms, key rotation, signed fields, status queries, and acknowledgement semantics come from each provider contract.

## Security consequences
Invalid events are preserved but cannot grant access, dispatch fulfillment, release, refund, or mark payout complete.

## Clean-schema impact
`provider_events` is append-only with encrypted raw body, hash, filtered headers, validation state, and replay key.

## Failure handling
Unknown, malformed, duplicate, or mismatched events enter review; duplicates are acknowledged without repeating business actions.

## Rollback
Disable the affected callback direction/provider and use independent status queries or certified provider support.

## Approvers
Security, payments engineering, provider technical contact, compliance, and counsel.
