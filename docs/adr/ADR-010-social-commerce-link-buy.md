# ADR-010: Social-commerce Link Buy request boundary

## Status

Accepted — 5 August 2026

## Context

Instagram posts and Facebook Marketplace listings can create high-intent purchase demand without providing a trustworthy order, seller identity, delivery record, or buyer-protection path. External metadata is also stale and cannot be treated as commercial truth.

## Decision

Takeer stores pasted social links as `social_commerce_requests`. A request is a lead and negotiation record only. It cannot start a payment, reserve inventory, or trigger settlement. A seller must claim the request through a one-time fragment token, use an owned merchant profile, pass the existing KYC/PSP gates, and confirm a physical product and offer. Only the buyer's explicit acceptance converts the request into the existing quoted physical inquiry order.

The implementation uses provider adapters for URL normalization and best-effort public metadata. Official Meta account access and messaging are optional enhancements. Seller outreach remains buyer-mediated or explicitly attested SMS when official messaging capability is unavailable. New request creation requires an authenticated, phone-verified buyer and a valid seller phone plus buyer attestation; guests can preview links but cannot create or track requests.

Claim tokens are high-entropy, stored only as SHA-256 hashes, and supplied in the authenticated POST body. The invitation GET page is non-mutating. Seller contact and delivery context are encrypted; audit and marketing events contain hashes and safe identifiers only.

The buyer flow reuses Takeer's saved-address manager. A signed-in buyer may select
an owned saved address or enter an exact address/landmark manually. The exact
delivery data is stored in the request's encrypted delivery context and is shown
only to the buyer and the claimed seller; the request list continues to expose
only a delivery-area summary. This gives the seller enough information to quote
delivery without putting private addresses into public previews or invitations.

Public preview extraction remains deterministic and best-effort: Open Graph and
platform metadata may provide an image, caption, and other observed signals.
AI is not required to fetch or display that media. Any future AI enrichment must
be optional, confidence-labelled, evidence-bound, and never allowed to replace
seller confirmation of product, price, stock, variants, or delivery.

When public preview metadata contains an Instagram profile URL, an explicit
`@handle`, or the platform's dated caption format, Takeer extracts a canonical
lowercase seller handle and the corresponding public profile URL. This is a
public, unverified observation; the post shortcode is retained separately and
is not treated as an account identity. A later request is matched to an earlier
observed seller only when the handle and the buyer-attested, globally
normalized seller phone both match. If the earlier request is already claimed
by a Takeer merchant, the match can identify that merchant for routing, but it
does not bypass seller claim or onboarding for the new request.

Seller contact extraction follows the same trust boundary. Takeer uses the
libphonenumber metadata library to identify valid international numbers from
public captions, descriptions, `tel:` links, and WhatsApp links. Numbers with a
`+` or `00` country prefix are parsed globally; local-format numbers are only
normalized when a supplied country context is available. A detected number is
an unverified candidate, never proof of seller identity. The buyer must choose
or edit the number and attest that it is the seller's business contact before
Takeer can send an SMS invitation. The stored request and invitation use E.164
normalization, encryption, and HMAC hashes for deduplication/suppression.

Buyer-selected screenshots are stored as private request evidence, not public
product media. A buyer may attach a screenshot of the exact item from a
carousel or incomplete social preview; the buyer, claimed seller, and
authorized admins can view it through an authenticated protected endpoint.
The seller invitation includes both the original social post URL and the
protected Takeer request link, while the screenshot remains untrusted evidence
until the seller confirms the product.

## Consequences

- The existing PSP, payment callback, Safe-Chat, delivery, dispute, refund, release, and payout state machines remain authoritative.
- Preview failures do not block manual buyer evidence and request submission.
- The feature can be disabled by configuration without unlinking converted orders.
- Product setup and onboarding require more steps than a direct social payment, but this is the required trust boundary for the Tanzania pilot.
