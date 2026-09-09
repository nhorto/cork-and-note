// Unit tests for lib/pro.js — the client's mirror of the Pro tier.
//
// The most valuable test in this file is the last one: lib/pro.js duplicates the
// free-tier numbers so the app can render "2 free scans left" without asking the
// server, and a silent drift between the two copies would show users a promise
// the server then refuses to keep.
import {
  FREE_CELLAR_BOTTLE_LIMIT,
  FREE_METER_WINDOWS,
  FREE_TIER_LIMITS,
  PRO_ENTITLEMENT_ID,
  canAddBottle,
  cellarHint,
  isPaywallError,
  meterHint,
  onMeterUpdate,
  packagePeriod,
  packagePriceLine,
  packageTrialLabel,
  publishMeter,
  remainingFree,
} from '../lib/pro';
import * as server from '../supabase/functions/_shared/entitlements.ts';

describe('remainingFree', () => {
  it('counts down and stops at zero', () => {
    expect(remainingFree('label_scan', 0)).toBe(3);
    expect(remainingFree('label_scan', 2)).toBe(1);
    expect(remainingFree('label_scan', 3)).toBe(0);
    expect(remainingFree('label_scan', 99)).toBe(0);
  });

  it('treats a missing or nonsense count as unused', () => {
    expect(remainingFree('chat', undefined)).toBe(5);
    expect(remainingFree('chat', NaN)).toBe(5);
    expect(remainingFree('chat', -3)).toBe(5);
  });

  it('has no opinion about tasks that are not metered', () => {
    expect(remainingFree('legacy', 1)).toBeNull();
  });
});

describe('meterHint', () => {
  it('says nothing at all to a Pro user', () => {
    // An unlimited feature should be quiet, not boast about being unlimited.
    expect(meterHint({ isPro: true, task: 'label_scan', remaining: 0 })).toBeNull();
  });

  it('warns before the wall, in the feature the user is looking at', () => {
    // Scans are a lifetime meter, so their hint must not promise a monthly reset.
    expect(meterHint({ isPro: false, task: 'label_scan', remaining: 3 })).toBe(
      '3 free scans left'
    );
    expect(meterHint({ isPro: false, task: 'chat', remaining: 5 })).toBe(
      '5 free sommelier messages left this month'
    );
  });

  it('gets the singular right, because "1 free scans left" reads as a bug', () => {
    expect(meterHint({ isPro: false, task: 'label_scan', remaining: 1 })).toBe(
      '1 free scan left'
    );
    expect(meterHint({ isPro: false, task: 'chat', remaining: 1 })).toBe(
      '1 free sommelier message left this month'
    );
  });

  it('names the way out once the meter is spent', () => {
    expect(meterHint({ isPro: false, task: 'label_scan', remaining: 0 })).toMatch(/Pro is unlimited/);
    expect(meterHint({ isPro: false, task: 'chat', remaining: 0 })).toMatch(/Pro is unlimited/);
  });

  it('renders nothing rather than a broken sentence when the count is unknown', () => {
    expect(meterHint({ isPro: false, task: 'chat', remaining: null })).toBeNull();
    expect(meterHint({ isPro: false, task: 'mystery', remaining: 2 })).toBeNull();
  });
});

describe('cellar cap', () => {
  it('lets a free user fill exactly 25 bottles and no more', () => {
    expect(canAddBottle({ isPro: false, bottleCount: 24 })).toBe(true);
    expect(canAddBottle({ isPro: false, bottleCount: 25 })).toBe(false);
    expect(canAddBottle({ isPro: false, bottleCount: 40 })).toBe(false);
  });

  it('counts the quantity being added, not just the lot', () => {
    // Otherwise the cap reads "unlimited, if you type a big number in Quantity".
    expect(canAddBottle({ isPro: false, bottleCount: 13, adding: 12 })).toBe(true);
    expect(canAddBottle({ isPro: false, bottleCount: 14, adding: 12 })).toBe(false);
    expect(canAddBottle({ isPro: false, bottleCount: 0, adding: 100 })).toBe(false);
    expect(canAddBottle({ isPro: true, bottleCount: 0, adding: 100 })).toBe(true);
  });

  it('treats a missing or nonsense quantity as one bottle', () => {
    expect(canAddBottle({ isPro: false, bottleCount: 24, adding: undefined })).toBe(true);
    expect(canAddBottle({ isPro: false, bottleCount: 24, adding: 0 })).toBe(true);
    expect(canAddBottle({ isPro: false, bottleCount: 25, adding: NaN })).toBe(false);
  });

  it('never caps a Pro cellar', () => {
    expect(canAddBottle({ isPro: true, bottleCount: 5000 })).toBe(true);
    expect(cellarHint({ isPro: true, bottleCount: 5000 })).toBeNull();
  });

  it('counts down the free cellar and says when it is full', () => {
    expect(cellarHint({ isPro: false, bottleCount: 0 })).toBe('25 free bottles left in your cellar');
    expect(cellarHint({ isPro: false, bottleCount: 24 })).toBe('1 free bottle left in your cellar');
    expect(cellarHint({ isPro: false, bottleCount: 25 })).toMatch(/full at 25 bottles/);
    // A cellar that somehow overshot the cap must still read as full, not negative.
    expect(cellarHint({ isPro: false, bottleCount: 30 })).toMatch(/full at 25 bottles/);
  });
});

describe('isPaywallError', () => {
  it('only recognises the server paywall, not any other failure', () => {
    // Opening the paywall on a dropped connection would lie about why we stopped.
    expect(isPaywallError({ code: 'free_limit_reached' })).toBe(true);
    expect(isPaywallError(new Error('Network request failed'))).toBe(false);
    expect(isPaywallError({ code: 'rate_limited' })).toBe(false);
    expect(isPaywallError(null)).toBe(false);
  });
});

describe('meter bus', () => {
  it('delivers meters to subscribers until they unsubscribe', () => {
    const seen = [];
    const stop = onMeterUpdate((m) => seen.push(m));
    publishMeter({ task: 'chat', used: 2, remaining: 3 });
    stop();
    publishMeter({ task: 'chat', used: 3, remaining: 2 });
    expect(seen).toEqual([{ task: 'chat', used: 2, remaining: 3 }]);
  });

  it('ignores malformed meters instead of pushing junk into the UI', () => {
    const seen = [];
    const stop = onMeterUpdate((m) => seen.push(m));
    publishMeter(undefined);
    publishMeter({});
    publishMeter({ task: 42 });
    stop();
    expect(seen).toEqual([]);
  });

  it('survives a listener that throws, so one bad screen cannot break the rest', () => {
    const seen = [];
    const stopBad = onMeterUpdate(() => {
      throw new Error('boom');
    });
    const stopGood = onMeterUpdate((m) => seen.push(m.task));
    publishMeter({ task: 'label_scan', used: 1 });
    stopBad();
    stopGood();
    expect(seen).toEqual(['label_scan']);
  });
});

describe('client mirror matches the server', () => {
  it('uses the same free allowances the edge function enforces', () => {
    // If this fails, the app is promising an allowance the server will refuse.
    expect(FREE_TIER_LIMITS).toEqual({ ...server.FREE_TIER_LIMITS });
    expect(FREE_METER_WINDOWS).toEqual({ ...server.FREE_METER_WINDOWS });
    expect(FREE_CELLAR_BOTTLE_LIMIT).toBe(server.FREE_CELLAR_BOTTLE_LIMIT);
    expect(PRO_ENTITLEMENT_ID).toBe(server.PRO_ENTITLEMENT_ID);
  });

  it('agrees with the server on whether a given call is allowed', () => {
    for (const task of Object.keys(FREE_TIER_LIMITS)) {
      for (let used = 0; used <= FREE_TIER_LIMITS[task] + 1; used++) {
        expect(remainingFree(task, used)).toBe(
          server.meterDecision({ isPro: false, task, used }).remaining
        );
      }
    }
  });
});


describe('store package helpers', () => {
  // The paywall labels and sorts plans from these, and the SDK spells the period
  // three different ways depending on where you read it. Getting this wrong once
  // labelled every plan "Monthly" and put the annual plan second.
  const annual = {
    identifier: '$rc_annual',
    packageType: 'ANNUAL',
    product: { priceString: '$59.99', subscriptionPeriod: 'P1Y' },
  };
  const monthly = {
    identifier: '$rc_monthly',
    packageType: 'MONTHLY',
    product: { priceString: '$9.99', subscriptionPeriod: 'P1M' },
  };

  it('reads the period from packageType, identifier or an ISO-8601 duration', () => {
    expect(packagePeriod(annual)).toBe('year');
    expect(packagePeriod(monthly)).toBe('month');
    expect(packagePeriod({ product: { subscriptionPeriod: 'P1Y' } })).toBe('year');
    expect(packagePeriod({ product: { subscriptionPeriod: 'P1M' } })).toBe('month');
    expect(packagePeriod({ identifier: '$rc_annual' })).toBe('year');
  });

  it('has no opinion about a package it cannot read', () => {
    expect(packagePeriod(null)).toBeNull();
    expect(packagePeriod({})).toBeNull();
    expect(packagePeriod({ packageType: 'LIFETIME' })).toBeNull();
  });

  it("shows the store's own localised price, never our own", () => {
    expect(packagePriceLine(annual)).toBe('$59.99 / year');
    expect(packagePriceLine(monthly)).toBe('$9.99 / month');
    // A euro price with an unreadable period still shows the price.
    expect(packagePriceLine({ product: { priceString: '59,99 €' } })).toBe('59,99 €');
    // No price at all renders nothing rather than "undefined / year".
    expect(packagePriceLine({ packageType: 'ANNUAL' })).toBeNull();
  });

  it('announces a free trial only when the store actually offers one', () => {
    expect(
      packageTrialLabel({
        product: { introPrice: { price: 0, periodNumberOfUnits: 7, periodUnit: 'DAY' } },
      })
    ).toBe('7-day free trial');
    // A paid intro offer is not a free trial and must not be sold as one.
    expect(
      packageTrialLabel({ product: { introPrice: { price: 4.99, periodNumberOfUnits: 1, periodUnit: 'MONTH' } } })
    ).toBeNull();
    expect(packageTrialLabel(monthly)).toBeNull();
    expect(packageTrialLabel(null)).toBeNull();
  });
});
