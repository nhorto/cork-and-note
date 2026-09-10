// Sequence tests for the AI request gate (launch plan §4.2, rev. 2026-09-09).
//
// __tests__/entitlements.test.js pins the individual parts; this file proves
// the caps hold IN PRACTICE. FakeUser is a miniature chat_usage table plus the
// exact three counts the edge function fetches (burst / per-task day / meter
// window), and every attempt runs the same read-then-append the production
// path runs: gateAiRequest() decides, and only an allowed call appends a row.
// So "a free user burns 3 scans, waits three months, is still walled" here is
// the same arithmetic the deployed function will do against Postgres.
import {
  BURST_LIMIT,
  FAIR_USE_DAILY_CAPS,
  FAIR_USE_MONTHLY_CHAT_CAP,
  FREE_METER_WINDOWS,
  FREE_TIER_LIMITS,
  PHOTO_CHAT_PRO_MESSAGE,
  gateAiRequest,
  needsWindowCount,
  normalizeTask,
  usageWindowStart,
  WEB_SEARCH_MAX_USES,
  WEB_SEARCH_TOOL_TYPE,
  webSearchToolsFor,
} from '../supabase/functions/_shared/entitlements.ts';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
// Mid-month, mid-day, so windows are exercised away from their boundaries.
const T0 = Date.UTC(2026, 8, 10, 15, 0, 0); // 2026-09-10T15:00:00Z

class FakeUser {
  constructor({ pro = false, entitlement } = {}) {
    this.rows = []; // { task, atMs } — the user's slice of chat_usage
    this.entitlement =
      entitlement !== undefined ? entitlement : pro ? { is_pro: true, expires_at: null } : null;
  }

  // The three counts chat/index.ts fetches, built from the same window
  // definitions (BURST window, rolling 24h per task, usageWindowStart per task).
  counts(task, nowMs) {
    const burstStart = nowMs - 5 * MIN;
    const dayStart = nowMs - DAY;
    const windowIso = usageWindowStart(task, nowMs);
    const windowStart = windowIso === null ? -Infinity : Date.parse(windowIso);
    return {
      burst: this.rows.filter((r) => r.atMs >= burstStart).length,
      day: this.rows.filter((r) => r.task === task && r.atMs >= dayStart).length,
      window: this.rows.filter((r) => r.task === task && r.atMs >= windowStart).length,
    };
  }

  attempt({ atMs, task = 'chat', hasImages = false }) {
    const normalized = normalizeTask(task);
    const verdict = gateAiRequest({
      nowMs: atMs,
      task,
      hasImages,
      entitlement: this.entitlement,
      counts: this.counts(normalized, atMs),
    });
    if (verdict.allowed) this.rows.push({ task: normalized, atMs });
    return verdict;
  }
}

// Spaced far enough apart that the burst cap never interferes with the cap
// actually under test.
const CALM = 6 * MIN;

describe('free tier: the 3 lifetime scans', () => {
  it('allows exactly 3 scans, ever — months passing changes nothing', () => {
    const user = new FakeUser();
    for (let i = 0; i < FREE_TIER_LIMITS.label_scan; i++) {
      expect(
        user.attempt({ atMs: T0 + i * CALM, task: 'label_scan', hasImages: true }).allowed
      ).toBe(true);
    }
    const fourth = user.attempt({ atMs: T0 + 3 * CALM, task: 'label_scan', hasImages: true });
    expect(fourth).toMatchObject({ allowed: false, status: 402 });
    expect(fourth.body.code).toBe('free_limit_reached');
    expect(fourth.body.meter).toMatchObject({ task: 'label_scan', remaining: 0, isPro: false });

    // Three months later the lifetime meter is still spent…
    const nextQuarter = user.attempt({ atMs: T0 + 90 * DAY, task: 'label_scan', hasImages: true });
    expect(nextQuarter).toMatchObject({ allowed: false, status: 402 });
    // …while chat, an untouched meter, still works.
    expect(user.attempt({ atMs: T0 + 90 * DAY + CALM }).allowed).toBe(true);
  });
});

describe('free tier: the 5 monthly chat messages', () => {
  it('allows 5 in a month, walls the 6th, and resets on the 1st', () => {
    const user = new FakeUser();
    for (let i = 0; i < FREE_TIER_LIMITS.chat; i++) {
      expect(user.attempt({ atMs: T0 + i * CALM }).allowed).toBe(true);
    }
    const sixth = user.attempt({ atMs: T0 + 5 * CALM });
    expect(sixth).toMatchObject({ allowed: false, status: 402 });
    expect(sixth.body.code).toBe('free_limit_reached');
    expect(sixth.body.error).toMatch(/sommelier messages/);

    // October 1st, 00:01 UTC: the calendar-month window has rolled over.
    const october = Date.UTC(2026, 9, 1, 0, 1, 0);
    expect(user.attempt({ atMs: october }).allowed).toBe(true);
  });

  it('does not let chat spending touch the scan meter, or vice versa', () => {
    const user = new FakeUser();
    for (let i = 0; i < FREE_TIER_LIMITS.chat; i++) {
      user.attempt({ atMs: T0 + i * CALM });
    }
    // Chat is spent; all 3 scans are still there.
    expect(
      user.attempt({ atMs: T0 + 5 * CALM, task: 'label_scan', hasImages: true }).allowed
    ).toBe(true);
  });

  it('sends an invented task to the chat meter, not a fresh allowance', () => {
    const user = new FakeUser();
    for (let i = 0; i < FREE_TIER_LIMITS.chat; i++) {
      expect(user.attempt({ atMs: T0 + i * CALM, task: 'totally_new_task' }).allowed).toBe(true);
    }
    const walled = user.attempt({ atMs: T0 + 5 * CALM, task: 'another_fake' });
    expect(walled).toMatchObject({ allowed: false, status: 402 });
    expect(walled.body.meter.task).toBe('chat');
  });
});

describe('free tier: chat is text-only', () => {
  it('refuses a photo in chat with the paywall, even on the very first message', () => {
    const user = new FakeUser();
    const verdict = user.attempt({ atMs: T0, hasImages: true });
    expect(verdict).toMatchObject({ allowed: false, status: 402 });
    expect(verdict.body.code).toBe('free_limit_reached');
    expect(verdict.body.error).toBe(PHOTO_CHAT_PRO_MESSAGE);
  });

  it('does not spend the meter on the refusal', () => {
    const user = new FakeUser();
    user.attempt({ atMs: T0, hasImages: true }); // refused, must cost nothing
    const next = user.attempt({ atMs: T0 + CALM });
    expect(next.allowed).toBe(true);
    // An allowed verdict reports the meter BEFORE this call is spent, so a
    // still-full allowance is the proof the photo refusal cost nothing.
    expect(next.meter.remaining).toBe(FREE_TIER_LIMITS.chat);
  });

  it('still allows photos on the scan task — that IS the scan', () => {
    const user = new FakeUser();
    expect(user.attempt({ atMs: T0, task: 'label_scan', hasImages: true }).allowed).toBe(true);
  });

  it('treats an expired Pro subscription as free: photos refused again', () => {
    const lapsed = new FakeUser({
      entitlement: { is_pro: true, expires_at: new Date(T0 - DAY).toISOString() },
    });
    expect(lapsed.attempt({ atMs: T0, hasImages: true })).toMatchObject({
      allowed: false,
      status: 402,
    });
  });
});

describe('Pro: daily fair-use caps', () => {
  it('allows 50 chats in a day and refuses the 51st with a 429, not a paywall', () => {
    const pro = new FakeUser({ pro: true });
    for (let i = 0; i < FAIR_USE_DAILY_CAPS.chat; i++) {
      expect(pro.attempt({ atMs: T0 + i * CALM, hasImages: i % 3 === 0 }).allowed).toBe(true);
    }
    const over = pro.attempt({ atMs: T0 + 50 * CALM });
    expect(over).toMatchObject({ allowed: false, status: 429 });
    expect(over.body.error).toMatch(/Daily fair-use/);
    expect(over.body.code).toBeUndefined(); // a 429 must never open the paywall

    // The cap is a ROLLING 24 hours, so it drains 24h after the day's last
    // call (T0 + ~5h), not at midnight. 30 hours out is comfortably clear.
    expect(pro.attempt({ atMs: T0 + 30 * HOUR }).allowed).toBe(true);
  });

  it('allows 30 scans a day, then 429, then a fresh 30 tomorrow — forever', () => {
    const pro = new FakeUser({ pro: true });
    // 40 maxed-out scanning sessions spaced 28h apart (a rolling-24h cap needs
    // the previous session fully drained), crossing a month boundary: scans
    // have no monthly ceiling, so every session's 30 must succeed.
    for (let day = 0; day < 40; day++) {
      const base = T0 + day * 28 * HOUR;
      for (let i = 0; i < FAIR_USE_DAILY_CAPS.label_scan; i++) {
        expect(
          pro.attempt({ atMs: base + i * CALM, task: 'label_scan', hasImages: true }).allowed
        ).toBe(true);
      }
      expect(
        pro.attempt({ atMs: base + 30 * CALM, task: 'label_scan', hasImages: true })
      ).toMatchObject({ allowed: false, status: 429 });
    }
  });

  it('caps chat and scans separately: a maxed scan day leaves chat open', () => {
    const pro = new FakeUser({ pro: true });
    for (let i = 0; i < FAIR_USE_DAILY_CAPS.label_scan; i++) {
      pro.attempt({ atMs: T0 + i * CALM, task: 'label_scan', hasImages: true });
    }
    expect(pro.attempt({ atMs: T0 + 31 * CALM }).allowed).toBe(true);
  });
});

describe('Pro: the 1,000/month chat ceiling', () => {
  it('holds across a scripted 50-a-day grind and resets with the calendar', () => {
    const pro = new FakeUser({ pro: true });
    const sept1 = Date.UTC(2026, 8, 1, 8, 0, 0);
    // Sessions 30h apart so the rolling daily cap is never the one refusing:
    // 20 sessions of 50 = exactly 1,000 allowed calls, all inside September.
    const SESSION = 30 * HOUR;

    for (let day = 0; day < 20; day++) {
      for (let i = 0; i < FAIR_USE_DAILY_CAPS.chat; i++) {
        expect(pro.attempt({ atMs: sept1 + day * SESSION + i * CALM }).allowed).toBe(true);
      }
    }
    expect(pro.rows.length).toBe(FAIR_USE_MONTHLY_CHAT_CAP);

    // Session 21, long past the last 24h window: the MONTHLY ceiling refuses.
    const day21 = sept1 + 20 * SESSION + 10 * HOUR;
    const ceiling = pro.attempt({ atMs: day21 });
    expect(ceiling).toMatchObject({ allowed: false, status: 429 });
    expect(ceiling.body.error).toMatch(/resets on the 1st/);

    // Scans are not caught in the chat ceiling.
    expect(pro.attempt({ atMs: day21 + CALM, task: 'label_scan', hasImages: true }).allowed).toBe(
      true
    );

    // October 1st: the ceiling lifts.
    expect(pro.attempt({ atMs: Date.UTC(2026, 9, 1, 0, 1, 0) }).allowed).toBe(true);
  });
});

describe('burst cap, any tier', () => {
  it('stops 15-in-5-minutes even for a Pro user, then recovers', () => {
    const pro = new FakeUser({ pro: true });
    for (let i = 0; i < BURST_LIMIT; i++) {
      expect(pro.attempt({ atMs: T0 + i * 10_000 }).allowed).toBe(true);
    }
    const burst = pro.attempt({ atMs: T0 + BURST_LIMIT * 10_000 });
    expect(burst).toMatchObject({ allowed: false, status: 429 });
    expect(burst.body.error).toMatch(/wait a few minutes/);

    // Six minutes after the last call the 5-minute window is empty again.
    expect(pro.attempt({ atMs: T0 + BURST_LIMIT * 10_000 + 6 * MIN }).allowed).toBe(true);
  });
});

describe('what the edge function may skip fetching', () => {
  it('never needs the window count for Pro scans, and the gate proves it', () => {
    expect(needsWindowCount(true, 'label_scan')).toBe(false);
    expect(needsWindowCount(true, 'chat')).toBe(true);
    expect(needsWindowCount(false, 'label_scan')).toBe(true);
    // Whatever garbage arrives in `window` for a Pro scan, the verdict stands.
    const verdict = gateAiRequest({
      nowMs: T0,
      task: 'label_scan',
      hasImages: true,
      entitlement: { is_pro: true, expires_at: null },
      counts: { burst: 0, day: 0, window: 999_999 },
    });
    expect(verdict.allowed).toBe(true);
  });

  it('maps meter windows to SQL exactly once: scans lifetime, chat monthly', () => {
    expect(usageWindowStart('label_scan', T0)).toBeNull();
    expect(usageWindowStart('chat', T0)).toBe('2026-09-01T00:00:00.000Z');
  });
});

describe('web search is a Pro tool, and only on chat', () => {
  const toolsFor = (isPro, task) => webSearchToolsFor({ isPro, task });

  it('gives a Pro chat exactly one bounded web_search tool', () => {
    const tools = toolsFor(true, 'chat');
    expect(tools).toEqual([
      { type: WEB_SEARCH_TOOL_TYPE, name: 'web_search', max_uses: WEB_SEARCH_MAX_USES },
    ]);
    // max_uses IS the per-message cost ceiling — if this ever creeps up, the
    // worst-case monthly bill in launch plan §4.2 creeps with it.
    expect(WEB_SEARCH_MAX_USES).toBe(2);
    // The dated tool version matters: the older type has no dynamic filtering
    // (more input tokens), and a wrong string is a 400 at runtime, not a typo
    // anything else would catch.
    expect(WEB_SEARCH_TOOL_TYPE).toBe('web_search_20260209');
  });

  it('gives a free user nothing, on either task', () => {
    expect(toolsFor(false, 'chat')).toEqual([]);
    expect(toolsFor(false, 'label_scan')).toEqual([]);
  });

  it('gives scans nothing even for Pro — they run on Haiku, which would 400', () => {
    expect(toolsFor(true, 'label_scan')).toEqual([]);
  });

  it('follows the entitlement the gate computed, not a claim from the client', () => {
    // The edge function passes gateAiRequest()'s own isPro into webSearchToolsFor,
    // so an expired subscription loses the tool on the same tick it loses Pro.
    const expired = { is_pro: true, expires_at: new Date(T0 - DAY).toISOString() };
    const verdict = gateAiRequest({
      nowMs: T0,
      task: 'chat',
      hasImages: false,
      entitlement: expired,
      counts: { burst: 0, day: 0, window: 0 },
    });
    expect(verdict.isPro).toBe(false);
    expect(toolsFor(verdict.isPro, verdict.task)).toEqual([]);

    // A live trial (is_pro with a future expiry) is Pro and does get to search.
    const trialing = { is_pro: true, expires_at: new Date(T0 + 2 * DAY).toISOString() };
    const trialVerdict = gateAiRequest({
      nowMs: T0,
      task: 'chat',
      hasImages: false,
      entitlement: trialing,
      counts: { burst: 0, day: 0, window: 0 },
    });
    expect(trialVerdict.isPro).toBe(true);
    expect(toolsFor(trialVerdict.isPro, trialVerdict.task)).toHaveLength(1);
  });

  it('cannot be talked into a search by an invented task name', () => {
    // normalizeTask folds anything unknown to 'chat', so a client sending
    // task:'label_scan ' or task:'search' gets the chat meter AND chat's tools —
    // never a cheaper meter with a paid tool attached.
    expect(toolsFor(true, normalizeTask('web_search'))).toHaveLength(1);
    expect(toolsFor(false, normalizeTask('web_search'))).toEqual([]);
    expect(toolsFor(true, normalizeTask('label_scan'))).toEqual([]);
  });

  it('never reaches a refused call at all: the gate returns before tools are built', () => {
    // A free user at their monthly wall is refused 402, so no request is ever
    // built and no search can be billed. Belt-and-braces on top of toolsFor().
    const free = new FakeUser();
    for (let i = 0; i < FREE_TIER_LIMITS.chat; i++) {
      expect(free.attempt({ atMs: T0 + i * MIN * 10 }).allowed).toBe(true);
    }
    const walled = free.attempt({ atMs: T0 + 60 * MIN });
    expect(walled).toMatchObject({ allowed: false, status: 402 });
    expect(toolsFor(walled.isPro, walled.task)).toEqual([]);
  });
});

describe('every metered task is actually capped', () => {
  // The regression this file exists to prevent, stated as a test rather than
  // left to a type annotation: jest does not typecheck, and this is the shape
  // of the bug that shipped. `tonights_pick` was added as a task while this
  // table was being rewritten on another branch, so it inherited NO daily cap —
  // and a missing cap fails OPEN, because `count >= undefined` is false.
  const TASKS = Object.keys(FREE_TIER_LIMITS);

  it.each(TASKS)('%s has a numeric daily fair-use cap', (task) => {
    expect(typeof FAIR_USE_DAILY_CAPS[task]).toBe('number');
    expect(FAIR_USE_DAILY_CAPS[task]).toBeGreaterThan(0);
  });

  it.each(TASKS)('%s has a meter window', (task) => {
    expect(['lifetime', 'month']).toContain(FREE_METER_WINDOWS[task]);
  });

  it('proves a missing cap would fail open, which is why the above matters', () => {
    // Not hypothetical — this is the exact arithmetic that let Tonight's Pick
    // run uncapped: an absent entry is `undefined`, and every comparison
    // against it is false, so the gate waves the call through.
    expect(1_000_000 >= undefined).toBe(false);
  });
});

describe("Tonight's Pick fair-use cap", () => {
  it('stops a Pro user at the daily cap and recovers on the rolling window', () => {
    const cap = FAIR_USE_DAILY_CAPS.tonights_pick;
    const pro = new FakeUser({ pro: true });

    // Spread across the day so the 15-in-5-minutes burst cap is not what stops
    // us — this must prove the DAILY cap fires, not the burst one.
    for (let i = 0; i < cap; i++) {
      const verdict = pro.attempt({ atMs: T0 + i * 30 * MIN, task: 'tonights_pick' });
      expect(verdict.allowed).toBe(true);
    }

    const walled = pro.attempt({ atMs: T0 + cap * 30 * MIN, task: 'tonights_pick' });
    expect(walled).toMatchObject({ allowed: false, status: 429 });
    expect(walled.body.error).toMatch(/fair-use/i);

    // 429 is a slow-down, never a sale: this must not open the paywall.
    expect(walled.body.code).toBeUndefined();

    // The window is rolling, so once the first batch ages out the next call lands.
    expect(
      pro.attempt({ atMs: T0 + 25 * HOUR, task: 'tonights_pick' }).allowed
    ).toBe(true);
  });

  it('does not spend, or get spent by, the chat meter', () => {
    // The two tasks are counted separately — grinding Tonight's Pick must not
    // consume the 50/day chat allowance or vice versa.
    const pro = new FakeUser({ pro: true });
    for (let i = 0; i < FAIR_USE_DAILY_CAPS.tonights_pick; i++) {
      pro.attempt({ atMs: T0 + i * 30 * MIN, task: 'tonights_pick' });
    }
    expect(pro.attempt({ atMs: T0 + 11 * HOUR, task: 'chat' }).allowed).toBe(true);
  });

  it('is Pro-only: a free user is refused before any cap is consulted', () => {
    const free = new FakeUser();
    const verdict = free.attempt({ atMs: T0, task: 'tonights_pick' });
    expect(verdict).toMatchObject({ allowed: false, status: 402 });
    expect(verdict.body.code).toBe('free_limit_reached');
  });
});
