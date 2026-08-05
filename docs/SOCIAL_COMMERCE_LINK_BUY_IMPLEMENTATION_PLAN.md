# Takeer Social Commerce Link-Buy Implementation Plan

| Field | Value |
| --- | --- |
| Company | AVLY TECH GROUP LIMITED |
| Platform | Takeer |
| Initial market | Tanzania |
| Initial sources | Instagram posts/reels and Facebook Marketplace item listings |
| Version | 1.0 |
| Prepared | 5 August 2026 |
| Status | Proposed implementation plan |

## 1. Executive summary

Takeer will add a **Buy from Social Media** feature that lets a buyer paste a specific Instagram product post or Facebook Marketplace listing into Takeer and request to complete that purchase through Takeer's trusted commerce workflow.

The feature solves a common social-commerce trust problem:

- Buyers are afraid to pay an unknown social-media seller before receiving a product.
- Sellers are afraid to dispatch a product without reliable payment confirmation and a defined delivery process.
- Social posts often contain incomplete or stale price, stock, variant, delivery, and returns information.
- Informal conversations in DMs, SMS, and WhatsApp provide weak evidence when something goes wrong.

Takeer will bridge that gap without replacing Instagram or Facebook as discovery channels. Social networks remain where the buyer discovers the product. Takeer becomes the trusted transaction layer where the seller is identified, the product and offer are confirmed, the buyer pays through the configured licensed payment service provider, fulfillment is tracked, disputes and refunds are handled, and seller payout is requested after the applicable delivery and release conditions are satisfied.

The selected architecture is:

> A pasted social link creates a social-commerce purchase request, not an order. A Takeer order is created only after the seller claims the request, becomes eligible to sell, confirms the product and offer, and the buyer accepts the offer and supplies final checkout details.

This keeps unverified external data outside the trusted order ledger and allows the existing Takeer inquiry, payment, Safe-Chat, delivery, dispute, refund, and PSP-controlled settlement workflows to remain authoritative.

## 2. Product vision and positioning

### 2.1 Customer promise

Recommended primary label:

> **Buy safely from social media**

Recommended supporting copy:

> Found a product on Instagram or Facebook Marketplace? Paste the link, invite the seller to Takeer, and complete the purchase using Takeer's verified order, delivery, and buyer-protection process.

Recommended platform-specific actions:

- **Buy from Instagram**
- **Buy from Facebook Marketplace**
- **Paste product link**
- **Request this product on Takeer**

Takeer must not promise that scams are impossible or that every buyer will always receive exactly what they expected. Product language should promise a seller-confirmed order record, payment through an approved PSP flow, fulfillment evidence, delivery confirmation, dispute handling, and refund eligibility under the applicable policy.

### 2.2 Strategic role

The feature creates a two-sided acquisition loop:

```text
Buyer discovers an external product
  -> buyer brings purchase intent to Takeer
  -> Takeer invites the external seller
  -> seller registers or logs in
  -> seller creates a reusable Takeer product/store presence
  -> first protected transaction is completed
  -> seller shares Takeer links for future transactions
  -> more buyers and transactions move directly through Takeer
```

Takeer therefore acquires a buyer and potentially a merchant from a single high-intent request. The feature should be measured as a merchant-acquisition and GMV channel, not only as a link-preview utility.

## 3. Goals, non-goals, and success definition

### 3.1 Goals

1. Let a verified buyer submit a supported Instagram or Facebook Marketplace product URL in a mobile-first flow.
2. Preserve the original external link and attribution for audit and acquisition analytics.
3. Show a best-effort preview while clearly identifying external information as unverified.
4. Give the buyer safe, trackable ways to invite the seller.
5. Let an existing seller claim the request by logging in and choosing an eligible merchant profile.
6. Let a new seller register, verify their phone, complete the required merchant/KYC/PSP onboarding, and resume the exact request afterward.
7. Let the seller create or match a Takeer product and confirm price, stock, quantity, variant, condition, shipping, returns, and offer expiry.
8. Let the seller send a Takeer-generated checkout link to the original buyer.
9. Convert an accepted offer into the existing quoted physical inquiry order and continue through existing payment and fulfillment.
10. Give support and trust teams a complete audit trail and abuse controls.
11. Measure the full funnel from pasted link through confirmed PSP payout.

### 3.2 Non-goals for the first production release

- Scraping private posts, private profiles, DMs, or authentication-protected social content.
- Guaranteeing that every public Instagram or Marketplace URL can be fetched.
- Treating an observed price or AI-extracted product detail as seller-confirmed truth.
- Sending arbitrary Instagram or Facebook DMs from Takeer's backend where Meta does not provide the required recipient context and permission.
- Creating an order, collecting payment, or reserving inventory before the seller has confirmed the offer.
- Allowing unverified merchants to sell or receive payout.
- Building a Takeer wallet, stored value, or Takeer-controlled escrow balance.
- Rehosting external product media as a seller's permanent catalog image without authorization.
- Supporting general Facebook posts, profiles, groups, stories, or unsupported link types in the first release.

### 3.3 Release-complete outcome

The feature is complete when a buyer can paste either supported source, submit a request even when preview extraction fails, invite an unknown seller, allow that seller to register or log in and finish onboarding, allow the seller to publish or match the product and create an offer, receive the generated checkout link, accept and pay the quoted Takeer order, complete fulfillment, and reach the normal release/payout outcome with full audit and analytics coverage.

## 4. Non-negotiable trust and payment boundaries

### 4.1 External content is evidence, not commercial truth

The pasted URL, preview image, caption, seller handle, observed price, and buyer screenshot are untrusted external evidence. They may be stale, edited, misleading, or associated with an impersonator.

Only the seller-confirmed Takeer product and offer define:

- Seller identity.
- Product title and description.
- Product condition.
- Authorized product images.
- Variant and quantity.
- Unit price and currency.
- Stock availability.
- Delivery method and charge.
- Return terms.
- Offer expiry.

The buyer must accept that final snapshot before payment.

### 4.2 Request boundary

A `social_commerce_request` is a lead and negotiation record. It must not:

- Have a payment status.
- Trigger a PSP collection.
- Reserve product inventory.
- Be represented as a paid or protected Takeer order.
- Trigger seller payout or delivery release logic.

### 4.3 Order boundary

The order is created only after:

1. The buyer is phone-verified and owns the request.
2. The seller has claimed the request.
3. The selected merchant profile can sell products.
4. The seller has created or matched a valid physical product.
5. The seller has confirmed a current offer.
6. The buyer accepts the offer, confirms checkout terms, and supplies final delivery details.

The resulting order uses the existing quoted inquiry, PSP payment, delivery, Safe-Chat, dispute, refund, and settlement state machine.

### 4.4 Payment wording

Takeer must continue to follow [ADR-001: Marketplace payment boundary](adr/ADR-001-marketplace-payment-boundary.md) and [ADR-006: Refunds, disputes, and release rules](adr/ADR-006-refunds-disputes-and-release-rules.md).

Approved product meaning:

> The buyer pays through Takeer's approved PSP checkout. The PSP confirms collection. Takeer coordinates order fulfillment and buyer-protection rules. Seller payout is requested through the PSP after the applicable receipt, dispute, and release conditions are satisfied.

The UI, SMS, marketing, support scripts, and merchant onboarding must not claim that Takeer itself holds funds in a wallet or legal escrow unless counsel and the licensed PSP approve that exact structure and terminology.

## 5. Current Takeer capabilities to reuse

The implementation must extend the current architecture instead of introducing a parallel commerce stack.

| Existing capability | Reuse in this feature | Required change |
| --- | --- | --- |
| `LinkPreviewService` | URL normalization, SSRF protection, metadata preview, cached preview record | Add social-platform adapters, stricter supported-path validation, provenance, failure reasons, and controlled media retention |
| `MetaSocialConnectorService` | Merchant Meta OAuth, connected Instagram professional account lookup, recent media | Add provider capability lookup and post-to-merchant/product mapping; never assume arbitrary external account access |
| `SocialDmAutomationService` | Signed Meta webhook patterns, idempotent events, tracked links | Reuse patterns only where Meta permits the messaging context; remove hard-coded API version in future work |
| Merchant phone OTP and profile setup | New seller registration and existing buyer-to-merchant upgrade | Preserve the claim return path through authentication and onboarding |
| Merchant KYC gate | Prevent unverified sellers from publishing and transacting | Show request-specific onboarding progress and resume destination |
| Product manual draft/publish | Create the seller-authoritative physical product | Add a focused request-to-product wizard using the same validation/services |
| Physical inquiry checkout | Create delivery-aware inquiry orders | Extract reusable order creation into a service and support creation from an accepted social offer |
| Merchant availability/quote | Seller confirmation and agreement snapshot | Reuse validation concepts; avoid asking the seller to confirm the same offer twice |
| `payInquiry` | PSP payment after quote and inventory recheck | Reuse unchanged after social offer conversion creates a quoted inquiry order |
| Safe-Chat | Order-bound buyer/seller communication and evidence | Start only after an order exists; request messages remain structured request events before conversion |
| SMS and notification logs | Seller invitation, reminders, buyer offer-ready message | Add queued, deduplicated social-commerce templates and opt-out handling |
| Tracked links and marketing events | Invitation and checkout attribution | Add request-specific events and preserve the request foreign key through order completion |
| Marketplace settlement service | Payment confirmation, release, refund, PSP payout | No social-specific settlement implementation |

### 5.1 Required refactoring

The social-commerce controller must not call `CheckoutController` or `MerchantOrderController` methods directly. Extract the reusable physical inquiry creation logic into a dedicated service, tentatively:

```text
App\Services\PhysicalInquiryOrderService
```

The service should accept a validated immutable input object or normalized array and return the created order. Existing checkout and the new social-offer conversion must both use it. It owns creation of the order aggregate: order, delivery, agreement snapshot, and initial order chat. The calling use case owns the outer transaction so social conversion can lock the request, offer, product, and inventory in the same transaction; normal checkout must also invoke it inside an explicit transaction.

## 6. Supported source strategy

### 6.1 Initial supported URLs

Instagram:

- `instagram.com/p/{shortcode}`
- `instagram.com/reel/{shortcode}`

Facebook Marketplace:

- `facebook.com/marketplace/item/{item_id}`
- Equivalent mobile and locale-prefixed Marketplace item URLs after safe normalization.

The implementation must normalize known hosts and paths, remove fragments and nonessential tracking parameters, resolve approved redirects, compute a SHA-256 URL hash, and reject unsupported protocols or destinations.

### 6.2 Capability-based provider design

Create a provider contract rather than embedding platform checks throughout controllers:

```text
App\Contracts\SocialCommerceProvider

supports(url): bool
normalize(url): NormalizedSocialLink
preview(link, context): SocialCommercePreviewResult
matchConnectedMerchant(link, context): ?MerchantMatch
sellerContactOptions(link, context): ContactCapabilityResult
```

Implement:

- `InstagramSocialCommerceProvider`
- `FacebookMarketplaceSocialCommerceProvider`
- A generic metadata fallback inside the preview service, not as a promise of full platform support.

Each result must declare its provenance:

- `official_api_connected_account`
- `public_metadata`
- `buyer_supplied`
- `seller_confirmed`
- `unavailable`

The frontend must display provenance through plain-language labels rather than silently merging values.

### 6.3 Meta integration policy

Official Meta APIs should be used when Takeer has the required app approval, account authorization, permissions, and conversation context. They are an enhancement to the durable request workflow.

The implementation must not depend on being able to:

- Resolve every arbitrary Instagram user or post from a public URL.
- Read consumer/private account data.
- Read arbitrary Marketplace listing data.
- Initiate a DM to an unknown seller solely from a pasted link.

When official access is unavailable, the feature remains fully usable through best-effort public preview, buyer-supplied details or screenshot, buyer-mediated sharing, and confirmed SMS where permitted.

## 7. End-to-end user flows

### 7.1 Buyer submits a request for an unknown seller

1. Buyer opens **Buy safely from social media**.
2. Buyer chooses Instagram or Facebook Marketplace, or lets Takeer detect the platform.
3. Buyer pastes a supported product URL and taps **Continue**.
4. Takeer normalizes and validates the URL, starts preview retrieval, and displays a loading state.
5. If preview succeeds, Takeer displays image, title/caption, seller handle/name, source, and observed price when available.
6. If preview is incomplete or unavailable, the buyer can continue by uploading a screenshot and entering the missing product description and seller handle.
7. The buyer confirms:
   - Desired quantity.
   - Variant, size, color, or condition notes.
   - Observed price, if any, marked as unconfirmed.
   - Destination city/region and preferred delivery method.
   - Optional seller business phone or contact note.
8. The buyer signs in or completes phone OTP before submitting or contacting a seller.
9. Takeer creates the request with status `awaiting_seller` and displays a tracking page.
10. The buyer chooses a contact method:
    - Share invitation through Instagram or Messenger.
    - Copy invitation text and link.
    - Send SMS after confirming the seller business number and the contact attestation.
11. Takeer tracks invitation creation, send attempt, click, and claim.
12. The buyer sees status changes and receives a notification when the seller claims, declines, or sends an offer.

### 7.2 Existing Takeer seller claims the request

1. Seller opens the one-time invitation link.
2. Claim landing page shows the external listing, buyer's requested product/quantity, destination summary, request expiry, and Takeer's transaction explanation.
3. Seller logs in.
4. Seller chooses an active merchant profile they own.
5. Takeer verifies the profile is not suspended and checks whether it can sell products.
6. If the seller is fully eligible, the request transitions to `product_setup`.
7. If KYC or PSP seller onboarding is incomplete, the request transitions to `onboarding`, and the seller receives a request-specific checklist.
8. After onboarding completion, the seller returns automatically to the same request.

### 7.3 New seller claims and onboards

1. Seller opens the invitation and taps **Accept customer request**.
2. Seller verifies their phone and registers or upgrades an existing buyer account to merchant.
3. Takeer creates or selects the correct personal/business merchant profile.
4. Seller completes required KYC/KYB, business profile, location, shipping, return policy, and PSP beneficiary onboarding.
5. The claim context survives every redirect and resumes after each required step.
6. The seller cannot publish the product, issue an offer, or receive payment until `canSellProducts()` and all required PSP gates pass.

### 7.4 Seller creates the product and offer

1. Seller opens the claimed request.
2. Seller chooses **Create new product** or **Match existing product**.
3. For a new product, Takeer pre-fills only safe descriptive hints from the request. All fields remain editable and visibly unconfirmed until the seller saves them.
4. Seller supplies or authorizes final product media. Buyer screenshot and external preview media are not automatically published.
5. Seller confirms:
   - Product title, description, category, and condition.
   - Price and currency.
   - Available quantity and inventory location.
   - Variant corresponding to the request.
   - Delivery method, shipping charge or quote, and delivery estimate.
   - Return policy.
   - Offer expiry.
6. Existing product publishing and KYC rules validate the product.
7. Takeer stores an immutable seller offer snapshot on the request and transitions it to `offer_ready`.
8. Seller clicks **Confirm and send checkout link**.
9. A queued notification sends the original buyer a Takeer-generated, tracked offer link.

### 7.5 Buyer accepts and pays

1. Buyer opens the offer link and authenticates as the request owner.
2. Takeer displays the seller-confirmed product, seller identity, quantity/variant, price, shipping, returns, offer expiry, and the original external source reference.
3. Buyer confirms final delivery address, phone, location, and checkout terms.
4. If the buyer changes a commercial field such as quantity or variant, the offer returns to the seller for reconfirmation. Address fields may change if shipping price and eligibility remain valid; otherwise seller reconfirmation is required.
5. In one locked transaction, Takeer revalidates the request, seller, product, stock, shipping, and offer expiry and creates a quoted physical inquiry order.
6. The order records `is_inquiry = true`, `inquiry_status = quoted`, and `merchant_confirmed_at`, plus the normal agreement, price, delivery, and attribution snapshots.
7. Takeer links the order to the social-commerce request and initializes Safe-Chat.
8. Buyer continues through the existing inquiry payment action.
9. Existing PSP callback, fulfillment, PIN/receipt, dispute, refund, release, and seller payout workflows proceed without a social-specific branch.

### 7.6 Existing connected merchant fast path

If the pasted social post has already been mapped to a Takeer merchant and product:

1. Takeer identifies the mapping through a connected merchant social account and verified post link.
2. Buyer sees **This seller is already on Takeer**.
3. Takeer routes the buyer directly to the normal Takeer product/inquiry experience with social attribution.
4. A lightweight request/event may still be recorded for analytics, but no seller claim flow is required.

This fast path is a later optimization. It must not delay the core unknown-seller request workflow.

### 7.7 Decline, expiry, cancellation, and abuse

- Seller may decline with a structured reason such as unavailable, wrong seller, prohibited item, price changed, or cannot deliver.
- Buyer may cancel before conversion to an order.
- An unclaimed request and its claim invitations expire after 72 hours by default.
- A successful claim extends the request into a seven-day onboarding/product-setup grace period by default, so KYC does not invalidate genuine demand immediately.
- A seller-confirmed offer expires after 48 hours by default. Seller may issue a new offer with a new expiry; the buyer must explicitly accept the current revision.
- No payment is taken when a request expires or is declined.
- A blocked request preserves an audit trail but cannot be claimed, offered, or converted.
- After order creation, cancellation and disputes follow the existing order policies rather than request rules.

## 8. Request state model

### 8.1 Canonical statuses

| Status | Meaning | Allowed next statuses |
| --- | --- | --- |
| `awaiting_seller` | Buyer submitted; seller has not claimed | `claimed`, `declined`, `expired`, `cancelled`, `blocked` |
| `claimed` | Merchant profile atomically claimed the request | `onboarding`, `product_setup`, `declined`, `blocked` |
| `onboarding` | Seller must complete merchant/KYC/PSP requirements | `product_setup`, `declined`, `expired`, `blocked` |
| `product_setup` | Seller is creating/matching product and offer | `offer_ready`, `declined`, `expired`, `blocked` |
| `offer_ready` | Seller-confirmed offer is available to buyer | `product_setup`, `converted`, `declined`, `expired`, `cancelled`, `blocked` |
| `converted` | Buyer accepted and a linked Takeer order exists | Terminal at request layer; order state is authoritative |
| `declined` | Seller declined | Terminal unless buyer creates a new request |
| `expired` | Claim or offer expired | Terminal unless explicitly reopened by policy |
| `cancelled` | Buyer cancelled before order conversion | Terminal |
| `blocked` | Trust/safety or policy block | Terminal; admin review only |

Use model constants and PostgreSQL/MySQL-compatible check constraints following current repository patterns. Every transition must be performed by a domain service under a row lock and must create an append-only event.

### 8.2 Invitation statuses

`created`, `queued`, `sent`, `failed`, `clicked`, `claimed`, `expired`, `revoked`, and `opted_out`.

Invitation status is separate from request status because a request can have more than one contact attempt or channel.

## 9. Data model

### 9.1 `social_commerce_requests`

```text
id
public_id unique
buyer_id foreign key users
platform                         instagram|facebook_marketplace
original_url
normalized_url
url_hash char(64)
external_post_id nullable
external_seller_handle nullable
external_seller_name nullable
external_seller_profile_url nullable
link_preview_id nullable foreign key link_previews
preview_status                   pending|success|partial|unavailable|failed
preview_provenance nullable
preview_snapshot json nullable
buyer_screenshot_path nullable
buyer_product_note nullable
buyer_variant_note nullable
requested_quantity decimal
observed_unit_price nullable
observed_currency_code nullable
destination_country_id nullable
destination_state_id nullable
destination_city_id nullable
destination_summary nullable
delivery_context_encrypted text nullable
preferred_delivery_type nullable
seller_phone_encrypted nullable
seller_phone_hash nullable
seller_phone_source nullable
seller_contact_attested_at nullable
status
claimed_merchant_id nullable foreign key merchants
product_id nullable foreign key products
offer_snapshot json nullable
offer_expires_at nullable
order_id nullable unique foreign key orders
idempotency_key unique
claim_started_at nullable
claimed_at nullable
offer_ready_at nullable
converted_at nullable
declined_at nullable
expires_at
closed_reason nullable
lock_version unsigned integer default 0
timestamps
```

Rules:

- `buyer_id` is required. Preview may be public, but request submission requires a verified buyer identity.
- Exact delivery/contact context is encrypted at rest; seller-facing APIs expose only the minimum location needed to quote before payment.
- `preview_snapshot` is immutable evidence of what Takeer observed at request time.
- `offer_snapshot` is replaced only through an explicit seller revision event and becomes immutable once accepted.
- `order_id` is unique so one request cannot create multiple payable orders.
- Active duplicates from the same buyer and normalized URL should return the existing request unless the buyer explicitly requests a new quantity/variant after the prior request closes.

### 9.2 `social_commerce_request_invitations`

```text
id
public_id unique
social_commerce_request_id foreign key
channel                           share_link|sms|whatsapp|instagram_dm|facebook_messenger|internal
recipient_encrypted nullable
recipient_hash nullable
token_hash char(64) unique
status
provider_reference nullable
attempt_count default 0
dedupe_key unique
message_snapshot json
metadata json nullable
queued_at nullable
sent_at nullable
failed_at nullable
clicked_at nullable
claimed_at nullable
expires_at
revoked_at nullable
timestamps
```

Rules:

- Store only a SHA-256 hash of the random claim token.
- Generate at least 32 random bytes for the plain token.
- Never log the plain token or include it in analytics payloads.
- Use a split invitation URL such as `/social-buy/claim/{invitation_public_id}#token={plain_secret}`. The browser fragment is not sent in the GET request; the claim page reads it client-side and submits the secret only in the authenticated POST body.
- Suppress the fragment from frontend analytics, error reporting, referrer propagation, screenshots, and copied diagnostic context.
- Claim is a POST action after authentication; opening the GET link must not claim or mutate the request.
- Revoke other active invitations after a successful claim.

### 9.3 `social_commerce_request_events`

Append-only audit table:

```text
id
social_commerce_request_id foreign key
actor_type nullable
actor_id nullable
event_type
from_status nullable
to_status nullable
channel nullable
ip_hash nullable
user_agent_summary nullable
metadata json nullable
occurred_at
created_at
```

Important events include request submission, preview outcome, invitation creation/send/click/failure, claim, onboarding progress, product match/create, offer revision, offer send/view, buyer acceptance, order conversion, decline, expiry, cancellation, block, and support action.

### 9.4 `social_product_links`

Add in the connected-merchant fast-path phase:

```text
id
merchant_id foreign key
merchant_social_account_id foreign key
product_id foreign key
platform
provider_post_id
normalized_url
url_hash char(64)
status                            active|paused|removed
verified_at
last_synced_at nullable
metadata json nullable
timestamps
```

Use a unique constraint on platform/account/provider post and on active URL hash as appropriate.

### 9.5 Order linkage

Add a nullable unique `social_commerce_request_id` foreign key to `orders`, or rely on the request's unique `order_id` plus a formal inverse relationship. The preferred implementation stores the foreign key on `orders` because order reporting and authorization frequently begin from the order.

Keep `orders.source = online` unless the existing source constraint is deliberately expanded. The dedicated foreign key and marketing attribution provide clearer semantics than overloading `orders.source`.

Do not reuse `products.source_details`; it describes fulfillment/supply sourcing and is not an acquisition-workflow reference.

## 10. Backend architecture

### 10.1 Models and policies

Add:

- `SocialCommerceRequest`
- `SocialCommerceRequestInvitation`
- `SocialCommerceRequestEvent`
- `SocialProductLink` in the fast-path phase
- `SocialCommerceRequestPolicy`

Relationships:

- User has many requests as buyer.
- Merchant has many claimed requests.
- Request belongs to buyer, claimed merchant, product, order, and link preview.
- Request has many invitations and events.
- Order belongs to one optional social-commerce request.

Authorization rules:

- Buyer can view/cancel only their own request.
- Seller can view after successful claim using a merchant profile owned by the authenticated user.
- Merchant team access requires explicit request/order permissions; ownership alone must not bypass current merchant permission middleware.
- Admin/support access must be role-based and audited.
- External seller sees destination summary before order, not the buyer's full private address.

### 10.2 Services

Add:

- `SocialCommerceProviderRegistry`
- `SocialCommercePreviewService`
- `SocialCommerceRequestService`
- `SocialCommerceInvitationService`
- `SocialCommerceClaimService`
- `SocialCommerceOfferService`
- `SocialCommerceOrderConversionService`
- `PhysicalInquiryOrderService` extracted from checkout
- `SocialCommerceNotificationService`
- `SocialCommerceAuditService`

Service responsibilities must be explicit:

- Controllers validate input and authorize.
- Services own transactions, transitions, idempotency, and event creation.
- Jobs perform network calls and notifications.
- Provider adapters isolate Meta/public-metadata behavior.
- Order conversion is the only service allowed to link a request to a new order.

### 10.3 Events, listeners, and queued jobs

Project automation must use Laravel Events, Listeners, Queues, and the scheduler.

Suggested events:

- `SocialCommerceRequestSubmitted`
- `SocialCommerceSellerClaimed`
- `SocialCommerceOnboardingCompleted`
- `SocialCommerceOfferReady`
- `SocialCommerceOfferAccepted`
- `SocialCommerceRequestConverted`
- `SocialCommerceRequestClosed`

Suggested queued jobs/listeners:

- `FetchSocialCommercePreview`
- `SendSocialCommerceSellerInvitation`
- `SendSocialCommerceInviteReminder`
- `SendSocialCommerceOfferToBuyer`
- `NotifyBuyerOfSocialCommerceStatus`
- `ExpireSocialCommerceRequests`
- `PruneSocialCommercePreviewMedia`
- `SyncConnectedSocialProductLink`

All jobs must use deterministic dedupe/idempotency keys, bounded retries, exponential backoff, timeouts, and safe failure states. Network failure must never create an order or mark an invitation as sent.

### 10.4 Scheduled commands

Add scheduler entries with `withoutOverlapping()`:

```text
social-commerce:send-reminders       every fifteen minutes
social-commerce:expire-requests      every fifteen minutes
social-commerce:prune-preview-media  daily
```

For multi-instance production, use `onOneServer()` where the configured cache/lock backend supports it.

## 11. API and web route plan

Exact route names may be adjusted to current conventions, but the responsibility split must remain.

### 11.1 Public/guest preview

```text
POST /api/social-commerce/previews
GET  /api/social-commerce/previews/{preview:public_id}
```

`POST` validates platform/path and creates or returns an idempotent preview session. It may return `202` while a queued provider fetch runs. The UI polls or listens for the result. Rate-limit by IP and device fingerprint; require a challenge after an abuse threshold.

### 11.2 Authenticated buyer routes

```text
POST /api/social-commerce/requests
GET  /api/social-commerce/requests
GET  /api/social-commerce/requests/{request:public_id}
POST /api/social-commerce/requests/{request:public_id}/invitations
POST /api/social-commerce/requests/{request:public_id}/cancel
POST /api/social-commerce/requests/{request:public_id}/offers/accept
POST /api/social-commerce/requests/{request:public_id}/offers/request-change
```

Request creation accepts a client idempotency key. Invitation creation requires an explicit channel and, for backend SMS, a seller-contact attestation.

### 11.3 Claim routes

```text
GET  /social-buy/claim/{invitation:public_id}
POST /api/social-commerce/claims/{invitation:public_id}/accept
```

The GET route renders a non-mutating landing page without receiving the secret fragment. Authentication and merchant registration preserve a safe internal return target. If authentication redirects are required, keep the secret only in same-tab `sessionStorage` under the invitation public ID; never place it in a cookie, local storage, server session, analytics event, or return URL. The client submits `claim_token` in the POST body; the backend hashes it, locks request and invitation rows, validates expiry, verifies merchant ownership, and performs the claim once. Clear the token from session storage, client memory, and browser history after successful claim.

### 11.4 Merchant routes

```text
GET  /api/merchant/social-commerce/requests
GET  /api/merchant/social-commerce/requests/{request:public_id}
POST /api/merchant/social-commerce/requests/{request:public_id}/match-product
POST /api/merchant/social-commerce/requests/{request:public_id}/create-product
POST /api/merchant/social-commerce/requests/{request:public_id}/offer
POST /api/merchant/social-commerce/requests/{request:public_id}/send-offer
POST /api/merchant/social-commerce/requests/{request:public_id}/decline
```

Use `merchant_status` and existing granular permissions such as product create/publish and order update. Add a dedicated permission only if current permission combinations cannot express the required access safely.

### 11.5 Admin routes

```text
GET  /api/admin/social-commerce/requests
GET  /api/admin/social-commerce/requests/{request:public_id}
POST /api/admin/social-commerce/requests/{request:public_id}/block
POST /api/admin/social-commerce/requests/{request:public_id}/resend
POST /api/admin/social-commerce/requests/{request:public_id}/revoke-claim
```

Admin actions require reason codes and append-only audit events. Revoking a claim is allowed only before order conversion and must not silently reassign a request.

### 11.6 Web/Inertia routes

```text
/buy-from-social-media
/social-commerce/requests/{request:public_id}
/social-buy/claim/{invitation:public_id}
/merchant/social-commerce/requests
/merchant/social-commerce/requests/{request:public_id}
/admin/social-commerce/requests
```

## 12. Frontend and UX specification

### 12.1 Entry points

Add a visible **Buy from social media** entry in:

- Main discovery/feed surface.
- Buyer navigation or quick actions.
- Empty-state/search surfaces where relevant.
- Shareable public landing page for marketing campaigns.

Do not overcrowd global navigation. Mobile users should reach the paste field in one tap from the primary entry point.

### 12.2 Buyer paste modal/page

Use a mobile-first bottom sheet or modal with these steps:

1. **Paste link** — platform auto-detection and supported examples.
2. **Confirm product** — preview card, unverified label, editable buyer details, screenshot fallback.
3. **Delivery area** — city/region, delivery preference, phone verification.
4. **Invite seller** — share buttons, copy text, optional confirmed SMS.
5. **Track request** — timeline and next action.

Preview states:

- Loading.
- Complete preview.
- Partial preview.
- Unsupported/private link.
- Temporarily unavailable.
- Suspicious or blocked link.

Preview failure must not be a dead end for a valid supported URL. Ask for screenshot, title/description, seller handle, and observed price, while keeping all buyer-entered values marked unverified.

### 12.3 Buyer request tracking page

Display:

- Source preview and original platform link.
- Request number.
- Status timeline.
- Seller invitation status without exposing provider internals.
- Expiry countdown.
- Resend/share action subject to limits.
- Cancel action before conversion.
- Seller-confirmed offer when ready.
- Clear warning not to pay through a social DM or an unrelated link.
- Link to the resulting order after conversion.

### 12.4 Seller claim landing page

Before authentication, display only:

- Takeer trust explanation.
- External listing preview.
- Requested quantity/variant notes.
- Destination city/region summary.
- Request expiry.
- **Accept customer request** and **This is not my listing** actions.

Do not expose the buyer's full name, phone, or exact address before an authenticated and authorized claim.

### 12.5 Seller request wizard

The request-specific wizard should reduce onboarding friction while reusing current product validation:

1. Merchant profile and eligibility.
2. Identity/KYC/PSP checklist if incomplete.
3. Create or match product.
4. Product details and authorized media.
5. Inventory location, quantity, and variant.
6. Shipping/delivery and returns.
7. Offer review and expiry.
8. **Confirm and send checkout link**.

Provide autosave and resume. Never bypass KYC, stock, shipping profile, merchant location, or publishing rules to make the wizard appear shorter.

### 12.6 Offer acceptance page

Display a single authoritative comparison:

| Buyer originally requested | Seller confirmed |
| --- | --- |
| Observed title/description | Final Takeer product title/description |
| Observed price | Final price and currency |
| Requested quantity/variant | Confirmed quantity/variant |
| Desired destination | Confirmed delivery method/charge |
| External seller handle | Claimed Takeer merchant identity |

Require explicit acceptance of the final offer and checkout terms. Changes affecting price, stock, or shipping return to the seller for a revised offer.

### 12.7 Localization and accessibility

- Provide English and Swahili copy for all buyer/seller status and notification templates.
- Use plain terms such as `Muuzaji bado hajathibitisha`, `Offer imethibitishwa`, and `Lipa kupitia Takeer pekee`.
- Meet keyboard, focus, color contrast, screen-reader, error association, and reduced-motion requirements.
- Optimize for low-bandwidth mobile connections; preview image failure must not prevent text completion.

## 13. Seller contact and notification plan

### 13.1 Contact priority

1. **Known existing Takeer merchant:** internal notification plus verified account channels.
2. **Buyer-mediated social share:** buyer sends the one-time invitation through Instagram or Messenger.
3. **Copy invitation:** Takeer supplies a localized message and tracked claim link.
4. **Backend SMS:** only after buyer confirmation of a business contact and attestation.
5. **Official Meta messaging:** only when a supported connected-account or conversation context authorizes it.

The MVP must remain complete with options 1-4. Arbitrary outbound Meta DM is not a hard dependency.

If an authorized provider or public business-contact field suggests a phone number, Takeer may pre-fill it as an unverified suggestion. The buyer must confirm it before sending. Do not scrape arbitrary bio text and automatically send an SMS.

### 13.2 Suggested invitation copy

English:

> A customer wants to buy your product through Takeer. Confirm the product, price, stock, and delivery, then send the customer a protected Takeer checkout link: {claim_url}. Do not request payment outside Takeer. Expires {expiry}.

Swahili:

> Mteja anataka kununua bidhaa yako kupitia Takeer. Thibitisha bidhaa, bei, stock na usafirishaji, kisha mtumie mteja link rasmi ya malipo ya Takeer: {claim_url}. Usiombe malipo nje ya Takeer. Link inaisha {expiry}.

Do not include the buyer's exact address or unnecessary personal data.

### 13.3 Buyer offer-ready copy

> Takeer: {seller_name} has confirmed {product_title} for {amount}. Review delivery and terms, then pay only through this Takeer link: {offer_url}. Expires {expiry}.

### 13.4 Delivery controls

- Queue all sends.
- Use deterministic dedupe keys per request, channel, template, and reminder window.
- Default to one initial seller invitation and reminders at 24 and 48 hours, with expiry at 72 hours.
- Rate-limit per buyer, seller-contact hash, IP, device, and URL hash.
- Store provider status and error without exposing credentials or full tokens.
- Support seller opt-out and suppression by contact hash.
- Do not claim delivery when the provider returned an unknown or failed status.

## 14. Product and order conversion rules

### 14.1 Product creation

The final product must be owned by the claimed merchant and pass the existing physical product publishing rules. External preview values can pre-fill the form but cannot bypass validation.

The seller must upload or authorize final media. If the seller chooses to use an external image they own, record that attestation and ingest it through the normal media service. Buyer screenshots remain private request evidence and are removed under the retention policy.

### 14.2 Offer snapshot

At seller confirmation, persist:

- Request and seller identifiers.
- Product and variant identifiers.
- Product title and SKU snapshot.
- Quantity and unit type.
- Unit price, shipping fee, discount, total, and currency.
- Stock/location confirmation.
- Delivery mode and destination summary.
- Return policy/version.
- Seller confirmation timestamp.
- Offer expiry.
- Source URL hash and external platform.
- Terms/legal document versions relevant to the seller action.

### 14.3 Atomic buyer acceptance

`SocialCommerceOrderConversionService` must:

1. Begin a database transaction.
2. Lock the request and relevant inventory rows.
3. Confirm request status is `offer_ready` and `order_id` is null.
4. Confirm authenticated buyer owns the request.
5. Confirm offer has not expired.
6. Confirm merchant still owns the product and remains eligible.
7. Confirm product/variant remains valid and stock can satisfy the offer.
8. Recalculate shipping eligibility and reject any material mismatch.
9. Record buyer legal acceptance.
10. Create the quoted physical inquiry order and delivery through `PhysicalInquiryOrderService`.
11. Link request and order in both directions.
12. Append conversion event and mark request `converted`.
13. Commit.
14. Broadcast status and redirect buyer to the normal inquiry payment screen.

Repeated acceptance with the same idempotency key must return the existing order. Concurrent attempts must create at most one order.

### 14.4 After conversion

The request becomes read-only except for administrative notes and retention actions. The order is authoritative for:

- Payment.
- Inventory reservation.
- Chat.
- Dispatch.
- Delivery/PIN/receipt.
- Return and dispute.
- Refund.
- Release and PSP payout.

No social-commerce code should implement alternative payment or release states.

## 15. Security, privacy, trust, and abuse controls

### 15.1 URL and preview security

- Permit only HTTP/HTTPS.
- Allowlist exact supported hosts and URL path shapes.
- Resolve DNS and reject loopback, link-local, private, multicast, metadata-service, and reserved addresses before every request and redirect.
- Limit redirects, response size, image size, MIME type, and timeout.
- Protect against DNS rebinding by validating the resolved destination used for the connection.
- Do not execute external JavaScript or use a logged-in Takeer browser session to bypass social privacy controls.
- Sanitize all metadata and never render remote HTML.
- Record preview failure categories without storing sensitive response bodies.

### 15.2 Claim security

- Use high-entropy random one-time tokens stored only as hashes.
- Default token expiry: 72 hours.
- Keep the secret in the browser URL fragment and submit it only in the authenticated claim POST body so access logs and link-preview bots do not receive it.
- Rate-limit token lookups and authentication attempts.
- Do not mutate state on link preview, email scanner, or GET request.
- Lock request and invitation rows during claim.
- Revoke sibling invitations after successful claim.
- Bind the claim to an authenticated merchant profile owned by the current user.
- Audit claim IP hash, user agent summary, merchant, and invitation channel.

Possession of an invitation proves access to the invitation, not ownership of the social account. Seller trust labels must distinguish:

- Phone verified.
- Takeer merchant KYC verified.
- PSP payout profile verified.
- Social account connected and matched.
- Social listing ownership manually reviewed.

### 15.3 Seller impersonation controls

- Prefer connected Meta account matching where available.
- Compare claimed seller handle/profile with connected account data.
- Flag mismatches for review rather than automatically rejecting legitimate business representatives.
- Allow the buyer to report **Wrong seller claimed this request** before payment.
- Require stronger review for high-risk categories, high values, repeated claims, or conflicting seller claims.
- Never display `Instagram verified by Takeer` or equivalent unless the account match was actually completed.

### 15.4 Buyer and outreach abuse

- Require verified phone before request submission or seller contact.
- Add per-user/IP/device/contact/URL daily limits.
- Detect repeated fake requests, harassment, prohibited items, and mass contact attempts.
- Use CAPTCHA or additional step-up after risk thresholds.
- Keep a seller-contact suppression list and opt-out mechanism.
- Prevent buyers from editing the original URL after submission; changes create a new request.
- Scan uploaded screenshots using existing content policies and safe file validation.

### 15.5 Data minimization and retention

- Do not reveal buyer phone or exact address before justified seller/order access.
- Encrypt seller contact and delivery context at rest; store hashes for dedupe and suppression.
- Keep claim tokens out of logs, analytics, and error reports.
- Treat buyer screenshot and cached external images as private temporary evidence.
- Define configurable retention for unconverted request media, recommended 30 days after closure unless a complaint requires preservation.
- Preserve minimal audit data for the legal/support retention period.
- If a request converts to an order or dispute, retain required evidence according to order and dispute policy.
- Update privacy notices and merchant/buyer terms before launch.

### 15.6 Restricted products

Run request description, preview metadata, screenshot, seller product, and category through the existing restricted-products policy. Block prohibited items before invitation where confidently detected and always before offer/order conversion.

## 16. Admin and support operations

Create a social-commerce request console with:

- Funnel/status filters.
- Platform, region, category, seller, buyer, and age filters.
- Preview and original URL inspection through safe outbound controls.
- Invitation history and provider outcomes.
- Claim identity and social-account match status.
- KYC/product/offer/order links.
- Request event timeline.
- Duplicate and risk signals.
- Block, resend, revoke pre-order claim, and close actions with mandatory reasons.
- Buyer/seller reports and opt-outs.

Admin users must not be able to create a paid order, mark payment confirmed, release funds, or complete payout from the request console. Those actions remain inside the authenticated PSP/order workflows.

Operational alerts should cover:

- Preview provider failure spikes.
- Invitation/SMS failure spikes.
- Claim collision or brute-force patterns.
- Offers that cannot convert because product/stock/shipping changed.
- Converted requests without a linked order, which should be structurally impossible.
- Orders with a social request where attribution/event linkage is missing.
- High dispute/refund rates by source, seller, contact channel, or category.

## 17. Analytics, growth, and profitability

### 17.1 Funnel events

Record through the existing marketing event pipeline where appropriate and retain request-domain events for audit:

```text
social_buy_entry_viewed
social_link_submitted
social_preview_succeeded
social_preview_failed
social_request_created
social_invite_created
social_invite_sent
social_invite_clicked
social_seller_claimed
social_seller_onboarding_started
social_seller_onboarding_completed
social_product_created
social_product_matched
social_offer_ready
social_offer_sent
social_offer_viewed
social_offer_accepted
social_order_created
social_payment_confirmed
social_order_delivered
social_order_disputed
social_order_refunded
social_seller_payout_confirmed
```

Important dimensions:

- Platform.
- Preview provenance and success/failure reason.
- Buyer region.
- New versus existing seller.
- Connected versus unconnected social account.
- Contact channel.
- Product category and value band.
- Time to claim, offer, payment, delivery, and payout.
- Campaign/UTM/referral source.

### 17.2 Primary metrics

- Completed GMV from social-commerce requests.
- Net platform revenue from completed social-originated orders.
- Request-to-seller-claim conversion.
- Claimed seller-to-KYC completion conversion.
- Offer-to-paid-order conversion.
- New merchant activation rate.
- Median time from request to offer and payment.
- Repeat Takeer sales from acquired sellers after the first request.
- Cost per activated seller and cost per completed order.

### 17.3 Guardrail metrics

- Invitation complaint/opt-out rate.
- Preview failure rate by platform.
- Duplicate/fake request rate.
- Claim impersonation reports.
- Dispute, return, refund, and failed-delivery rate.
- Seller no-response and request-expiry rate.
- SMS/Meta/provider cost per completed transaction.
- Support minutes and loss exposure per completed order.

### 17.4 Unit economics

Before general availability, calculate:

```text
Net contribution per converted request
= Takeer transaction revenue
- PSP/channel costs borne by Takeer
- SMS/WhatsApp/Meta messaging cost
- preview/media/network cost
- onboarding/KYC cost borne by Takeer
- expected support and dispute cost
- promotional subsidy
```

Onboarding may be free to reduce merchant friction. Any first-order discount or fee waiver must be configurable, time-limited, attributable, and evaluated against seller repeat GMV. Avoid permanently subsidizing requests that generate repeated outreach cost but do not convert.

## 18. Configuration and feature flags

Add `config/social_commerce.php` with environment-backed settings:

```text
enabled
supported_platforms
allowed_hosts
request_expiry_hours              default 72
claimed_onboarding_grace_days     default 7
offer_expiry_hours                default 48
reminder_hours                    default [24, 48]
max_requests_per_buyer_per_day
max_invites_per_request
max_invites_per_contact_per_day
preview_timeout_seconds
preview_max_html_bytes
preview_max_image_bytes
preview_media_retention_days
claim_token_bytes                  minimum 32
meta_preview_enabled
meta_messaging_enabled
seller_sms_enabled
connected_merchant_fast_path_enabled
admin_review_value_threshold
```

Required rollout flags:

- Master feature flag.
- Buyer entry-point flag.
- Seller SMS flag.
- Meta provider flag.
- Facebook Marketplace flag.
- Connected-merchant fast-path flag.

The feature must fail closed for seller contact and order conversion while still allowing authorized staff to inspect existing records.

## 19. Implementation phases

### Phase 0 — Decision, provider, legal, and operations readiness

Deliverables:

- Approve this implementation plan.
- Add an ADR recording the request-before-order boundary, provider-adapter strategy, and buyer-acceptance conversion decision.
- Confirm supported Meta capabilities, app review requirements, messaging windows, and Marketplace limitations directly with Meta/current documentation.
- Review seller outreach/SMS consent, opt-out, privacy, copyright, consumer-protection, and electronic-transactions requirements with Tanzanian counsel.
- Approve English/Swahili trust language and support escalation procedure.
- Confirm PSP seller-onboarding and conditional-settlement production readiness.

Exit criteria:

- Engineering has written provider capability assumptions.
- Legal/product language does not describe Takeer as a wallet or unlicensed escrow holder.
- Support owns request and impersonation escalation procedures.

### Phase 1 — Domain foundation and persistence

Deliverables:

- New migrations, models, relationships, status constants, constraints, factories, policies, and resources.
- Request transition/audit service.
- Invitation token generation/hash/expiry service.
- Order relationship migration.
- Configuration and master feature flag.
- Feature tests for transition, authorization, token, duplicate, and concurrency rules.

Exit criteria:

- Invalid state transitions fail atomically.
- A request can link to at most one order.
- Plain claim tokens never persist.
- Buyer, merchant, and admin access boundaries pass tests.

### Phase 2 — URL parsing and preview

Deliverables:

- Provider registry and Instagram/Facebook Marketplace URL normalizers.
- Refactored `LinkPreviewService` integration with provenance and safe failure reasons.
- Queued preview job, polling endpoint, and cache behavior.
- Screenshot fallback and private media handling.
- SSRF, redirect, MIME, size, and timeout hardening tests.

Exit criteria:

- Supported URLs normalize deterministically.
- Unsupported/private links fail safely.
- A preview failure still allows an authenticated buyer to complete a request with supplied evidence.

### Phase 3 — Buyer request experience

Deliverables:

- Buyer landing page/modal and platform selection.
- Preview/confirm/destination/OTP flow.
- Request creation and idempotency.
- Request tracking page and real-time/polling status updates.
- Buyer cancellation and expiry presentation.
- Marketing events and attribution capture.

Exit criteria:

- Mobile buyer can create and track a request from either supported source.
- No order or payment attempt exists after request creation.
- Exact private buyer data is not exposed through public or claim resources.

### Phase 4 — Seller invitation, claim, and onboarding resume

Deliverables:

- Buyer-mediated share/copy actions.
- Queued SMS invitation with attestation, limits, dedupe, provider logging, and opt-out.
- Non-mutating claim landing page and atomic authenticated claim action.
- Existing merchant selection.
- New merchant registration/upgrade and KYC/PSP resume context.
- Invitation reminders, expiry command, and request status notifications.

Exit criteria:

- Existing and new sellers can claim exactly once.
- Claim survives login/onboarding redirects.
- Ineligible seller cannot create an offer.
- Scanner/GET requests cannot claim.
- Duplicate sends and claim races pass tests.

### Phase 5 — Seller product and offer workflow

Deliverables:

- Merchant request inbox/detail pages.
- Create/match product flow using existing product services and validation.
- Media ownership/authorization acknowledgement.
- Inventory, variant, location, shipping, returns, and offer-expiry steps.
- Immutable offer snapshot and revision events.
- **Confirm and send checkout link** action.
- Buyer offer-ready notification and tracked link.

Exit criteria:

- Seller cannot offer an unpublished/invalid or foreign-owned product.
- Product and offer values are seller-confirmed.
- Buyer receives one valid tracked offer link per offer revision.

### Phase 6 — Order conversion and existing fulfillment reuse

Deliverables:

- Extract `PhysicalInquiryOrderService` from `CheckoutController` without changing existing behavior.
- Build atomic `SocialCommerceOrderConversionService`.
- Create quoted inquiry order on buyer offer acceptance.
- Preserve legal, offer, delivery, attribution, request, and social-source snapshots.
- Initialize Safe-Chat and redirect to existing `payInquiry` UI.
- Confirm all existing payment, dispatch, delivery, dispute, refund, release, and payout paths work unchanged.

Exit criteria:

- Repeated/concurrent acceptance creates one order.
- Inventory and shipping are revalidated.
- No payment can start from the request itself.
- Social-originated order passes the existing physical order lifecycle through confirmed PSP payout or valid refund/dispute outcomes.

### Phase 7 — Admin, trust, analytics, and observability

Deliverables:

- Admin request console and audited support actions.
- Risk flags, seller mismatch report, suppression, and block controls.
- Funnel dashboard and profitability report.
- Health checks, structured logs, queue metrics, provider failure alerts, and reconciliation checks.
- Data retention/pruning command.

Exit criteria:

- Support can investigate every request without database access.
- Operations can identify stuck or abusive requests.
- Growth can calculate source conversion, merchant activation, GMV, revenue, and channel cost.

### Phase 8 — Connected Meta merchant fast path

Deliverables:

- `social_product_links` model and merchant post-to-product mapping UI.
- Connected account and post ownership matching.
- Direct routing from recognized post to existing Takeer product/inquiry.
- Official messaging only for supported, authorized contexts.
- Configured Meta API version, token refresh/expiry handling, app review evidence, webhook verification, and provider monitoring.

Exit criteria:

- Recognized merchant posts bypass seller claim without weakening authorization.
- Unrecognized posts continue through the normal request flow.
- Feature remains functional when Meta integration is disabled or degraded.

### Phase 9 — Pilot and general availability

Pilot recommendation:

- Tanzania only.
- Instagram and Facebook Marketplace links.
- Selected low-to-medium-risk physical categories.
- Controlled buyer cohort and invited merchant/support team.
- Transaction value threshold requiring review above the configured amount.

Graduation criteria:

- Stable preview and notification services.
- Acceptable request-to-order conversion.
- Acceptable dispute/fraud/opt-out rates.
- Positive or intentionally bounded contribution margin.
- Support readiness and documented incident response.
- PSP, legal, privacy, and product approvals complete.

## 20. Test strategy

### 20.1 Unit tests

- Platform detection and URL normalization.
- Supported path validation.
- URL hashing and duplicate detection.
- Preview provenance mapping.
- Status transition matrix.
- Claim token generation and hash verification.
- Offer expiry and change-materiality rules.
- Invitation dedupe and reminder timing.
- Social account/product matching.
- Notification template localization.

### 20.2 Feature tests

- Authenticated buyer creates Instagram request.
- Authenticated buyer creates Facebook Marketplace request.
- Guest previews but must verify before submission.
- Preview failure accepts screenshot/manual fallback.
- Unsupported URL is rejected.
- Buyer cannot view/cancel another buyer's request.
- Seller cannot view before claim.
- Expired/revoked token cannot claim.
- GET claim page does not mutate.
- Concurrent seller claim has one winner.
- New seller resumes request after registration/KYC.
- Ineligible merchant cannot offer.
- Seller cannot attach another merchant's product.
- Offer revision invalidates the old buyer link/action.
- Concurrent buyer acceptance creates one order.
- Converted order is quoted, merchant-confirmed, linked, and chat-initialized.
- `payInquiry` still rechecks inventory and initiates normal PSP payment.
- Request cancel/decline/expiry never creates payment/order records.
- Admin actions require roles and reason codes.
- SMS dedupe, failure, retry, suppression, and opt-out.

### 20.3 Security tests

- Localhost, private IP, IPv6 private range, metadata endpoint, decimal/encoded IP, and redirect-based SSRF attempts.
- DNS rebinding defense.
- Oversized HTML/image and invalid MIME.
- Script/HTML injection in captions, names, and buyer notes.
- Open redirect through claim/login return path.
- Token enumeration and brute-force throttling.
- Plain token absence from database/logs/events.
- PII absence from public resources and analytics.
- Seller impersonation report and claim collision.
- Malicious screenshot and unsupported file upload.
- Webhook signature/idempotency for supported Meta integrations.

### 20.4 Browser/end-to-end tests

- Mobile Instagram paste to manual seller share.
- Mobile Facebook Marketplace paste with preview failure fallback.
- Seller claim, login, onboarding resume, product setup, and offer send.
- Buyer offer acceptance, exact address confirmation, payment, and order tracking.
- Swahili and English paths.
- Accessibility and keyboard flow.
- Slow/offline network recovery and resume.

### 20.5 Regression tests

- Existing product checkout and inquiry behavior is unchanged after extracting order service.
- Existing merchant quote/availability and Safe-Chat remain valid.
- Existing PSP callbacks and settlement transitions remain authoritative.
- Existing social comment DM automation still passes.
- Existing product publish, KYC, shipping zone, and inventory validation remains enforced.

### 20.6 Verification commands

At each phase run the focused PHP tests, then the complete relevant suite. Before release run at minimum:

```bash
php artisan test
npm run build
git diff --check
```

Use `Http::fake()` and provider fakes for automated tests. Production credentials and real external messages must never be required by the test suite.

## 21. Observability and failure handling

Use structured logs with `request_public_id`, provider, job, status, and safe error code. Do not log raw claim tokens, full phone numbers, full external payloads, or encrypted-field plaintext.

Track:

- Preview duration and outcome.
- Queue age/retry/failure.
- Invitation provider result.
- Claim and offer latency.
- Conversion transaction failures by validation reason.
- Request/order linkage invariants.
- External provider/API version and error category.

Failure principles:

- Preview unavailable: buyer uses manual fallback.
- Meta unavailable: use buyer share or confirmed SMS.
- SMS unavailable: preserve invite and expose copy/share.
- Seller onboarding incomplete: preserve request and resume state.
- Offer expired: no order; seller issues a new offer.
- Product/stock/shipping changed at acceptance: no order; return to seller revision.
- Database outcome unknown: retry by idempotency key and look up existing request/order before writing.
- PSP unavailable after order creation: existing order remains pending and existing payment retry rules apply.

## 22. Migration, deployment, and rollback

### 22.1 Migration

This is an additive feature with no legacy data backfill. Deploy schema and backend behind disabled flags before exposing routes or UI.

Deployment order:

1. Add schema, models, policies, services, and disabled configuration.
2. Deploy queues, scheduler commands, and admin visibility.
3. Enable preview for internal users.
4. Enable buyer requests without backend seller outreach.
5. Enable seller claim/onboarding/product/offer.
6. Enable order conversion and payment for pilot cohort.
7. Enable SMS and Meta capabilities independently after approval.
8. Expand categories, regions, and traffic based on guardrails.

### 22.2 Rollback

- Disable the master entry point and new request creation.
- Disable each outbound provider independently.
- Preserve existing requests, events, and linked orders for support/audit.
- Allow already-converted orders to complete through normal order workflows.
- Do not delete or unlink orders during rollback.
- Pending pre-order requests may be closed with a transparent notification if the feature is withdrawn.
- Drop tables only in a non-production reset or after approved retention/export; application rollback should not destroy request evidence.

## 23. Suggested file map

New backend files:

```text
app/Contracts/SocialCommerceProvider.php
app/Models/SocialCommerceRequest.php
app/Models/SocialCommerceRequestInvitation.php
app/Models/SocialCommerceRequestEvent.php
app/Models/SocialProductLink.php
app/Policies/SocialCommerceRequestPolicy.php
app/Http/Controllers/Api/SocialCommercePreviewController.php
app/Http/Controllers/Api/SocialCommerceRequestController.php
app/Http/Controllers/Api/SocialCommerceClaimController.php
app/Http/Controllers/Api/MerchantSocialCommerceRequestController.php
app/Http/Controllers/Api/AdminSocialCommerceRequestController.php
app/Http/Requests/SocialCommerce/*
app/Http/Resources/SocialCommerceRequestResource.php
app/Services/SocialCommerceProviderRegistry.php
app/Services/SocialCommercePreviewService.php
app/Services/SocialCommerceRequestService.php
app/Services/SocialCommerceInvitationService.php
app/Services/SocialCommerceClaimService.php
app/Services/SocialCommerceOfferService.php
app/Services/SocialCommerceOrderConversionService.php
app/Services/SocialCommerceNotificationService.php
app/Services/SocialCommerceAuditService.php
app/Services/PhysicalInquiryOrderService.php
app/Services/SocialCommerce/InstagramSocialCommerceProvider.php
app/Services/SocialCommerce/FacebookMarketplaceSocialCommerceProvider.php
app/Events/SocialCommerce*.php
app/Jobs/FetchSocialCommercePreview.php
app/Jobs/SendSocialCommerceSellerInvitation.php
app/Jobs/SendSocialCommerceOfferToBuyer.php
app/Console/Commands/ExpireSocialCommerceRequests.php
app/Console/Commands/SendSocialCommerceReminders.php
app/Console/Commands/PruneSocialCommercePreviewMedia.php
config/social_commerce.php
```

New frontend files:

```text
resources/js/Pages/SocialCommerce/Buy.jsx
resources/js/Pages/SocialCommerce/RequestStatus.jsx
resources/js/Pages/SocialCommerce/Claim.jsx
resources/js/Pages/SocialCommerce/Offer.jsx
resources/js/Pages/Merchant/SocialCommerceRequests.jsx
resources/js/Pages/Merchant/SocialCommerceRequestDetails.jsx
resources/js/Pages/Admin/SocialCommerceRequests.jsx
resources/js/Components/SocialCommerce/*
resources/js/lib/socialCommerce.js
```

New tests:

```text
tests/Unit/SocialCommerceUrlNormalizerTest.php
tests/Unit/SocialCommerceRequestStateTest.php
tests/Unit/SocialCommerceInvitationTokenTest.php
tests/Feature/SocialCommercePreviewTest.php
tests/Feature/SocialCommerceBuyerRequestTest.php
tests/Feature/SocialCommerceSellerClaimTest.php
tests/Feature/SocialCommerceSellerOnboardingTest.php
tests/Feature/SocialCommerceOfferTest.php
tests/Feature/SocialCommerceOrderConversionTest.php
tests/Feature/SocialCommerceNotificationTest.php
tests/Feature/AdminSocialCommerceRequestTest.php
tests/Feature/SocialCommerceSecurityTest.php
```

Existing files likely to change:

```text
app/Http/Controllers/Api/CheckoutController.php
app/Http/Controllers/Api/MerchantOrderController.php
app/Http/Controllers/Api/MerchantAuthController.php
app/Http/Controllers/Api/UploadController.php
app/Services/LinkPreviewService.php
app/Services/MetaSocialConnectorService.php
app/Services/SocialDmAutomationService.php
app/Services/SmsService.php
app/Models/Order.php
app/Models/User.php
app/Models/Merchant.php
routes/api.php
routes/web.php
routes/channels.php
bootstrap/app.php
resources/js/Pages/Feed.jsx
resources/js/Pages/Merchant/Dashboard.jsx
resources/js/Pages/Merchant/VerificationCenter.jsx
resources/js/Pages/Orders.jsx
```

## 24. Definition of done

The implementation is not complete until all of the following are true:

### Functional

- Instagram post/reel and Facebook Marketplace item links are accepted and normalized.
- Preview success and manual fallback both work.
- Buyer identity is verified before request submission/contact.
- Unknown seller can receive and claim a secure invitation.
- Existing and new seller onboarding paths resume correctly.
- KYC/PSP/product/inventory/shipping rules are enforced.
- Seller can create a confirmed offer and send the generated buyer link.
- Buyer acceptance creates one quoted inquiry order.
- Existing payment and full physical fulfillment complete normally.
- Decline, cancellation, expiry, offer revision, and no-response flows work.

### Trust and security

- External fields are visibly unverified until seller confirmation.
- Seller ownership/KYC/social-match labels are accurate.
- URL fetching passes SSRF and content-safety tests.
- Tokens are hashed, expiring, one-time, and absent from logs.
- PII exposure is minimized and encrypted where specified.
- Outreach is rate-limited, deduplicated, and supports suppression/opt-out.
- Restricted-product and abuse controls are active.

### Payment boundary

- No request creates a payment attempt or seller balance.
- Order/payment begins only after buyer offer acceptance.
- PSP callback remains the authority for payment confirmation.
- Existing dispute/refund/release/payout controls remain authoritative.
- Product language does not claim Takeer custody or wallet functionality.

### Reliability and operations

- Jobs are idempotent and observable.
- Provider failures have tested fallbacks.
- Admin/support can audit and safely close requests.
- Data retention and pruning run on schedule.
- Feature flags permit provider and full-feature rollback.
- Alerts and dashboards cover conversion, abuse, provider health, and profitability.

### Quality

- Unit, feature, security, regression, and browser tests pass.
- English and Swahili UI/notifications are reviewed.
- Mobile, low-bandwidth, accessibility, and resume flows are verified.
- Architecture ADR, API documentation, support runbook, privacy/terms changes, and release notes are complete.

## 25. Final implementation decision

Takeer should implement this as a platform-neutral **social-commerce request and seller acquisition system**, with Instagram and Facebook Marketplace as the first source adapters.

The durable product flow is:

```text
External discovery
  -> trusted Takeer request
  -> verified seller claim/onboarding
  -> seller-confirmed Takeer product and offer
  -> buyer-accepted quoted inquiry order
  -> existing PSP payment and fulfillment
  -> existing dispute/refund/release/payout
  -> reusable Takeer seller storefront and future direct sales
```

This design gives buyers a safer way to act on social-media purchase intent, gives sellers confidence that payment and fulfillment follow a defined process, and turns external social-commerce activity into measurable Takeer merchant acquisition, GMV, and recurring platform revenue without weakening Takeer's existing trust or payment boundaries.
