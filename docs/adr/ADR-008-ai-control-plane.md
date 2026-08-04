# ADR-008: Centralized AI control plane

- Status: Accepted
- Date: 2026-08-04

## Context

Takeer has several AI workloads and pays the upstream provider centrally. A single admin provider toggle, one API key, and hard-coded model IDs cannot support key rotation, task-specific model selection, user quotas, provider-cost accounting, or margin control.

## Decision

Use OpenRouter as the first gateway and model the AI layer with separate providers, encrypted credentials, model capabilities, task routes, usage records, credit transactions, and platform AI plans. Direct Gemini credentials are removed from the active admin configuration; Gemini remains available only as a model selected through OpenRouter. AI plans and wallets are scoped to either a user or a merchant business, with the triggering user retained as the actor.

Task services must request a capability by task key instead of naming a model directly. The router selects the primary model, fallback models, and a healthy credential. Credit reservations are idempotent and are settled or released after execution.

User and merchant credit balances use grant-level accounting. Free or promotional claims receive a unique claim key for a defined reset window, and each grant may expire independently. Plans expose claim frequency separately from payment billing interval, with `once`, `daily`, `weekly`, and `monthly` windows. Reservations allocate from the earliest-expiring grant first, which prevents a temporary free allowance from being hidden behind a permanent paid balance. Expired unused grants are removed through an auditable ledger transaction; repeated claims are idempotent.

## Consequences

- Takeer can rotate several OpenRouter keys without redeploying the application.
- Model choice can vary by product extraction, search, OCR, editing, and try-on.
- Provider spend and user charges can be reconciled independently.
- Failed attempts, fallback calls, provider pricing snapshots, and task/model date-range aggregates are visible in the admin AI usage audit.
- Merchant catalog/OCR usage cannot consume personal user search/try-on credits, and vice versa.
- Image-generation tasks still require a model/provider route that actually supports image output; text/vision models cannot be assumed to support try-on.
- AI search is a bounded server-side agent over read-only Takeer catalog tools. Product cards are interactive, but checkout and order mutation remain explicit UI actions outside the model tool set.
- The conversational endpoint streams provider deltas and tool progress over SSE, preserves a turn ID in usage metadata, and charges one shopper credit per completed turn while retaining every provider round for cost analysis.
- Payment checkout and customer-facing AI plan purchase remain separate integrations over the new credit/subscription primitives; classic search remains the safe fallback for guests, unsubscribed shoppers, and provider/tool failures.
- The customer-facing free-claim endpoint can safely evolve into monthly resets, promotional windows, merchant grants, and paid credit packs without reusing one aggregate balance as the source of truth.
