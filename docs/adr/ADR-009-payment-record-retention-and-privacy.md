# ADR-009: Payment record retention and privacy

## Regulatory assumptions
Retention periods must be confirmed against Tanzanian law, PSP terms, tax obligations, privacy requirements, and legal holds.

## Alternatives
Log full callbacks; discard provider evidence; or encrypt raw event bodies while redacting ordinary logs and retaining exportable audit metadata.

## Selected decision
Encrypt raw provider payloads, store a hash and filtered headers, retain transition/legal acceptance evidence, and apply a counsel-approved retention schedule.

## Provider dependency
The PSP supplies required retention, retrieval, data-location, deletion, and incident obligations.

## Security consequences
Callback signatures, phone numbers, tokens, and KYC details are not copied to ordinary logs; access is least-privilege.

## Clean-schema impact
Provider event and legal acceptance records include hashes, immutable references, timestamps, and evidence fields without wallet data.

## Failure handling
Legal holds and disputes suspend destruction; failed exports or access requests are operational incidents.

## Rollback
Disable a new retention integration without deleting provider evidence; preserve the approved schedule and legal holds.

## Approvers
Privacy, security, finance, compliance, counsel, engineering, and the PSP.
