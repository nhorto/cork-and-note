// lib/pro.js — the client's view of the Pro tier: the free-tier numbers, the
// wording of every "N left this month" hint, and a tiny bus so a completed AI
// call can refresh those hints without another round-trip.
//
// IMPORTANT: this is a MIRROR, not the gate. The enforcing copy of these limits
// lives in supabase/functions/_shared/entitlements.ts and runs on the server,
// because a client that can be edited must never be able to grant itself calls.
// __tests__/pro.test.js asserts the two copies still agree.

/** Free-tier monthly allowances by AI task (launch plan §4.2). */
export const FREE_MONTHLY_LIMITS = {
  label_scan: 3,
  chat: 5,
};

/** Free-tier cellar size (launch plan §4.2). */
export const FREE_CELLAR_BOTTLE_LIMIT = 25;

/** The RevenueCat entitlement identifier configured in the dashboard. */
export const PRO_ENTITLEMENT_ID = 'pro';

/** Hosted legal pages, required on the paywall by App Store guideline 3.1.2. */
export const TERMS_URL = 'https://cork-and-note.vercel.app/terms';
export const PRIVACY_URL = 'https://cork-and-note.vercel.app/privacy';

const plural = (n, one, many) => (n === 1 ? one : many);

/** Uses left in the current month, clamped — never negative, never over the limit. */
export function remainingFree(task, used) {
  const limit = FREE_MONTHLY_LIMITS[task];
  if (limit === undefined) return null;
  const spent = Number.isFinite(used) && used > 0 ? Math.floor(used) : 0;
  return Math.max(0, limit - spent);
}

/**
 * The one-line hint shown next to a metered action BEFORE it is tapped, so the
 * wall is never a surprise (launch plan §4.5 item 5). Pro users get null: an
 * unlimited feature should say nothing at all rather than boast.
 */
export function meterHint({ isPro, task, remaining }) {
  if (isPro) return null;
  if (remaining === null || remaining === undefined) return null;

  if (task === 'label_scan') {
    return remaining === 0
      ? 'No free scans left this month — Pro is unlimited'
      : `${remaining} free ${plural(remaining, 'scan', 'scans')} left this month`;
  }
  if (task === 'chat') {
    return remaining === 0
      ? 'No free sommelier messages left this month — Pro is unlimited'
      : `${remaining} free sommelier ${plural(remaining, 'message', 'messages')} left this month`;
  }
  return null;
}

/** The same idea for the cellar cap, which is counted in bottles, not calls. */
export function cellarHint({ isPro, bottleCount }) {
  if (isPro) return null;
  const used = Number.isFinite(bottleCount) && bottleCount > 0 ? Math.floor(bottleCount) : 0;
  const left = Math.max(0, FREE_CELLAR_BOTTLE_LIMIT - used);
  return left === 0
    ? `Your free cellar is full at ${FREE_CELLAR_BOTTLE_LIMIT} bottles — Pro is unlimited`
    : `${left} free ${plural(left, 'bottle', 'bottles')} left in your cellar`;
}

/**
 * Whether a free user may add `adding` more bottles.
 *
 * The count is bottles, not lots, because "up to 25 bottles" is what §4.2 says
 * and what a user reads. `adding` matters: a single lot with quantity 12 is
 * twelve bottles, and ignoring it would turn the cap into "unlimited, if you
 * type the number in the quantity field".
 */
export function canAddBottle({ isPro, bottleCount, adding = 1 }) {
  if (isPro) return true;
  const used = Number.isFinite(bottleCount) && bottleCount > 0 ? Math.floor(bottleCount) : 0;
  const n = Number.isFinite(adding) && adding > 0 ? Math.floor(adding) : 1;
  return used + n <= FREE_CELLAR_BOTTLE_LIMIT;
}

/**
 * Whether a thrown error is the server's paywall (HTTP 402), as opposed to a
 * network failure or an abuse rate-limit. Only this should open the paywall —
 * showing it for a dropped connection would be a lie about why they were stopped.
 */
export function isPaywallError(error) {
  return error?.code === 'free_limit_reached';
}

// ── Meter bus ──────────────────────────────────────────────────────────────
// Every AI response carries the meter it just spent. lib/ai.js publishes it here
// and the Pro provider subscribes, so hints stay accurate across all six AI
// features without any of them having to remember to refresh.

const meterListeners = new Set();

/** Subscribe to meter updates. Returns an unsubscribe function. */
export function onMeterUpdate(listener) {
  meterListeners.add(listener);
  return () => meterListeners.delete(listener);
}

/** Publish a meter from a server response. Ignores anything malformed. */
export function publishMeter(meter) {
  if (!meter || typeof meter.task !== 'string') return;
  for (const listener of meterListeners) {
    try {
      listener(meter);
    } catch (err) {
      console.warn('Meter listener failed:', err?.message);
    }
  }
}
