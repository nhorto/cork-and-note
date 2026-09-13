// Turns Anthropic's event stream into the same content/usage shape returned by
// its JSON endpoint. Keeping this parser separate makes the streaming chat path
// testable without auth, a database, or the network.

type Block = Record<string, unknown>;
type Usage = Record<string, unknown>;

export type StreamedClaudeMessage = {
  content: Block[];
  stop_reason: string | null;
  usage: Usage;
};

function mergeUsage(target: Usage, next: unknown) {
  if (!next || typeof next !== "object") return;
  for (const [key, value] of Object.entries(next as Usage)) {
    if (typeof value === "number") {
      target[key] =
        (typeof target[key] === "number" ? (target[key] as number) : 0) + value;
    } else if (value && typeof value === "object") {
      const nested = (target[key] && typeof target[key] === "object"
        ? target[key]
        : {}) as Usage;
      mergeUsage(nested, value);
      target[key] = nested;
    }
  }
}

export async function readAnthropicStream(
  response: Response,
  onText: (text: string) => void,
): Promise<StreamedClaudeMessage> {
  if (!response.body) throw new Error("Anthropic returned no response stream");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const content: Block[] = [];
  const partialJson = new Map<number, string>();
  const usage: Usage = {};
  let stopReason: string | null = null;
  let buffer = "";

  const accept = (raw: string) => {
    const dataLine = raw
      .split(/\r?\n/)
      .find((line) => line.startsWith("data:"));
    if (!dataLine) return;
    const payload = dataLine.slice(5).trim();
    if (!payload || payload === "[DONE]") return;

    const event = JSON.parse(payload) as Record<string, unknown>;
    const type = event.type;
    if (type === "error") {
      const error = event.error as Record<string, unknown> | undefined;
      throw new Error(
        typeof error?.message === "string"
          ? error.message
          : "Anthropic stream failed",
      );
    }
    if (type === "message_start") {
      mergeUsage(
        usage,
        (event.message as Record<string, unknown> | undefined)?.usage,
      );
      return;
    }
    if (type === "message_delta") {
      const delta = event.delta as Record<string, unknown> | undefined;
      if (typeof delta?.stop_reason === "string") {
        stopReason = delta.stop_reason;
      }
      mergeUsage(usage, event.usage);
      return;
    }
    if (type === "content_block_start") {
      const index = Number(event.index);
      const block = event.content_block;
      if (Number.isInteger(index) && block && typeof block === "object") {
        content[index] = { ...(block as Block) };
      }
      return;
    }
    if (type === "content_block_delta") {
      const index = Number(event.index);
      const delta = event.delta as Record<string, unknown> | undefined;
      if (!Number.isInteger(index) || !delta) return;
      const block = content[index] || (content[index] = {});
      if (delta.type === "text_delta" && typeof delta.text === "string") {
        block.text = `${
          typeof block.text === "string" ? block.text : ""
        }${delta.text}`;
        onText(delta.text);
      } else if (
        delta.type === "input_json_delta" &&
        typeof delta.partial_json === "string"
      ) {
        partialJson.set(
          index,
          `${partialJson.get(index) || ""}${delta.partial_json}`,
        );
      } else if (delta.type === "citations_delta" && delta.citation) {
        const citations = Array.isArray(block.citations) ? block.citations : [];
        block.citations = [...citations, delta.citation];
      }
      return;
    }
    if (type === "content_block_stop") {
      const index = Number(event.index);
      const json = partialJson.get(index);
      if (json && content[index]) {
        try {
          content[index].input = JSON.parse(json);
        } catch {
          content[index].input = {};
        }
      }
    }
  };

  const drain = (final = false) => {
    const parts = buffer.split(/\r?\n\r?\n/);
    buffer = parts.pop() || "";
    for (const part of parts) if (part.trim()) accept(part);
    if (final && buffer.trim()) {
      accept(buffer);
      buffer = "";
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    drain();
  }
  buffer += decoder.decode();
  drain(true);

  return { content: content.filter(Boolean), stop_reason: stopReason, usage };
}
