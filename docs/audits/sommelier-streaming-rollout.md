# Sommelier streaming — deferred

Streaming is disabled in both the Sommelier tab and wine-entry chat. They use
`aiService.sendChatMessage`, which currently delegates to the regular JSON
`sendMessage` request. Users see the pending indicator followed by the complete
answer. The streaming transport, UI delta handlers, and backend implementation
remain in the repository for later activation.

The current CLI account cannot access Cork & Note's Supabase project
`ixecayqpogkiawempzgc` (403). The owner needs to remain signed into another
Supabase account for now, so backend deployment is deferred. No account switch
or backend deployment is required to run the non-streaming app.

Before enabling streaming:

1. Obtain deployment access to the Cork & Note project and verify live backend
   parity. Deploy the matching `chat` function and apply the
   `20260912030000_message_sources.sql` migration for persisted citations.
2. Verify real initial and follow-up requests return incremental NDJSON deltas
   and a terminal `done` event, including sourced replies and form suggestions.
3. Change the shared `sendChatMessage` entry point to forward to
   `sendMessageStream` with its options, then test both screens in iOS.

Disabling streaming does not fix server-side gateway timeouts. The timeout log
alone does not establish why a request timed out; backend logs and live tests
are still needed. Until the sources migration is applied, the compatibility
fallback lets chat save replies, but citations cannot persist across reopening.
