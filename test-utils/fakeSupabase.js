// test-utils/fakeSupabase.js: an in-memory stand-in for the supabase-js client.
//
// Why this exists: fifteen test files each re-declare `jest.mock('../lib/supabase')`
// with a hand-rolled stub, and none of them can assert what a service actually
// SENT (table, filters, payload) or exercise a service's read-modify-write path.
// This fake records every query and evaluates the common PostgREST builder
// chain against seeded rows, so a test can seed a table, call the real service,
// and assert both the returned value and the rows left behind.
//
// Usage:
//   const fake = createFakeSupabase({ user: { id: 'u1' }, tables: { visits: [row] } });
//   jest.mock('../lib/supabase', () => ({ supabase: require('../test-utils/fakeSupabase').currentFake() }));
//   ...
//   fake.calls            // every query, in order: { table, op, filters, payload, modifiers }
//   fake.tables.visits    // the rows as the service left them
//   fake.callsTo('wines') // just the queries against one table
//
// Per-table overrides let a test force an error or a custom result:
//   createFakeSupabase({ responders: { visits: (q) => ({ data: null, error: { message: 'boom' } }) } })
// A responder receives the recorded query and returns `{ data, error, count }`
// (or a plain array, treated as rows). Return `undefined` to fall back to the
// in-memory evaluation.
//
// Deliberately NOT supported (throws, so a test cannot pass by accident):
//   `.or()`, `.not()` and `.textSearch()` filters have no in-memory evaluator.
//   Use a responder for those queries.

const PGRST_NO_ROWS = { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' };

let current = null;

/** The most recently created fake, for `jest.mock` factories that run before the test body. */
export function currentFake() {
  if (!current) current = createFakeSupabase();
  return current;
}

export function createFakeSupabase(options = {}) {
  const tables = {};
  const responders = {};
  const rpcs = {};
  const buckets = {};
  const calls = [];
  const seed = (opts) => {
    for (const key of Object.keys(tables)) delete tables[key];
    for (const [name, rows] of Object.entries(opts.tables || {})) tables[name] = rows.map((row) => ({ ...row }));
    for (const key of Object.keys(responders)) delete responders[key];
    Object.assign(responders, opts.responders || {});
    for (const key of Object.keys(rpcs)) delete rpcs[key];
    Object.assign(rpcs, opts.rpc || {});
    for (const key of Object.keys(buckets)) delete buckets[key];
    calls.length = 0;
  };
  seed(options);
  const authListeners = [];
  let nextId = 1000;
  let user = options.user === undefined ? { id: 'user-1', email: 'test@example.com' } : options.user;
  let session = user ? { user, access_token: 'token-1' } : null;

  const record = (call) => {
    calls.push(call);
    return call;
  };

  function newQuery(table) {
    return { table, op: 'select', columns: '*', filters: [], modifiers: {}, payload: null, options: {} };
  }

  function evaluate(query) {
    const override = responders[query.table];
    if (override) {
      const out = typeof override === 'function' ? override(query) : override;
      if (out !== undefined) return Array.isArray(out) ? { data: out, error: null, count: out.length } : out;
    }
    if (!tables[query.table]) tables[query.table] = [];
    const rows = tables[query.table];

    if (query.op === 'insert') {
      const inserted = (Array.isArray(query.payload) ? query.payload : [query.payload]).map((row) => ({
        id: row.id ?? nextId++,
        ...row,
      }));
      rows.push(...inserted);
      return finish(query, inserted);
    }
    if (query.op === 'upsert') {
      const list = Array.isArray(query.payload) ? query.payload : [query.payload];
      const key = query.options.onConflict || 'id';
      const out = [];
      for (const row of list) {
        const existing = rows.find((r) => r[key] === row[key]);
        if (existing) {
          if (!query.options.ignoreDuplicates) Object.assign(existing, row);
          out.push(existing);
        } else {
          const created = { id: row.id ?? nextId++, ...row };
          rows.push(created);
          out.push(created);
        }
      }
      return finish(query, out);
    }

    const matched = rows.filter((row) => query.filters.every((f) => matches(row, f)));

    if (query.op === 'update') {
      matched.forEach((row) => Object.assign(row, query.payload));
      return finish(query, matched);
    }
    if (query.op === 'delete') {
      for (const row of matched) rows.splice(rows.indexOf(row), 1);
      return finish(query, matched);
    }

    let out = matched.map((row) => ({ ...row }));
    for (const order of query.modifiers.order || []) {
      const dir = order.ascending === false ? -1 : 1;
      out.sort((a, b) => {
        const av = a[order.column];
        const bv = b[order.column];
        if (av === bv) return 0;
        if (av === null || av === undefined) return order.nullsFirst ? -1 : 1;
        if (bv === null || bv === undefined) return order.nullsFirst ? 1 : -1;
        return av > bv ? dir : -dir;
      });
    }
    if (query.modifiers.range) {
      const [from, to] = query.modifiers.range;
      out = out.slice(from, to + 1);
    }
    if (query.modifiers.limit !== undefined) out = out.slice(0, query.modifiers.limit);
    return finish(query, out);
  }

  function finish(query, out) {
    const count = query.options.count ? out.length : null;
    if (query.options.head) return { data: null, error: null, count };
    // Writes without `.select()` return no rows, like PostgREST with `return=minimal`.
    if (query.op !== 'select' && !query.modifiers.returning) return { data: null, error: null, count };
    if (query.modifiers.single) {
      if (out.length !== 1) return { data: null, error: PGRST_NO_ROWS, count };
      return { data: out[0], error: null, count };
    }
    if (query.modifiers.maybeSingle) {
      if (out.length > 1) return { data: null, error: PGRST_NO_ROWS, count };
      return { data: out[0] ?? null, error: null, count };
    }
    return { data: out, error: null, count };
  }

  function builder(table) {
    const query = newQuery(table);
    record(query);
    const api = {
      select(columns = '*', opts = {}) {
        if (query.op === 'select') query.columns = columns;
        else query.modifiers.returning = true;
        query.options = { ...query.options, ...opts };
        return api;
      },
      insert(payload, opts = {}) { query.op = 'insert'; query.payload = payload; query.options = { ...query.options, ...opts }; return api; },
      upsert(payload, opts = {}) { query.op = 'upsert'; query.payload = payload; query.options = { ...query.options, ...opts }; return api; },
      update(payload, opts = {}) { query.op = 'update'; query.payload = payload; query.options = { ...query.options, ...opts }; return api; },
      delete(opts = {}) { query.op = 'delete'; query.options = { ...query.options, ...opts }; return api; },
      eq: (column, value) => filter('eq', column, value),
      neq: (column, value) => filter('neq', column, value),
      gt: (column, value) => filter('gt', column, value),
      gte: (column, value) => filter('gte', column, value),
      lt: (column, value) => filter('lt', column, value),
      lte: (column, value) => filter('lte', column, value),
      is: (column, value) => filter('is', column, value),
      in: (column, values) => filter('in', column, values),
      like: (column, pattern) => filter('like', column, pattern),
      ilike: (column, pattern) => filter('ilike', column, pattern),
      contains: (column, value) => filter('contains', column, value),
      match(object) { for (const [k, v] of Object.entries(object)) filter('eq', k, v); return api; },
      or(expression) { query.filters.push({ op: 'or', expression }); return api; },
      not(column, operator, value) { query.filters.push({ op: 'not', column, operator, value }); return api; },
      order(column, opts = {}) { (query.modifiers.order ||= []).push({ column, ...opts }); return api; },
      limit(n) { query.modifiers.limit = n; return api; },
      range(from, to) { query.modifiers.range = [from, to]; return api; },
      single() { query.modifiers.single = true; return api; },
      maybeSingle() { query.modifiers.maybeSingle = true; return api; },
      then(resolve, reject) {
        return Promise.resolve().then(() => evaluate(query)).then(resolve, reject);
      },
    };
    function filter(op, column, value) {
      query.filters.push({ op, column, value });
      return api;
    }
    return api;
  }

  function matches(row, f) {
    const v = row[f.column];
    switch (f.op) {
      case 'eq': return v === f.value;
      case 'neq': return v !== f.value;
      case 'gt': return v > f.value;
      case 'gte': return v >= f.value;
      case 'lt': return v < f.value;
      case 'lte': return v <= f.value;
      case 'is': return f.value === null ? v === null || v === undefined : v === f.value;
      case 'in': return f.value.includes(v);
      case 'like': return likeMatch(v, f.value, false);
      case 'ilike': return likeMatch(v, f.value, true);
      case 'contains':
        if (Array.isArray(v)) return (Array.isArray(f.value) ? f.value : [f.value]).every((x) => v.includes(x));
        return false;
      case 'not':
        if (f.operator === 'is' && f.value === null) return v !== null && v !== undefined;
        return !matches(row, { op: f.operator, column: f.column, value: f.value });
      default:
        throw new Error(`fakeSupabase: no in-memory evaluator for .${f.op}(); use a responder for table "${row && f.table}"`);
    }
  }

  function likeMatch(value, pattern, insensitive) {
    if (typeof value !== 'string') return false;
    const source = '^' + pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.') + '$';
    return new RegExp(source, insensitive ? 'i' : '').test(value);
  }

  const storageBucket = (bucket) => {
    buckets[bucket] ||= [];
    return {
      upload: jest.fn(async (path, body, opts) => {
        record({ table: `storage:${bucket}`, op: 'upload', path, size: body?.byteLength ?? body?.length ?? null, options: opts });
        if (buckets[bucket].some((o) => o.name === path) && !opts?.upsert) {
          return { data: null, error: { message: 'The resource already exists', statusCode: '409' } };
        }
        buckets[bucket].push({ name: path });
        return { data: { path }, error: null };
      }),
      getPublicUrl: jest.fn((path) => ({ data: { publicUrl: `https://fake.supabase.co/storage/v1/object/public/${bucket}/${path}` } })),
      remove: jest.fn(async (paths) => {
        record({ table: `storage:${bucket}`, op: 'remove', paths });
        buckets[bucket] = buckets[bucket].filter((o) => !paths.includes(o.name));
        return { data: paths.map((name) => ({ name })), error: null };
      }),
      list: jest.fn(async (prefix = '') => ({ data: buckets[bucket].filter((o) => o.name.startsWith(prefix)), error: null })),
      createSignedUrls: jest.fn(async (paths, expiresIn) => ({
        data: paths.map((path) => ({ path, signedUrl: `https://fake.supabase.co/storage/v1/object/sign/${bucket}/${path}?exp=${expiresIn}` })),
        error: null,
      })),
      createSignedUrl: jest.fn(async (path, expiresIn) => ({
        data: { signedUrl: `https://fake.supabase.co/storage/v1/object/sign/${bucket}/${path}?exp=${expiresIn}` },
        error: null,
      })),
    };
  };
  const bucketCache = {};

  const fake = {
    from: jest.fn((table) => builder(table)),
    rpc: jest.fn(async (name, args) => {
      const call = record({ table: `rpc:${name}`, op: 'rpc', args });
      const handler = rpcs[name];
      if (!handler) return { data: null, error: { message: `fakeSupabase: no rpc handler for "${name}"` } };
      const out = typeof handler === 'function' ? await handler(args, call) : handler;
      return out && typeof out === 'object' && 'error' in out ? out : { data: out, error: null };
    }),
    auth: {
      getUser: jest.fn(async () => (user ? { data: { user }, error: null } : { data: { user: null }, error: { message: 'Auth session missing!' } })),
      getSession: jest.fn(async () => ({ data: { session }, error: null })),
      onAuthStateChange: jest.fn((cb) => {
        authListeners.push(cb);
        return { data: { subscription: { unsubscribe: () => authListeners.splice(authListeners.indexOf(cb), 1) } } };
      }),
      signInWithPassword: jest.fn(async () => ({ data: { user, session }, error: null })),
      signUp: jest.fn(async () => ({ data: { user, session }, error: null })),
      signOut: jest.fn(async () => ({ error: null })),
      resetPasswordForEmail: jest.fn(async () => ({ data: {}, error: null })),
      updateUser: jest.fn(async () => ({ data: { user }, error: null })),
      setSession: jest.fn(async () => ({ data: { session }, error: null })),
      exchangeCodeForSession: jest.fn(async () => ({ data: { session }, error: null })),
    },
    functions: {
      invoke: jest.fn(async () => ({ data: null, error: null })),
    },
    storage: {
      from: jest.fn((bucket) => (bucketCache[bucket] ||= storageBucket(bucket))),
    },
    // Test-side controls.
    tables,
    buckets,
    calls,
    callsTo: (table) => calls.filter((c) => c.table === table),
    setUser(next) {
      user = next;
      session = next ? { user: next, access_token: 'token-1' } : null;
    },
    emitAuth(event, nextSession = session) {
      session = nextSession;
      user = nextSession?.user ?? null;
      authListeners.forEach((cb) => cb(event, nextSession));
    },
    respond(table, responder) { responders[table] = responder; },
    onRpc(name, handler) { rpcs[name] = handler; },
    /** Re-seed everything (tables, responders, rpc handlers, buckets, calls) for the next test. */
    reset(opts = {}) {
      seed(opts);
      if (opts.user !== undefined) fake.setUser(opts.user);
      jest.clearAllMocks();
    },
  };
  current = fake;
  return fake;
}
