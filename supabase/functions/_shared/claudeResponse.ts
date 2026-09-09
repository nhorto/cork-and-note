// supabase/functions/_shared/claudeResponse.ts
// Reading Claude's reply when server-side tools are in play.
//
// Without tools a response is one text block and `content[0].text` is the whole
// answer. With web search it is a mixed list — `server_tool_use`, one or more
// `web_search_tool_result`, and several `text` blocks carrying citations — and
// the answer is the text blocks joined in order.
//
// Pure and Deno-free on purpose: __tests__/claudeResponse.test.js feeds it real
// response shapes, including the error shapes that are easy to get wrong.

/** A page the sommelier leaned on, shown under the reply so claims are checkable. */
export type Source = { url: string; title: string | null };

/** Sources shown per reply. Enough to be credible, not enough to bury the answer. */
export const MAX_SOURCES = 6;

type Block = Record<string, unknown>;

function blocks(content: unknown): Block[] {
  return Array.isArray(content) ? (content as Block[]).filter((b) => b && typeof b === "object") : [];
}

/**
 * The conversational answer: every text block, in order.
 *
 * Joined with "" rather than "\n" because the API splits text at citation
 * boundaries mid-sentence — inserting newlines would chop sentences in half.
 */
export function textFromContent(content: unknown): string {
  return blocks(content)
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string)
    .join("");
}

function isHttpUrl(value: unknown): value is string {
  return typeof value === "string" && /^https?:\/\//i.test(value);
}

function titleOf(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

/**
 * The pages behind a reply, most-cited-first, deduped by URL.
 *
 * Two passes on purpose. Citations attached to text blocks are what Claude
 * actually leaned on for a specific sentence, so they lead. Raw search results
 * follow, because a reply that searched and then paraphrased without formally
 * citing still owes the user somewhere to check.
 *
 * The error shape is the trap here: a FAILED web_search_tool_result has an
 * OBJECT `content` (`{ error_code: "max_uses_exceeded" }`) where a successful
 * one has an ARRAY, and server-tool failures arrive as a normal HTTP 200 rather
 * than a thrown error. Indexing without checking would throw inside a
 * successful request.
 */
export function collectSources(content: unknown): Source[] {
  const found: Source[] = [];
  const seen = new Set<string>();

  const add = (url: unknown, title: unknown) => {
    if (!isHttpUrl(url) || seen.has(url)) return;
    seen.add(url);
    found.push({ url, title: titleOf(title) });
  };

  const all = blocks(content);

  for (const block of all) {
    if (block.type !== "text" || !Array.isArray(block.citations)) continue;
    for (const citation of block.citations as Block[]) {
      if (citation && typeof citation === "object") add(citation.url, citation.title);
    }
  }

  for (const block of all) {
    if (block.type !== "web_search_tool_result") continue;
    if (!Array.isArray(block.content)) continue; // error object, not a result list
    for (const result of block.content as Block[]) {
      if (result && typeof result === "object") add(result.url, result.title);
    }
  }

  return found.slice(0, MAX_SOURCES);
}

/**
 * How many web searches this call billed us for, from `usage.server_tool_use`.
 *
 * Recorded per call so the real cost of search is a query away rather than a
 * guess — the number that would justify a per-day search cap later, or prove
 * one is unnecessary.
 */
export function webSearchRequestCount(usage: unknown): number {
  const serverToolUse = (usage as { server_tool_use?: unknown })?.server_tool_use as
    | { web_search_requests?: unknown }
    | undefined;
  const n = serverToolUse?.web_search_requests;
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}
