# AI Chat UI Hardening Backlog

Recorded September 12, 2026 after testing the Sommelier tab and the wine-entry
chat on iOS. This document is the handoff for a future implementation pass.

## Scope

Both chat surfaces use `components/ChatBubble.js`, so formatting behavior should
be implemented there or in shared helpers rather than separately in:

- `app/(tabs)/sommelier.js`
- `components/WineChatModal.js`

Preserve the current product behaviors: persisted conversations, attached
photos, sources, reporting, wine-entry suggestions, the AI usage meter, and the
temporarily non-streaming request path.

## Current state

- Markdown is rendered with `react-native-markdown-display`.
- Wide Markdown tables are converted into stacked labelled sections by
  `lib/chatMarkdown.js`. This was added in PR #289 after a four-column tasting
  comparison became unreadable in a narrow phone bubble.
- Assistant bubbles were widened from 78% to 86% of the available row.
- `wine_suggestions` blocks are stripped from display and exposed through the
  native **Use Suggestions** action.
- Sources are displayed as domain chips. Persisting them after reopening still
  requires the `messages.sources` backend migration.
- Streaming is intentionally paused until the matching Supabase function can be
  deployed and verified. See `docs/audits/sommelier-streaming-rollout.md`.

## Backlog and acceptance criteria

### 1. Long links and unbroken text

Prevent URLs, identifiers, long producer names, and other uninterrupted strings
from escaping or stretching the bubble. Links should wrap or truncate visually,
remain tappable, and expose the full destination to accessibility tools.

### 2. Code and JSON blocks

Render ordinary fenced code/JSON in a bounded horizontally scrollable area with
a Copy action. Recognized app payloads should not appear as raw JSON: convert
them into native UI or hide them after parsing. Unknown or invalid structured
blocks must remain readable rather than disappearing.

### 3. Malformed or incomplete Markdown

Handle unmatched emphasis markers, unfinished fences, malformed tables, and
missing separators without breaking layout. Fall back to readable plain text
when a block cannot be rendered safely. Add fixtures based on realistic model
mistakes.

### 4. Headings inside chat bubbles

Use compact chat-specific styles for H1–H6. A model-generated heading must not
look like a full screen title or dominate the answer. Confirm spacing when a
heading starts or ends a reply.

### 5. Nested lists and task lists

Limit indentation so nested bullets do not squeeze content into a narrow strip.
Support ordered lists, unordered lists, and checkbox/task-list syntax with
consistent markers, wrapping, and vertical rhythm.

### 6. Very long responses

Collapse unusually long assistant replies behind a **Show more / Show less**
control while keeping the opening recommendation visible. Expanding or
collapsing must preserve the user's scroll position as closely as possible and
must not hide Sources, Use Suggestions, Copy, or Report actions.

### 7. Error responses and retry

Do not present client/network failures as if they were normal sommelier speech.
Render a visually distinct, non-reportable error card with a concise friendly
message and a Retry action. Retry the original user turn without inserting a
second copy of that user message or replaying the error as model history.
Paywall responses remain paywall flows rather than error cards.

### 8. Citations and sources

Persist sources across close/reopen after the backend migration is applied.
Deduplicate URLs, wrap chips safely, use recognizable domain labels, and make
inline citations link to the corresponding source when the model supplies that
relationship. Invalid URLs should not crash or create dead controls.

### 9. Native structured wine recommendations

Prefer native cards over Markdown tables for recurring wine-domain structures:
bottle comparisons, pairings, tasting-dimension comparisons, drink windows,
and ranked recommendations. Cards should have a readable fallback when the
payload is partial and must never apply changes without an explicit user action.

### 10. Streaming-safe rendering

When streaming is restored, do not repeatedly parse and reflow incomplete
Markdown. Render partial output conservatively during receipt, then apply the
full Markdown/structured renderer after the final event. Preserve the existing
backend rollout requirements and atomic fallback compatibility.

### 11. Text selection and copying

Allow users to copy a bottle name, a useful passage, a code block, or the entire
assistant response. Provide an accessible long-press or explicit action menu
containing Copy and Report without interfering with links or scrolling.

### 12. Accessibility and Dynamic Type

Test VoiceOver reading order, accessible names for links/actions/photos, minimum
touch targets, contrast, and large accessibility font sizes. Content must remain
usable without clipped controls or columns at the largest supported text size.

### 13. Dark mode

Give links, dividers, blockquotes, code blocks, structured cards, source chips,
and error cards explicit theme-aware colors. Verify contrast and borders in both
themes rather than relying on renderer defaults.

### 14. Keyboard, expansion, and scrolling stability

Opening/closing the keyboard, attaching a photo, receiving a reply, expanding a
long answer, showing sources, or tapping **Use Suggestions** must not cause an
unexpected jump. Auto-scroll only when the user is already near the bottom; do
not pull someone away from text they are reading.

## Recommended implementation order

1. Error cards with safe Retry semantics.
2. Code/JSON blocks and long-link containment.
3. Compact headings, nested lists, and malformed-Markdown fallback.
4. Long-response expansion and scroll-position rules.
5. Source persistence/deduplication after the backend migration is available.
6. Native wine recommendation cards.
7. Accessibility and dark-mode verification across every fixture.
8. Streaming-safe partial rendering when backend streaming is re-enabled.

## Definition of done

- The same fixtures render correctly in both chat surfaces on a small iPhone and
  a large iPhone, in light and dark mode.
- Tests cover each transformation and retry/history rule.
- VoiceOver and large-text checks are completed on the simulator.
- No formatting case can overflow the viewport or make the composer unusable.
- Existing wine suggestions, citations, reporting, photos, and conversation
  persistence continue to work.
