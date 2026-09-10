// lib/pro.js — the client's view of the Pro tier: the free-tier numbers, the
// wording of every "N left this month" hint, and a tiny bus so a completed AI
// call can refresh those hints without another round-trip.
//
// IMPORTANT: this is a MIRROR, not the gate. The enforcing copy of these limits
// lives in supabase/functions/_shared/entitlements.ts and runs on the server,
// because a client that can be edited must never be able to grant itself calls.
// __tests__/pro.test.js asserts the two copies still agree.

/** Free-tier allowances by AI task (launch plan §4.2, rev. 2026-09-09).
 * tonights_pick is 0: Pro-only (owner decision 2026-09-09), mirroring the
 * enforcing copy in supabase/functions/_shared/entitlements.ts. */
export const FREE_TIER_LIMITS = {
  label_scan: 3,
  chat: 5,
  tonights_pick: 0,
};

/** The window each free meter counts over: scans are lifetime, chat resets monthly. */
export const FREE_METER_WINDOWS = {
  label_scan: 'lifetime',
  chat: 'month',
};

/** Free-tier cellar size (launch plan §4.2). */
export const FREE_CELLAR_BOTTLE_LIMIT = 25;

/** The RevenueCat entitlement identifier configured in the dashboard. */
export const PRO_ENTITLEMENT_ID = 'pro';

/** Hosted legal pages, required on the paywall by App Store guideline 3.1.2. */
export const TERMS_URL = 'https://cork-and-note.vercel.app/terms';
export const PRIVACY_URL = 'https://cork-and-note.vercel.app/privacy';

const plural = (n, one, many) => (n === 1 ? one : many);

/** Uses left in the meter's window, clamped — never negative, never over the limit. */
export function remainingFree(task, used) {
  const limit = FREE_TIER_LIMITS[task];
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
    // Lifetime meter — never say "this month" about a count that won't reset.
    return remaining === 0
      ? 'No free scans left — Pro is unlimited'
      : `${remaining} free ${plural(remaining, 'scan', 'scans')} left`;
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


// ── Store package shapes ───────────────────────────────────────────────────
// The paywall renders StoreKit's own numbers rather than our own: a hardcoded
// "$9.99" is wrong in 174 of the 175 territories these products are live in.
// These read the shapes react-native-purchases hands back.

/** "$59.99 / year", from the store's own localised strings. */
export function packagePriceLine(pkg) {
  const product = pkg?.product;
  if (!product?.priceString) return null;
  const period = packagePeriod(pkg);
  return period ? `${product.priceString} / ${period}` : product.priceString;
}

export function packagePeriod(pkg) {
  // Three fields, because the SDK spells this three ways: packageType 'ANNUAL',
  // identifier '$rc_annual', and subscriptionPeriod as ISO-8601 'P1Y'. Matching
  // only one of them silently labels every plan "Monthly".
  const haystack = [pkg?.packageType, pkg?.identifier, pkg?.product?.subscriptionPeriod]
    .filter(Boolean)
    .join(' ');
  if (/ANNUAL|YEAR|P\d*Y/i.test(haystack)) return 'year';
  if (/MONTH|P\d*M/i.test(haystack)) return 'month';
  return null;
}

/** The intro offer, if the store says this product has one (the annual 3-day trial). */
export function packageTrialLabel(pkg) {
  const intro = pkg?.product?.introPrice;
  if (!intro || intro.price > 0) return null;
  const n = intro.periodNumberOfUnits;
  const unit = (intro.periodUnit || '').toLowerCase();
  if (!n || !unit) return 'Free trial';
  return `${n}-${unit} free trial`;
}
