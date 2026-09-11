// supabase/functions/_shared/deps.ts
// The ambient things an edge function handler touches, gathered into one
// injectable bag so the handlers can run under `deno test` with fakes.
//
// Every default is the exact call the handlers made inline before this file
// existed (env read at request time, a fresh supabase-js client per request),
// so `createHandler()` with no overrides behaves as the functions always did.
import {
  createClient,
  type SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2";

export type HandlerDeps = {
  /**
   * A client acting AS THE CALLER: anon key plus the caller's Authorization
   * header, so RLS scopes every query to that user.
   */
  createUserClient: (authHeader: string) => SupabaseClient;
  /** A service-role client; bypasses RLS. Only for the steps that need it. */
  createAdminClient: () => SupabaseClient;
  /** Outbound HTTP (Anthropic, Google). Tests hand in a recorder. */
  fetch: typeof globalThis.fetch;
  /** Secret / config reader. */
  env: (key: string) => string | undefined;
  /** The clock, in epoch milliseconds. */
  now: () => number;
};

export function defaultDeps(): HandlerDeps {
  return {
    createUserClient: (authHeader) =>
      createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        { global: { headers: { Authorization: authHeader } } }
      ),
    createAdminClient: () =>
      createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      ),
    fetch: (input, init) => globalThis.fetch(input, init),
    env: (key) => Deno.env.get(key),
    now: () => Date.now(),
  };
}

/** Real deps with any subset overridden. */
export function resolveDeps(overrides: Partial<HandlerDeps> = {}): HandlerDeps {
  return { ...defaultDeps(), ...overrides };
}
