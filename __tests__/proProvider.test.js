// The real ProProvider and usePro, which every other test in the repo stubs.
// This is the code that decides what a free user is told they have left and
// when the paywall opens, so it runs here for real against the in-memory
// client with the store SDK mocked at lib/purchases.
import { act, create } from 'react-test-renderer';
import { ProProvider } from '../components/ProProvider';
import { usePro } from '../hooks/usePro';
import { supabase } from '../lib/supabase';
import * as purchases from '../lib/purchases';

jest.mock('../lib/supabase', () => ({ supabase: require('../test-utils/fakeSupabase').currentFake() }));
jest.mock('expo-router', () => {
  const mocks = require('../test-utils/mocks');
  const router = mocks.routerMock();
  return { ...mocks.expoRouterModule(router), __router: router };
});
const mockRouter = require('expo-router').__router;
jest.mock('../lib/purchases', () => ({
  purchasesAvailable: jest.fn(() => true),
  configurePurchases: jest.fn(async () => {}),
  identifyPurchaser: jest.fn(async () => {}),
  forgetPurchaser: jest.fn(async () => {}),
  fetchProStatus: jest.fn(async () => ({ isPro: false })),
  addProStatusListener: jest.fn(() => () => {}),
  restorePurchases: jest.fn(async () => ({ isPro: false, error: null })),
}));

const USER = { id: 'user-a' };
const FUTURE = new Date(Date.now() + 30 * 86_400_000).toISOString();
const PAST = new Date(Date.now() - 86_400_000).toISOString();
const thisMonth = new Date().toISOString();
const lastMonth = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 1, 15)).toISOString();

const usageRow = (task, created_at = thisMonth) => ({ user_id: USER.id, task, created_at });

let latest;
function Probe() {
  latest = usePro();
  return null;
}

const flush = async () => {
  for (let i = 0; i < 3; i++) await act(async () => { await Promise.resolve(); });
};

async function mount(userId = USER.id) {
  let tree;
  await act(async () => { tree = create(<ProProvider userId={userId}><Probe /></ProProvider>); });
  await flush();
  return tree;
}

beforeEach(() => {
  supabase.reset({ user: USER, tables: { entitlements: [], chat_usage: [] } });
  latest = null;
  purchases.fetchProStatus.mockResolvedValue({ isPro: false });
});

describe('who is Pro', () => {
  test('a fresh install with no entitlement row is free, and finishes loading', async () => {
    await mount();
    expect(latest.isLoading).toBe(false);
    expect(latest.isPro).toBe(false);
    expect(purchases.identifyPurchaser).toHaveBeenCalledWith(USER.id);
  });

  test.each([
    ['an active server row with a future expiry', { is_pro: true, expires_at: FUTURE }, true],
    ['a server row with no expiry', { is_pro: true, expires_at: null }, true],
    ['an expired server row the webhook never revoked', { is_pro: true, expires_at: PAST }, false],
    ['a revoked server row', { is_pro: false, expires_at: FUTURE }, false],
    ['a row with an unparseable expiry', { is_pro: true, expires_at: 'soon' }, false],
  ])('%s', async (_, row, expected) => {
    supabase.tables.entitlements.push({ user_id: USER.id, ...row });
    await mount();
    expect(latest.isPro).toBe(expected);
  });

  test("another user's entitlement row does not count", async () => {
    supabase.tables.entitlements.push({ user_id: 'user-b', is_pro: true, expires_at: null });
    await mount();
    expect(latest.isPro).toBe(false);
  });

  test('the store SDK saying Pro is enough on its own, for offline and pre-webhook moments', async () => {
    purchases.fetchProStatus.mockResolvedValue({ isPro: true });
    await mount();
    expect(latest.isPro).toBe(true);
    expect(latest.remaining('chat')).toBeNull();
  });

  test('a store status change while the app is open flips isPro live', async () => {
    let listener;
    purchases.addProStatusListener.mockImplementationOnce((cb) => { listener = cb; return () => {}; });
    await mount();
    expect(latest.isPro).toBe(false);
    await act(async () => listener({ isPro: true }));
    expect(latest.isPro).toBe(true);
    await act(async () => listener({ isPro: false }));
    expect(latest.isPro).toBe(false);
  });

  test('a signed-out provider is free, not loading, and forgets the purchaser', async () => {
    await mount(null);
    expect(latest).toEqual(expect.objectContaining({ isPro: false, isLoading: false }));
    expect(purchases.forgetPurchaser).toHaveBeenCalled();
    expect(purchases.identifyPurchaser).not.toHaveBeenCalled();
    expect(supabase.calls).toHaveLength(0);
  });
});

describe('free meters', () => {
  test('chat counts this month only; scans count for life', async () => {
    supabase.tables.chat_usage.push(
      usageRow('chat'), usageRow('chat'), usageRow('chat', lastMonth),
      usageRow('label_scan', lastMonth), usageRow('label_scan'),
    );
    await mount();
    expect(latest.usage.chat).toBe(2);
    expect(latest.usage.label_scan).toBe(2);
    expect(latest.remaining('chat')).toBe(3);
    expect(latest.remaining('label_scan')).toBe(1);
    const chatQuery = supabase.callsTo('chat_usage').find((c) => c.filters.some((f) => f.column === 'task' && f.value === 'chat'));
    expect(chatQuery.options).toEqual(expect.objectContaining({ count: 'exact', head: true }));
    expect(chatQuery.filters.map((f) => f.column)).toContain('created_at');
  });

  test('usage queries carry no user filter: row-level security is what scopes the count', async () => {
    // Pinned on purpose. The server counts the same way. If a user_id filter
    // is added here, update the RLS probe expectations too.
    await mount();
    for (const call of supabase.callsTo('chat_usage')) {
      expect(call.filters.map((f) => f.column)).not.toContain('user_id');
    }
  });

  test('an unreadable counter assumes the meter is spent, so the gate opens the paywall', async () => {
    supabase.respond('chat_usage', (q) => (q.filters.some((f) => f.value === 'chat') ? { data: null, error: { message: 'timeout' }, count: null } : undefined));
    await mount();
    expect(latest.remaining('chat')).toBe(0);
    expect(latest.remaining('label_scan')).toBe(3);
    let allowed;
    await act(async () => { allowed = latest.gate('chat'); });
    expect(allowed).toBe(false);
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/paywall', params: { source: 'chat' } });
  });

  test('the gate lets a free user through while they have headroom and blocks Pro-only tasks outright', async () => {
    await mount();
    expect(latest.gate('chat')).toBe(true);
    expect(latest.gate('label_scan')).toBe(true);
    expect(latest.gate('tonights_pick')).toBe(false);
    expect(mockRouter.push).toHaveBeenLastCalledWith({ pathname: '/paywall', params: { source: 'tonights_pick' } });
  });

  test('a meter reported by an AI response updates the hint without a query', async () => {
    const { publishMeter } = jest.requireActual('../lib/pro');
    await mount();
    const before = supabase.callsTo('chat_usage').length;
    await act(async () => publishMeter({ task: 'chat', used: 4, limit: 5, remaining: 1 }));
    expect(latest.remaining('chat')).toBe(1);
    expect(supabase.callsTo('chat_usage')).toHaveLength(before);
  });
});

describe('after a purchase', () => {
  test('onPurchased trusts the store at once and polls the server at 1s, 3s and 6s until the webhook lands', async () => {
    jest.useFakeTimers();
    try {
      await mount();
      expect(latest.isPro).toBe(false);
      let settled;
      await act(async () => { settled = latest.onPurchased(); });
      expect(latest.isPro).toBe(true); // store said so; the label flips immediately
      const reads = () => supabase.callsTo('entitlements').length;
      const atMount = reads();
      await act(async () => { await jest.advanceTimersByTimeAsync(1_000); });
      expect(reads()).toBe(atMount + 1);
      // The webhook writes the row between the first and second poll.
      supabase.tables.entitlements.push({ user_id: USER.id, is_pro: true, expires_at: FUTURE });
      await act(async () => { await jest.advanceTimersByTimeAsync(3_000); });
      expect(reads()).toBe(atMount + 2);
      await act(async () => { await jest.advanceTimersByTimeAsync(10_000); });
      expect(reads()).toBe(atMount + 2); // found it: no third poll
      await settled;
      expect(latest.isPro).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  test('a restore that finds nothing leaves the user free', async () => {
    await mount();
    let result;
    await act(async () => { result = await latest.restore(); });
    expect(result).toEqual({ isPro: false, error: null });
    expect(latest.isPro).toBe(false);
  });
});

test('a refresh that resolves after the user signed out does not leak their status into the next session', async () => {
  let release;
  supabase.respond('entitlements', () => new Promise((r) => { release = r; }));
  let tree;
  await act(async () => { tree = create(<ProProvider userId={USER.id}><Probe /></ProProvider>); });
  await flush();
  // User A's entitlement read is still out when they sign out.
  await act(async () => { tree.update(<ProProvider userId={null}><Probe /></ProProvider>); });
  await flush();
  expect(latest).toEqual(expect.objectContaining({ isPro: false, isLoading: false }));
  await act(async () => { release({ data: { is_pro: true, expires_at: null }, error: null }); });
  await flush();
  expect(latest.isPro).toBe(false);
});
