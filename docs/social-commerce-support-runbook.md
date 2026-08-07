# Social-commerce Link Buy support runbook

## Safety rules

- A request is not an order and never proves payment.
- Tell buyers to pay only through the linked Takeer PSP inquiry checkout. Do not ask them to pay a social account, staff member, or courier directly.
- A claim proves possession of an invitation, not ownership of the Instagram or Facebook account.
- Use the request event timeline, invitation history, merchant KYC status, product ownership, offer revision, and linked order before making a trust decision.

## Common actions

- Preview unavailable or carousel item is ambiguous: ask the buyer for a screenshot of the exact selected item from the same original post, plus title, seller handle, quantity, and destination. The request can continue with private buyer evidence; treat the screenshot as unverified until the seller confirms the product.
- Seller has not responded: the buyer may share or copy the invitation again within the configured limit. Do not reveal the buyer's exact address.
- Wrong seller claimed: block the request before conversion, record the reason, and ask the buyer to create a new request if the seller identity is corrected.
- Offer expired or stock changed: ask the seller to issue a new offer. Never create an order from an expired snapshot.
- SMS opt-out: use the invitation contact opt-out endpoint and record the seller contact suppression hash.

## Rollback

Disable `SOCIAL_COMMERCE_ENABLED` or the affected provider flag. Leave existing requests, audit events, and converted orders intact. Converted orders continue through the normal order lifecycle.
