# Sommelier streaming — deferred

Streaming is disabled in both the Sommelier tab and wine-entry chat. They use
`aiService.sendChatMessage`, which currently delegates to the regular JSON
`sendMessage` request. Users see the pending indicator followed by the complete
answer. The streaming transport, UI delta handlers, and backend implementation
remain in the repository for later activation.

The earlier access problem is resolved. On September 13, the three pending
migrations (including message sources) and matching functions were deployed to
Cork & Note project `ixecayqpogkiawempzgc`. Live buffered chat and backend
streaming both returned HTTP 200; streaming emitted incremental deltas and a
terminal `done` event. Backend parity and security/deletion probes pass.

Client activation remains a separate change requiring both screens' acceptance.
No source toggle was changed as part of the PR integration.

Before enabling streaming:

1. Recheck backend parity against the exact activation commit. The matching
   function and `20260912030000_message_sources.sql` migration are deployed.
2. Verify real initial and follow-up requests return incremental NDJSON deltas
   and a terminal `done` event, including sourced replies and form suggestions.
3. Change the shared `sendChatMessage` entry point to forward to
   `sendMessageStream` with its options, then test both screens in iOS.

Disabling streaming does not fix server-side gateway timeouts. The timeout log
alone does not establish why a request timed out; backend logs and live tests
are still needed. The sources migration is now applied; verify citations persist when a sourced
conversation is reopened on each candidate.
