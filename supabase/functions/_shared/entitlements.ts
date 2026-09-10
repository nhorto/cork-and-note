// supabase/functions/_shared/entitlements.ts
// The Pro tier's decision logic, kept pure so it can be unit-tested outside Deno
// (see __tests__/entitlements.test.js) and reasoned about without a database.
//
// This file is the ENFORCING copy of the free-tier numbers. The client mirrors
// them in lib/pro.js purely to render "3 free scans left this month" hints; a
// test asserts the two agree. Nothing here reads the network or the clock —
// callers pass `nowMs` — because a gate that depends on ambient state is a gate
// nobody can test.

/** Free-tier allowances, by `chat_usage.task` (launch plan §4.2, rev. 2026-09-09).
 * tonights_pick is 0 on purpose: Tonight's Pick is Pro-only (owner decision
 * 2026-09-09 — the marketing site always said so; the code now agrees). */
export const FREE_TIER_LIMITS = {
  label_scan: 3,
  chat: 5,
  tonights_pick: 0,
} as const;

/** Every AI call is metered as exactly one of these. */
export type MeteredTask = keyof typeof FREE_TIER_LIMITS;

/** How a free meter counts: since the beginning, or since the 1st of the month. */
export type MeterWindow = "lifetime" | "month";

/**
 * The window each free meter counts over. Scans are LIFETIME — three to feel
 * the magic, then the wall, like Sommo's five — because a Haiku scan costs a
 * third of a cent and the reason to gate it is conversion, not cost. Chat
 * resets each calendar month because five-ever would starve the habit loop
 * that makes the sommelier worth paying for.
 *
 * Typed `Record<MeteredTask, …>` rather than inferred, so adding a task to
 * FREE_TIER_LIMITS FAILS TO COMPILE until this table covers it. That is not
 * decoration: `tonights_pick` was added as a task on 2026-09-09 and silently
 * missed both this table and FAIR_USE_DAILY_CAPS, which left Tonight's Pick
 * with no daily cap in production for a day (see that constant).
 */
export const FREE_METER_WINDOWS: Record<MeteredTask, MeterWindow> = {
  label_scan: "lifetime",
  chat: "month",
  // Free users get zero Tonight's Picks, so the window never decides anything —
  // "lifetime" is the honest description of an allowance of 0 forever.
  tonights_pick: "lifetime",
};

/** Free-tier cellar size. Enforced client-side; bottles cost us nothing to store. */
export const FREE_CELLAR_BOTTLE_LIMIT = 25;

/**
 * Fair-use caps, applied to EVERYONE including Pro (launch plan §4.2). "Unlimited"
 * is a marketing word for "more than a human wine journaler can use", not an
 * invitation to script us: 50 Sonnet chats/day is ~$18/month at absolute worst
 * against $8.49 net, and the monthly ceiling stops a bot that grinds every day.
 *
 * EVERY metered task must appear here. A missing entry does not fail loudly —
 * `counts.day >= undefined` is `false`, so the cap silently never fires. That is
 * exactly what happened to `tonights_pick` between 2026-09-09 and 2026-09-10:
 * the task was added to FREE_TIER_LIMITS by one branch while another was
 * rewriting this table, and the only thing still bounding it was the 15-per-5-
 * minute burst cap — about 4,300 calls a day. Hence the Record type: the
 * compiler now refuses a task that is not capped.
 */
export const FAIR_USE_DAILY_CAPS: Record<MeteredTask, number> = {
  chat: 50,
  label_scan: 30,
  // Tonight's Pick is one "what should I open?" an evening, and each call ships
  // the whole cellar to Sonnet (~1-2c). Twenty is far past any human evening
  // and still bounds a scripted grind at a few dollars a month.
  tonights_pick: 20,
};
export const FAIR_USE_MONTHLY_CHAT_CAP = 1_000;

/** Burst cap, any task, any tier: nobody types 15 sommelier questions in 5 minutes. */
export const BURST_WINDOW_MIN = 5;
export const BURST_LIMIT = 15;


/** The RevenueCat entitlement identifier configured in the dashboard. */
export const PRO_ENTITLEMENT_ID = "pro";

/**
 * Every AI call is metered as exactly one of these. An unknown or missing task
 * counts as `chat`, which is both the more expensive model and the stricter
 * meter — an unrecognised task must never buy a cheaper allowance.
 */
export function normalizeTask(task: unknown): MeteredTask {
  if (task === "label_scan") return "label_scan";
  if (task === "tonights_pick") return "tonights_pick";
  return "chat";
}

export type EntitlementRow = {
  is_pro?: boolean | null;
  expires_at?: string | null;
} | null | undefined;

/**
 * Whether a stored entitlement row still grants Pro at `nowMs`.
 *
 * `expires_at` is re-checked rather than trusted to be swept, because the only
 * thing that clears `is_pro` is a webhook, and webhooks can be missed. An
 * unparseable timestamp is treated as expired: we fail closed on paid features.
 */
export function isEntitlementActive(row: EntitlementRow, nowMs: number): boolean {
  if (!row || row.is_pro !== true) return false;
  if (row.expires_at === null || row.expires_at === undefined) return true;
  const expiresMs = Date.parse(row.expires_at);
  if (Number.isNaN(expiresMs)) return false;
  return expiresMs > nowMs;
}

/**
 * Start of the calendar month containing `nowMs`, as an ISO timestamp, in UTC.
 *
 * The meter is a calendar month rather than a rolling 30 days so "3 free scans
 * left this month" means what a user assumes it means. UTC (not device time)
 * keeps the server's answer identical for a user who travels.
 */
export function monthWindowStart(nowMs: number): string {
  const d = new Date(nowMs);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

export type MeterDecision = {
  allowed: boolean;
  isPro: boolean;
  task: MeteredTask;
  limit: number | null;
  used: number;
  /** Uses left in the meter's window; null when unlimited (Pro). */
  remaining: number | null;
  reason: "pro" | "within_free_allowance" | "free_limit_reached";
};

/**
 * The free-meter verdict for one AI call. `used` must already be counted over
 * the task's FREE_METER_WINDOWS window. Pro is unlimited here — the fair-use
 * caps in the chat function still apply to everyone.
 */
export function meterDecision(input: {
  isPro: boolean;
  task: unknown;
  used: number;
}): MeterDecision {
  const task = normalizeTask(input.task);
  const used = Number.isFinite(input.used) && input.used > 0 ? Math.floor(input.used) : 0;

  if (input.isPro) {
    return {
      allowed: true,
      isPro: true,
      task,
      limit: null,
      used,
      remaining: null,
      reason: "pro",
    };
  }

  const limit = FREE_TIER_LIMITS[task];
  const remaining = Math.max(0, limit - used);
  return {
    allowed: remaining > 0,
    isPro: false,
    task,
    limit,
    used,
    remaining,
    reason: remaining > 0 ? "within_free_allowance" : "free_limit_reached",
  };
}

/** User-facing copy for a spent meter, so the app and the API agree on wording. */
export function limitReachedMessage(task: MeteredTask): string {
  if (task === "label_scan") {
    return `You've used your ${FREE_TIER_LIMITS.label_scan} free scans. Upgrade to Pro for unlimited label and tasting-card scans.`;
  }
  if (task === "tonights_pick") {
    return "Tonight's Pick is part of Pro — upgrade and the sommelier will choose from your own cellar.";
  }
  return `You've used all ${FREE_TIER_LIMITS.chat} free sommelier messages this month. Upgrade to Pro for unlimited chat.`;
}

/**
 * Photo questions in chat are Pro-only: a free user who could attach a label
 * photo and ask "what's this?" would have scan-by-chat — on the expensive model.
 */
export const PHOTO_CHAT_PRO_MESSAGE =
  "Asking the sommelier about a photo is a Pro feature. Upgrade to Pro to send photos in chat.";

/**
 * Anthropic's server-side web search, which is what lets the sommelier answer
 * "what is the 2021 Octagon like?" from the actual world rather than from what
 * the model happens to remember about a 4,000-case Virginia producer.
 *
 * The dated `_20260209` type is the dynamic-filtering variant: Claude filters
 * results in a sandbox before they reach the context window, so a search costs
 * far fewer input tokens than the raw pages would. Do NOT also declare
 * `code_execution` alongside it — that sandbox is already running under the
 * hood, and a second one confuses the model.
 */
export const WEB_SEARCH_TOOL_TYPE = "web_search_20260209";

/**
 * Searches Claude may run per message. Each one bills $10/1,000 plus the
 * retrieved text as input tokens (~3-4c for a searched message vs ~1.2c for an
 * unsearched one), so this number IS the per-message cost ceiling. Two is
 * enough to look a wine up and check a second source; it is not enough for a
 * research binge on our dime.
 */
export const WEB_SEARCH_MAX_USES = 2;

export type ServerTool = {
  type: typeof WEB_SEARCH_TOOL_TYPE;
  name: "web_search";
  max_uses: number;
};

/**
 * The server tools one AI call may use. Empty is the common case — and the
 * important one, since an empty `tools` array is how a free user is kept off a
 * paid tool no matter what their client sends.
 *
 * Pro-only for two reasons: it caps our exposure to people who are paying us,
 * and "the sommelier can look the wine up" is a far better reason to subscribe
 * than a bigger message count.
 *
 * Scans are excluded on both tiers. They run on Haiku 4.5, which does not
 * support this tool version at all (the request would 400), and reading a label
 * off a photo needs no web access — the answer is in the picture.
 */
export function webSearchToolsFor(input: {
  isPro: boolean;
  task: MeteredTask;
}): ServerTool[] {
  if (!input.isPro || input.task !== "chat") return [];
  return [
    { type: WEB_SEARCH_TOOL_TYPE, name: "web_search", max_uses: WEB_SEARCH_MAX_USES },
  ];
}

// ── The whole request gate, as one pure function ───────────────────────────
// Everything above are the parts; this is the decision the chat function acts
// on. It exists so __tests__/ai-gates.test.js can walk realistic multi-day
// sequences (a free user burning scans across months, a Pro user grinding
// 50 chats a day) through the EXACT logic production runs — the edge function
// only fetches the counts and returns what this says.

/**
 * Start of the counting window for `task` at `nowMs`; null means lifetime —
 * count everything. This is the single place the meter windows become SQL:
 * the edge function and the client provider both build their `created_at`
 * filter from it, so neither can disagree with FREE_METER_WINDOWS.
 */
export function usageWindowStart(task: MeteredTask, nowMs: number): string | null {
  return FREE_METER_WINDOWS[task] === "month" ? monthWindowStart(nowMs) : null;
}

export type GateCounts = {
  /** Calls by this user, any task, in the last BURST_WINDOW_MIN minutes. */
  burst: number;
  /** Calls by this user, THIS task, in the last 24 hours. */
  day: number;
  /**
   * Calls by this user, THIS task, since usageWindowStart(task) — i.e. this
   * calendar month for chat, all time for scans. Only read when
   * `needsWindowCount` says so; pass 0 otherwise.
   */
  window: number;
};

/** Whether the caller must fetch `counts.window`. Pro scans need no count at all. */
export function needsWindowCount(isPro: boolean, task: MeteredTask): boolean {
  return !isPro || task === "chat";
}

export type GateVerdict =
  | { allowed: true; isPro: boolean; task: MeteredTask; meter: MeterDecision }
  | {
      allowed: false;
      isPro: boolean;
      task: MeteredTask;
      /** 402 opens the paywall in the app; 429 is "slow down", never a sale. */
      status: 402 | 429;
      body: {
        error: string;
        code?: "free_limit_reached";
        meter?: {
          task: MeteredTask;
          limit: number | null;
          used: number;
          remaining: number | null;
          isPro: boolean;
        };
      };
    };

/**
 * Decide one AI call. Checks run cheapest-lie-first: burst and daily fair-use
 * caps apply to everyone before any question of payment; then free chat is
 * refused photos (a label scan by the back door, on the dearer model); then the
 * free meter or Pro's monthly chat ceiling settles it.
 */
export function gateAiRequest(input: {
  nowMs: number;
  task: unknown;
  hasImages: boolean;
  entitlement: EntitlementRow;
  counts: GateCounts;
}): GateVerdict {
  const task = normalizeTask(input.task);
  const isPro = isEntitlementActive(input.entitlement, input.nowMs);
  const refuse = (
    status: 402 | 429,
    body: { error: string; code?: "free_limit_reached" }
  ): GateVerdict => ({ allowed: false, isPro, task, status, body });

  if (input.counts.burst >= BURST_LIMIT) {
    return refuse(429, {
      error: "Rate limit exceeded. Please wait a few minutes and try again.",
    });
  }
  if (input.counts.day >= FAIR_USE_DAILY_CAPS[task]) {
    return refuse(429, {
      error: "Daily fair-use limit reached. Please try again tomorrow.",
    });
  }

  if (!isPro && task === "chat" && input.hasImages) {
    return refuse(402, { error: PHOTO_CHAT_PRO_MESSAGE, code: "free_limit_reached" });
  }

  if (isPro && task === "chat" && input.counts.window >= FAIR_USE_MONTHLY_CHAT_CAP) {
    return refuse(429, {
      error:
        "You've reached this month's fair-use limit for the sommelier. It resets on the 1st.",
    });
  }

  const meter = meterDecision({ isPro, task, used: input.counts.window });
  if (!meter.allowed) {
    return {
      allowed: false,
      isPro,
      task,
      status: 402,
      body: {
        error: limitReachedMessage(task),
        code: "free_limit_reached",
        meter: {
          task: meter.task,
          limit: meter.limit,
          used: meter.used,
          remaining: meter.remaining,
          isPro: false,
        },
      },
    };
  }

  return { allowed: true, isPro, task, meter };
}

// ── RevenueCat webhook → entitlement rows ──────────────────────────────────

export type EntitlementUpdate = {
  user_id: string;
  is_pro: boolean;
  expires_at: string | null;
  source: string;
};

/**
 * Events that revoke outright. Everything else is decided by whether the `pro`
 * entitlement is present and unexpired, which is what makes CANCELLATION and
 * BILLING_ISSUE correct for free: both keep `expiration_at_ms` in the future
 * (auto-renew off, or a grace period) and the user stays Pro until it passes,
 * while a refund arrives as a CANCELLATION whose expiration is already behind us.
 */
const REVOKING_EVENT_TYPES = new Set(["EXPIRATION", "SUBSCRIPTION_PAUSED"]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * RevenueCat app user ids are only ours when we set them — `logIn(session.user.id)`
 * writes a Supabase UUID. Anonymous ids ($RCAnonymousID:…) belong to a device with
 * no signed-in account and have no row to write.
 */
export function isSupabaseUserId(id: unknown): id is string {
  return typeof id === "string" && UUID_RE.test(id);
}

function toIso(ms: unknown): string | null {
  return typeof ms === "number" && Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

/**
 * Translate one RevenueCat webhook body into the rows to upsert.
 *
 * Returns an array because TRANSFER touches every id the subscription moved off.
 * An empty array means "nothing to write" — an event for another entitlement, an
 * anonymous user, or a shape we do not recognise — never an implicit revoke.
 */
export function entitlementUpdatesFromEvent(
  body: unknown,
  nowMs: number
): EntitlementUpdate[] {
  const event = (body as { event?: Record<string, unknown> })?.event;
  if (!event || typeof event !== "object") return [];

  const type = typeof event.type === "string" ? event.type : "";
  const source =
    event.environment === "SANDBOX" ? "revenuecat_sandbox" : "revenuecat";

  // A subscription moved to another account: the account it left is no longer
  // entitled. The receiving account gets its own event with real dates.
  if (type === "TRANSFER") {
    const from = Array.isArray(event.transferred_from) ? event.transferred_from : [];
    return from
      .filter(isSupabaseUserId)
      .map((user_id) => ({ user_id, is_pro: false, expires_at: null, source }));
  }

  const userId = event.app_user_id;
  if (!isSupabaseUserId(userId)) return [];

  const entitlementIds = Array.isArray(event.entitlement_ids)
    ? event.entitlement_ids
    : typeof event.entitlement_id === "string"
      ? [event.entitlement_id]
      : [];
  if (!entitlementIds.includes(PRO_ENTITLEMENT_ID)) return [];

  const expiresAt = toIso(event.expiration_at_ms);
  const expiresMs = expiresAt === null ? null : Date.parse(expiresAt);
  const unexpired = expiresMs === null || expiresMs > nowMs;
  const isPro = !REVOKING_EVENT_TYPES.has(type) && unexpired;

  return [{ user_id: userId, is_pro: isPro, expires_at: expiresAt, source }];
}
