# ADR-012: Versioned long-form drafts

## Status

Accepted — 2026-08-07

## Context

Long-form posts can take several sessions to complete. A browser-only draft is not sufficient because it cannot be resumed reliably across devices, and overwriting one database row provides no recovery from accidental edits.

## Decision

- A long-form draft is stored as a `content_items` row with `visibility = draft` and `format = lexical`.
- The composer autosaves meaningful changes after a short idle period and retains the content item ID for subsequent updates.
- Every distinct saved state is copied to `content_item_versions`, deduplicated by a SHA-256 hash of its title, excerpt, body, and format.
- Version allocation locks the parent content item so overlapping autosaves cannot allocate the same version number.
- Merchants can list and reopen their drafts from the composer, inspect revision history, and restore an earlier revision. Restoring always returns the content item to draft state.
- Publishing a loaded draft links the resulting feed post to that content item instead of leaving an orphaned draft.
- Draft content is never searchable. Published unrestricted Lexical content contributes extracted text from both normal nodes and supported cards. Restricted content contributes metadata but not its locked body.

## Consequences

- Draft recovery works across sessions and devices.
- Storage grows with meaningful revisions; a retention policy can be added later without changing the editor format.
- Search indexing remains aligned with access control.
