// Unit tests for supabase/functions/_shared/entitlements.ts — the Pro tier's
// decision logic (launch plan §4.2/§4.5). The module is the enforcing copy of
// the free meters, so the invariants worth pinning are the ones that cost money
// or trust when they are wrong: a lapsed subscriber must lose Pro even if no
// webhook ever said so, an unknown task must not buy the cheaper allowance, and
// a webhook we do not understand must never silently revoke someone.
import {
  FAIR_USE_DAILY_CAPS,
  FAIR_USE_MONTHLY_CHAT_CAP,
  FREE_METER_WINDOWS,
  FREE_TIER_LIMITS,
  entitlementUpdatesFromEvent,
  isEntitlementActive,
  isSupabaseUserId,
  limitReachedMessage,
  meterDecision,
  monthWindowStart,
  normalizeTask,
} from '../supabase/functions/_shared/entitlements.ts';

const NOW = Date.UTC(2026, 8, 8, 12, 0, 0); // 2026-09-08T12:00:00Z
const USER = '11111111-2222-4333-8444-555555555555';
const OTHER_USER = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

const iso = (ms) => new Date(ms).toISOString();
const DAY = 24 * 60 * 60 * 1000;

describe('isEntitlementActive', () => {
  it('grants Pro while the paid period is still running', () => {
    expect(isEntitlementActive({ is_pro: true, expires_at: iso(NOW + DAY) }, NOW)).toBe(true);
  });

  it('revokes a subscription whose period ended, even though is_pro is still true', () => {
    // The whole reason expires_at is re-checked: the only thing that flips
    // is_pro is a webhook, and a missed webhook must not mean free forever.
    expect(isEntitlementActive({ is_pro: true, expires_at: iso(NOW - 1) }, NOW)).toBe(false);
  });

  it('treats a null expiry as a non-expiring grant', () => {
    expect(isEntitlementActive({ is_pro: true, expires_at: null }, NOW)).toBe(true);
  });

  it('fails closed on a missing row, is_pro false, or an unparseable expiry', () => {
    expect(isEntitlementActive(null, NOW)).toBe(false);
    expect(isEntitlementActive(undefined, NOW)).toBe(false);
    expect(isEntitlementActive({ is_pro: false, expires_at: iso(NOW + DAY) }, NOW)).toBe(false);
    expect(isEntitlementActive({ is_pro: true, expires_at: 'not a date' }, NOW)).toBe(false);
  });
});

describe('monthWindowStart', () => {
  it('returns the first instant of the containing calendar month in UTC', () => {
    expect(monthWindowStart(NOW)).toBe('2026-09-01T00:00:00.000Z');
  });

  it('is already at the boundary on the first of the month', () => {
    const first = Date.UTC(2026, 0, 1, 0, 0, 0);
    expect(monthWindowStart(first)).toBe('2026-01-01T00:00:00.000Z');
  });

  it('rolls over rather than sliding a 30-day window', () => {
    const augEnd = Date.UTC(2026, 7, 31, 23, 59, 59);
    const sepStart = Date.UTC(2026, 8, 1, 0, 0, 1);
    expect(monthWindowStart(augEnd)).toBe('2026-08-01T00:00:00.000Z');
    expect(monthWindowStart(sepStart)).toBe('2026-09-01T00:00:00.000Z');
  });
});

describe('normalizeTask', () => {
  it('recognises label_scan', () => {
    expect(normalizeTask('label_scan')).toBe('label_scan');
  });

  it('recognises tonights_pick', () => {
    expect(normalizeTask('tonights_pick')).toBe('tonights_pick');
  });

  it('sends anything unrecognised to the stricter chat meter', () => {
    // A client that invents a task must not thereby buy the larger allowance.
    for (const task of ['chat', 'scan', '', null, undefined, 42, { task: 'chat' }]) {
      expect(normalizeTask(task)).toBe('chat');
    }
  });
});

describe('meterDecision', () => {
  it('gives Pro unlimited use of both meters', () => {
    const d = meterDecision({ isPro: true, task: 'label_scan', used: 999 });
    expect(d).toMatchObject({ allowed: true, limit: null, remaining: null, reason: 'pro' });
  });

  it('counts down the free scan allowance and then blocks', () => {
    expect(meterDecision({ isPro: false, task: 'label_scan', used: 0 }).remaining).toBe(3);
    expect(meterDecision({ isPro: false, task: 'label_scan', used: 2 })).toMatchObject({
      allowed: true,
      remaining: 1,
      reason: 'within_free_allowance',
    });
    expect(meterDecision({ isPro: false, task: 'label_scan', used: 3 })).toMatchObject({
      allowed: false,
      remaining: 0,
      reason: 'free_limit_reached',
    });
  });

  it('meters sommelier chat separately from scans', () => {
    // Five scans must not spend the chat allowance, and vice versa.
    expect(meterDecision({ isPro: false, task: 'chat', used: 4 }).allowed).toBe(true);
    expect(meterDecision({ isPro: false, task: 'chat', used: 5 }).allowed).toBe(false);
    expect(FREE_TIER_LIMITS.chat).not.toBe(FREE_TIER_LIMITS.label_scan);
  });

  it('spends scans for life but chat only for the month (rev. 2026-09-09)', () => {
    // The window is what the caller counts over; pinning it here stops a
    // refactor from quietly turning "3 scans to try" back into 36 a year.
    expect(FREE_METER_WINDOWS.label_scan).toBe('lifetime');
    expect(FREE_METER_WINDOWS.chat).toBe('month');
  });

  it('never reports negative remaining when usage overshot the limit', () => {
    expect(meterDecision({ isPro: false, task: 'chat', used: 99 }).remaining).toBe(0);
  });

  it('treats a nonsense usage count as zero rather than as unlimited', () => {
    expect(meterDecision({ isPro: false, task: 'chat', used: NaN }).used).toBe(0);
    expect(meterDecision({ isPro: false, task: 'chat', used: -5 }).used).toBe(0);
  });

  it('names the right feature in the wall copy', () => {
    expect(limitReachedMessage('label_scan')).toMatch(/scans/);
    expect(limitReachedMessage('chat')).toMatch(/sommelier messages/);
    expect(limitReachedMessage('tonights_pick')).toMatch(/Tonight's Pick/);
  });

  it("blocks Tonight's Pick for free users at any usage — it is Pro-only", () => {
    // Owner decision 2026-09-09: the site said Pro-only; the meter now agrees.
    expect(meterDecision({ isPro: false, task: 'tonights_pick', used: 0 })).toMatchObject({
      allowed: false,
      limit: 0,
      remaining: 0,
      reason: 'free_limit_reached',
    });
    expect(meterDecision({ isPro: true, task: 'tonights_pick', used: 0 }).allowed).toBe(true);
  });

  it('never says "this month" about the lifetime scan meter', () => {
    expect(limitReachedMessage('label_scan')).not.toMatch(/this month/);
    expect(limitReachedMessage('chat')).toMatch(/this month/);
  });
});

describe('fair-use caps', () => {
  it('keeps the worst-case Pro abuser under control (§4.2 rev. 2026-09-09)', () => {
    // ~50 Sonnet chats/day ≈ $18/month at absolute worst against $8.49 net,
    // and the monthly ceiling stops a scripted grind. These are abuse guards:
    // a human wine journaler never sees them.
    expect(FAIR_USE_DAILY_CAPS.chat).toBe(50);
    expect(FAIR_USE_DAILY_CAPS.label_scan).toBe(30);
    expect(FAIR_USE_MONTHLY_CHAT_CAP).toBe(1000);
    // The daily caps must genuinely bound the month for every task.
    expect(FAIR_USE_DAILY_CAPS.chat * 31).toBeGreaterThan(FAIR_USE_MONTHLY_CHAT_CAP);
  });
});

describe('entitlementUpdatesFromEvent', () => {
  const event = (overrides) => ({
    event: {
      type: 'INITIAL_PURCHASE',
      app_user_id: USER,
      entitlement_ids: ['pro'],
      expiration_at_ms: NOW + 30 * DAY,
      environment: 'PRODUCTION',
      ...overrides,
    },
  });

  it('grants Pro on a purchase and records the period end', () => {
    expect(entitlementUpdatesFromEvent(event(), NOW)).toEqual([
      {
        user_id: USER,
        is_pro: true,
        expires_at: iso(NOW + 30 * DAY),
        source: 'revenuecat',
      },
    ]);
  });

  it('keeps Pro through a cancellation until the paid period actually ends', () => {
    // Auto-renew off is not "no longer a subscriber" — they paid for this month.
    const [update] = entitlementUpdatesFromEvent(event({ type: 'CANCELLATION' }), NOW);
    expect(update.is_pro).toBe(true);
  });

  it('revokes on a refund, which arrives as a cancellation already expired', () => {
    const [update] = entitlementUpdatesFromEvent(
      event({ type: 'CANCELLATION', expiration_at_ms: NOW - DAY }),
      NOW
    );
    expect(update.is_pro).toBe(false);
  });

  it('revokes on expiration and on a paused subscription', () => {
    for (const type of ['EXPIRATION', 'SUBSCRIPTION_PAUSED']) {
      const [update] = entitlementUpdatesFromEvent(event({ type }), NOW);
      expect(update.is_pro).toBe(false);
    }
  });

  it('keeps Pro during a billing-issue grace period', () => {
    const [update] = entitlementUpdatesFromEvent(
      event({ type: 'BILLING_ISSUE', expiration_at_ms: NOW + 3 * DAY }),
      NOW
    );
    expect(update.is_pro).toBe(true);
  });

  it('revokes only the accounts a transfer moved the subscription away from', () => {
    const updates = entitlementUpdatesFromEvent(
      {
        event: {
          type: 'TRANSFER',
          transferred_from: [USER, '$RCAnonymousID:abc'],
          transferred_to: [OTHER_USER],
          environment: 'PRODUCTION',
        },
      },
      NOW
    );
    expect(updates).toEqual([
      { user_id: USER, is_pro: false, expires_at: null, source: 'revenuecat' },
    ]);
  });

  it('ignores events for other entitlements, anonymous users, and junk bodies', () => {
    // "Nothing to write" must never be expressed as a revoke.
    expect(entitlementUpdatesFromEvent(event({ entitlement_ids: ['plus'] }), NOW)).toEqual([]);
    expect(entitlementUpdatesFromEvent(event({ app_user_id: '$RCAnonymousID:xyz' }), NOW)).toEqual([]);
    expect(entitlementUpdatesFromEvent({}, NOW)).toEqual([]);
    expect(entitlementUpdatesFromEvent(null, NOW)).toEqual([]);
    expect(entitlementUpdatesFromEvent({ event: 'nope' }, NOW)).toEqual([]);
  });

  it('accepts the deprecated singular entitlement_id field', () => {
    const [update] = entitlementUpdatesFromEvent(
      { event: { ...event().event, entitlement_ids: undefined, entitlement_id: 'pro' } },
      NOW
    );
    expect(update.is_pro).toBe(true);
  });

  it('marks sandbox purchases so TestFlight grants are distinguishable', () => {
    const [update] = entitlementUpdatesFromEvent(event({ environment: 'SANDBOX' }), NOW);
    expect(update).toMatchObject({ is_pro: true, source: 'revenuecat_sandbox' });
  });

  it('treats a non-renewing grant with no expiry as open-ended', () => {
    const [update] = entitlementUpdatesFromEvent(
      event({ type: 'NON_RENEWING_PURCHASE', expiration_at_ms: undefined }),
      NOW
    );
    expect(update).toMatchObject({ is_pro: true, expires_at: null });
  });
});

describe('isSupabaseUserId', () => {
  it('accepts a UUID and rejects RevenueCat anonymous ids', () => {
    expect(isSupabaseUserId(USER)).toBe(true);
    expect(isSupabaseUserId('$RCAnonymousID:5aa4b0e0')).toBe(false);
    expect(isSupabaseUserId('')).toBe(false);
    expect(isSupabaseUserId(null)).toBe(false);
  });
});
