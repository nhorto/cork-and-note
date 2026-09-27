# Sommelier streaming: enabled

Streaming is ON in both the Sommelier tab and the wine-entry chat as of
2026-09-27 (owner feedback: long answers sat behind a silent typing indicator).
Both screens call `aiService.sendChatMessage`, which now forwards to
`sendMessageStream` (`lib/chatStream.js`, NDJSON over XMLHttpRequest).

## Backend

The matching `chat` function is live: version 21 on project
`ixecayqpogkiawempzgc` was deployed 2026-09-13 16:28 UTC, after the last
change to `supabase/functions/chat` and `_shared` on `main` (PR #289, merged
16:13 UTC the same day). The `20260912030000_message_sources.sql` migration is
applied. No backend deploy was needed to turn streaming on.

## Verified on the iOS simulator (2026-09-27, demo account)

- A new question from the Sommelier hub streamed in: a screenshot one second
  after sending showed the reply mid-sentence, then the finished message with
  its timestamp.
- A follow-up question sent from the chat input left the box straight away,
  showed as a bubble at once, and its reply streamed.

## How it behaves

- The client sends `stream: true`; the function streams only for the metered
  `chat` task. Vision and structured tasks stay atomic JSON.
- An older function that ignores `stream` still works: `streamEdgeFunction`
  treats a plain JSON body as one completed chunk.
- While streaming, `aiService.getStreamingDisplayText` hides a structured
  fenced block (for example ```` ```wine_suggestions ````) that has opened but
  not closed yet, so raw JSON never flashes up.
- A 402 (free meter spent) still opens the paywall and publishes the meter.
