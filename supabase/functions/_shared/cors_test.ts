// The CORS policy: a browser origin is echoed back only when it is on the
// ALLOWED_ORIGINS allow-list, which is read once at module load. Each
// configuration therefore runs in its own subprocess. The native app sends no
// Origin at all and must be unaffected either way.
import { assertEquals } from "jsr:@std/assert";

/** Run corsHeaders() for one Origin under one ALLOWED_ORIGINS value, in a fresh process. */
async function headersFor(origin: string | null, allowed: string | undefined) {
  const script = `
    import { corsHeaders } from ${JSON.stringify(new URL("./cors.ts", import.meta.url).href)};
    const headers = { "Content-Type": "application/json" };
    if (${JSON.stringify(origin)} !== null) headers["Origin"] = ${JSON.stringify(origin)};
    console.log(JSON.stringify(corsHeaders(new Request("https://edge.test/fn", { method: "POST", headers }))));
  `;
  const env: Record<string, string> = {};
  if (allowed !== undefined) env.ALLOWED_ORIGINS = allowed;
  const cmd = new Deno.Command(Deno.execPath(), {
    args: ["eval", "--no-check", script],
    env,
    clearEnv: false,
    stdout: "piped",
    stderr: "piped",
  });
  const out = await cmd.output();
  if (!out.success) throw new Error(new TextDecoder().decode(out.stderr));
  return JSON.parse(new TextDecoder().decode(out.stdout)) as Record<string, string>;
}

Deno.test("with the secret unset, no browser origin is granted access", async () => {
  const h = await headersFor("https://cork-and-note.vercel.app", undefined);
  assertEquals(h["Access-Control-Allow-Origin"], undefined);
  assertEquals(h["Vary"], "Origin");
  assertEquals(h["Access-Control-Allow-Methods"], "POST, OPTIONS");
});

Deno.test("an allow-listed origin is echoed back exactly; a stranger, a look-alike, and a scheme mismatch are not", async () => {
  const allowed = " https://cork-and-note.vercel.app , https://corkandnote.com ";
  assertEquals((await headersFor("https://cork-and-note.vercel.app", allowed))["Access-Control-Allow-Origin"], "https://cork-and-note.vercel.app");
  assertEquals((await headersFor("https://corkandnote.com", allowed))["Access-Control-Allow-Origin"], "https://corkandnote.com");
  for (const origin of ["https://evil.example", "https://cork-and-note.vercel.app.evil.example", "http://cork-and-note.vercel.app", "https://CORK-AND-NOTE.vercel.app"]) {
    assertEquals((await headersFor(origin, allowed))["Access-Control-Allow-Origin"], undefined, origin);
  }
});

Deno.test("a wildcard is never emitted, even if someone puts one in the secret", async () => {
  const h = await headersFor("https://evil.example", "*");
  assertEquals(h["Access-Control-Allow-Origin"], undefined);
});

Deno.test("a request with no Origin (the native app) gets the method and header allowances and nothing else", async () => {
  const h = await headersFor(null, "https://cork-and-note.vercel.app");
  assertEquals(h["Access-Control-Allow-Origin"], undefined);
  assertEquals(h["Access-Control-Allow-Headers"], "authorization, x-client-info, apikey, content-type, accept");
});
