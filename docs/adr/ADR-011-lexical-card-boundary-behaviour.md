# ADR-011: Lexical card boundary and caret behaviour

## Status

Accepted — 7 August 2026

## Context

Takeer's long-form editor uses Lexical cards to model Ghost-style non-text
blocks. A decorator card has no native text caret, so the default Lexical
backspace, delete, arrow, and focus behavior can skip cards or leave the
browser selection without a visible insertion point.

## Decision

Implement card-boundary behavior in a dedicated editor plugin. An empty
paragraph immediately after a card is removed on backspace and the card is
selected. A subsequent backspace/delete removes the selected card and restores
the selection to the adjacent paragraph or card. Backspace at the start of a
populated block removes the preceding card while preserving the current caret;
Delete at the end mirrors this for the following card. Arrow navigation selects
adjacent decorator cards, and selecting a card explicitly refocuses the Lexical
root. Native inputs inside cards retain their own browser caret behavior.

Empty cards remain valid editable boundaries when deselected. This allows an
author who backspaces an inline card field to empty, clicks elsewhere, and then
returns to that card to continue writing. Cards are removed only through the
explicit card-boundary backspace/delete behavior.

Card-menu insertion snapshots the active Lexical range before the plus/slash
menu can receive pointer input, restores it before insertion, and then uses the
selected paragraph as the card boundary. This keeps mouse insertion reliable
even when the browser temporarily clears the native caret while the menu is
open.

Persisted cards use two explicit interaction states. The first click selects a
card and exposes only its edit action; a second click or the pencil action
enters editing and mounts the card-specific controls and settings panel. Newly
inserted cards start in editing mode so required media, URL, or text can be
provided immediately. When editing ends, empty controls and placeholders are
not rendered as article content.

## Consequences

- Card insertion and deletion feel continuous with normal long-form typing.
- An empty card remains recoverable after focus leaves it; explicit deletion is
  still handled by the card-boundary commands.
- Card controls remain editable because boundary commands do not intercept
  backspace while an input or textarea owns focus.
- Selection never mounts, autofocuses, or fetches data for card forms; those
  side effects are restricted to the editing state.
- The behavior is intentionally fresh Lexical behavior; no Editor.js or legacy
  document conversion path is maintained.
