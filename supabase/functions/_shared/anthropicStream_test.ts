import { assertEquals } from "jsr:@std/assert";
import { readAnthropicStream } from "./anthropicStream.ts";

const encoder = new TextEncoder();

function responseFrom(chunks: string[]) {
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
    }),
    { headers: { "Content-Type": "text/event-stream" } },
  );
}

Deno.test("Anthropic stream parser emits text early and rebuilds the final message", async () => {
  const chunks = [
    'event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":12}}}\n\n',
    'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":"","citations":[]}}\n\n' +
    'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Tr',
    'y "}}\n\nevent: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Muscadet."}}\n\n' +
    'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":7}}\n\n',
  ];

  const deltas: string[] = [];
  const message = await readAnthropicStream(
    responseFrom(chunks),
    (text) => deltas.push(text),
  );
  assertEquals(deltas, ["Try ", "Muscadet."]);
  assertEquals(message.content, [{
    type: "text",
    text: "Try Muscadet.",
    citations: [],
  }]);
  assertEquals(message.stop_reason, "end_turn");
  assertEquals(message.usage, { input_tokens: 12, output_tokens: 7 });
});
