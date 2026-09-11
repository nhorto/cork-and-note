// supabase/functions/_shared/testing.ts
// Fakes for driving the edge-function handlers under `deno test` without a
// database, an Anthropic key, or a network.
//
// The handlers touch supabase-js through a narrow surface: auth.getUser, a
// count query on chat_usage, a maybeSingle on entitlements, inserts, upserts,
// an rpc, storage list/remove, and auth.admin.deleteUser. FakeSupabase records
// every builder chain that is awaited and answers it from a scripted table of
// responders, so a test can both assert what a handler asked for and decide
// what it gets back.
import type { HandlerDeps } from "./deps.ts";

export type RecordedQuery = {
  table: string;
  op: "select" | "insert" | "upsert" | "update" | "delete";
  filters: { op: string; column: string; value: unknown }[];
  options: Record<string, unknown>;
  payload?: unknown;
  modifiers: Record<string, unknown>;
};

export type QueryResult = { data?: unknown; error?: unknown; count?: number | null };
export type Responder = (q: RecordedQuery) => QueryResult | Promise<QueryResult>;

const OK: QueryResult = { data: null, error: null, count: 0 };

export class FakeSupabase {
  queries: RecordedQuery[] = [];
  rpcCalls: { name: string; args: unknown }[] = [];
  storageCalls: { bucket: string; op: string; args: unknown }[] = [];
  deletedUsers: string[] = [];
  user: { id: string; email?: string } | null;
  responders: Record<string, Responder> = {};
  rpcResponders: Record<string, (args: unknown) => QueryResult> = {};
  storageObjects: Record<string, string[]> = {};
  storageRemoveError: unknown = null;
  storageListError: unknown = null;
  adminDeleteError: unknown = null;

  constructor(user: { id: string; email?: string } | null = { id: "00000000-0000-4000-8000-000000000001" }) {
    this.user = user;
  }

  /** Script the answer for every query against a table. */
  respond(table: string, responder: Responder | QueryResult) {
    this.responders[table] = typeof responder === "function" ? responder : () => responder;
    return this;
  }

  queriesTo(table: string) {
    return this.queries.filter((q) => q.table === table);
  }

  get auth() {
    const self = this;
    return {
      getUser: () =>
        Promise.resolve(
          self.user
            ? { data: { user: self.user }, error: null }
            : { data: { user: null }, error: { message: "invalid JWT" } },
        ),
      admin: {
        deleteUser: (id: string) => {
          self.deletedUsers.push(id);
          return Promise.resolve(self.adminDeleteError ? { error: self.adminDeleteError } : { error: null });
        },
      },
    };
  }

  from(table: string) {
    const self = this;
    const q: RecordedQuery = { table, op: "select", filters: [], options: {}, modifiers: {} };
    self.queries.push(q);
    const run = async (): Promise<QueryResult> => {
      const r = self.responders[table];
      return r ? await r(q) : OK;
    };
    // deno-lint-ignore no-explicit-any
    const api: any = {
      select(columns = "*", options: Record<string, unknown> = {}) {
        if (q.op === "select") q.modifiers.columns = columns;
        else q.modifiers.returning = true;
        q.options = { ...q.options, ...options };
        return api;
      },
      insert(payload: unknown) { q.op = "insert"; q.payload = payload; return api; },
      upsert(payload: unknown, options: Record<string, unknown> = {}) { q.op = "upsert"; q.payload = payload; q.options = { ...q.options, ...options }; return api; },
      update(payload: unknown) { q.op = "update"; q.payload = payload; return api; },
      delete() { q.op = "delete"; return api; },
      eq: (column: string, value: unknown) => { q.filters.push({ op: "eq", column, value }); return api; },
      neq: (column: string, value: unknown) => { q.filters.push({ op: "neq", column, value }); return api; },
      gte: (column: string, value: unknown) => { q.filters.push({ op: "gte", column, value }); return api; },
      lte: (column: string, value: unknown) => { q.filters.push({ op: "lte", column, value }); return api; },
      in: (column: string, value: unknown) => { q.filters.push({ op: "in", column, value }); return api; },
      is: (column: string, value: unknown) => { q.filters.push({ op: "is", column, value }); return api; },
      or: (expression: string) => { q.filters.push({ op: "or", column: "", value: expression }); return api; },
      limit(n: number) { q.modifiers.limit = n; return api; },
      order(column: string, options: unknown) { q.modifiers.order = { column, options }; return api; },
      single() { q.modifiers.single = true; return api; },
      maybeSingle() { q.modifiers.maybeSingle = true; return api; },
      then(resolve: (v: QueryResult) => unknown, reject?: (e: unknown) => unknown) {
        return run().then(resolve, reject);
      },
    };
    return api;
  }

  rpc(name: string, args: unknown) {
    this.rpcCalls.push({ name, args });
    const r = this.rpcResponders[name];
    return Promise.resolve(r ? r(args) : { data: null, error: null });
  }

  get storage() {
    const self = this;
    return {
      from(bucket: string) {
        return {
          list(prefix?: string, options?: unknown) {
            self.storageCalls.push({ bucket, op: "list", args: { prefix, options } });
            if (self.storageListError) return Promise.resolve({ data: null, error: self.storageListError });
            const names = (self.storageObjects[bucket] ?? []).filter((n) => !prefix || n.startsWith(prefix));
            return Promise.resolve({ data: names.map((name) => ({ name })), error: null });
          },
          remove(paths: string[]) {
            self.storageCalls.push({ bucket, op: "remove", args: paths });
            if (self.storageRemoveError) return Promise.resolve({ data: null, error: self.storageRemoveError });
            self.storageObjects[bucket] = (self.storageObjects[bucket] ?? []).filter((n) => !paths.includes(n));
            return Promise.resolve({ data: paths.map((name) => ({ name })), error: null });
          },
        };
      },
    };
  }
}

/** A fetch that answers from a queue of responses and records every request. */
export class FakeFetch {
  calls: { url: string; init: RequestInit | undefined; body: unknown }[] = [];
  private queue: (Response | ((url: string, body: unknown) => Response))[] = [];

  reply(status: number, body: unknown, headers: Record<string, string> = {}) {
    this.queue.push(new Response(typeof body === "string" ? body : JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json", ...headers },
    }));
    return this;
  }

  replyWith(fn: (url: string, body: unknown) => Response) {
    this.queue.push(fn);
    return this;
  }

  get fn(): typeof globalThis.fetch {
    return (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      let body: unknown = null;
      const rawBody = (init as { body?: unknown } | undefined)?.body;
      if (typeof rawBody === "string") {
        try { body = JSON.parse(rawBody); } catch { body = rawBody; }
      }
      this.calls.push({ url, init, body });
      const next = this.queue.shift();
      if (!next) throw new Error(`FakeFetch: no reply queued for ${url}`);
      return Promise.resolve(typeof next === "function" ? next(url, body) : next);
    };
  }
}

export type FakeDepsOptions = {
  user?: FakeSupabase["user"];
  env?: Record<string, string | undefined>;
  now?: number;
};

/** Everything a handler needs, wired to fakes, plus handles to inspect them. */
export function fakeDeps(options: FakeDepsOptions = {}) {
  const db = new FakeSupabase(options.user === undefined ? undefined : options.user);
  const admin = new FakeSupabase(null);
  const fetch = new FakeFetch();
  const env: Record<string, string | undefined> = { ANTHROPIC_API_KEY: "sk-test", ...(options.env ?? {}) };
  const now = options.now ?? Date.UTC(2026, 8, 11, 15, 0, 0);
  const deps: HandlerDeps = {
    // deno-lint-ignore no-explicit-any
    createUserClient: () => db as any,
    // deno-lint-ignore no-explicit-any
    createAdminClient: () => admin as any,
    fetch: fetch.fn,
    env: (key) => env[key],
    now: () => now,
  };
  return { deps, db, admin, fetch, env, now };
}

/** A POST with a JSON body and, by default, a bearer token. */
export function jsonRequest(
  body: unknown,
  { auth = "Bearer test-jwt", method = "POST", headers = {} as Record<string, string>, url = "https://edge.test/fn" } = {},
) {
  const h: Record<string, string> = { "Content-Type": "application/json", ...headers };
  if (auth) h.Authorization = auth;
  return new Request(url, { method, headers: h, body: typeof body === "string" ? body : JSON.stringify(body) });
}

export async function readJson(res: Response) {
  return await res.json();
}
