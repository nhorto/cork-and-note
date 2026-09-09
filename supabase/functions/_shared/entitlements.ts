// supabase/functions/_shared/entitlements.ts
// The Pro tier's decision logic, kept pure so it can be unit-tested outside Deno
// (see __tests__/entitlements.test.js) and reasoned about without a database.
//
// This file is the ENFORCING copy of the free-tier numbers. The client mirrors
// them in lib/pro.js purely to render "3 free scans left this month" hints; a
// test asserts the two agree. Nothing here reads the network or the clock —
// callers pass `nowMs` — because a gate that depends on ambient state is a gate
// nobody can test.

/** Free-tier monthly allowances, by `chat_usage.task` (launch plan §4.2).
 * tonights_pick is 0 on purpose: Tonight's Pick is Pro-only (owner decision
 * 2026-09-09 — the marketing site always said so; the code now agrees). */
export const FREE_MONTHLY_LIMITS = {
  label_scan: 3,
  chat: 5,
  tonights_pick: 0,
} as const;

/** Free-tier cellar size. Enforced client-side; bottles cost us nothing to store. */
export const FREE_CELLAR_BOTTLE_LIMIT = 25;

export type MeteredTask = keyof typeof FREE_MONTHLY_LIMITS;

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
  /** Uses left in the current month; null when unlimited (Pro). */
  remaining: number | null;
  reason: "pro" | "within_free_allowance" | "free_limit_reached";
};

/**
 * The free-meter verdict for one AI call. Pro is unlimited here — the separate
 * abuse caps in the chat function (15/5min, 150/day) still apply to everyone.
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

  const limit = FREE_MONTHLY_LIMITS[task];
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
    return `You've used all ${FREE_MONTHLY_LIMITS.label_scan} free scans this month. Upgrade to Pro for unlimited label and tasting-card scans.`;
  }
  if (task === "tonights_pick") {
    return "Tonight's Pick is part of Pro — upgrade and the sommelier will choose from your own cellar.";
  }
  return `You've used all ${FREE_MONTHLY_LIMITS.chat} free sommelier messages this month. Upgrade to Pro for unlimited chat.`;
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
