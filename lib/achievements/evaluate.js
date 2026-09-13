// lib/achievements/evaluate.js — facts in, the whole Wine Journey out (#295).
//
// Pure. Everything a screen needs to draw the Achievements screen comes out of
// one call, and so does the list of rows the service has to insert.
//
// Two invariants that decide most of the design:
//   1. Badges are never revoked. Deleting a visit lowers a count, so a family
//      might display a lower tier than a row you hold, but the row stays and so
//      do its points.
//   2. Points come from earned ROWS, never from live counts. That is why
//      `points` sums over earned rows (existing plus newly earned) instead of
//      recomputing from the catalog against current facts.
import {
  FAMILIES,
  GRAPES,
  GRAPE_THRESHOLDS,
  GRAPE_TIERS,
  GRAPE_TIER_LABEL,
  GRAPE_TIER_POINTS,
  ONE_OFFS,
  TIERS,
  TIER_LABEL,
  TIER_POINTS,
  grapeBadgeKey,
  levelForPoints,
} from './catalog';

// A stored row identifies itself by badge_key plus tier (null for one-offs).
const rowKey = (badgeKey, tier) => `${badgeKey}|${tier ?? ''}`;

// Highest threshold index reached, or -1 for none yet.
function reachedIndex(count, thresholds) {
  let index = -1;
  for (let i = 0; i < thresholds.length; i += 1) {
    if (count >= thresholds[i]) index = i;
  }
  return index;
}

// How far along the current stretch you are, 0 to 1. Full when the top tier is
// reached, so a maxed family shows a complete ring rather than an empty one.
function progressTo(count, thresholds, index) {
  if (index >= thresholds.length - 1) return 1;
  const floor = index < 0 ? 0 : thresholds[index];
  const ceiling = thresholds[index + 1];
  if (ceiling <= floor) return 1;
  return Math.max(0, Math.min(1, (count - floor) / (ceiling - floor)));
}

/**
 * @param facts   buildFacts(...) output
 * @param earned  rows already in user_achievements: { badge_key, tier, points }
 */
export function evaluate(facts = {}, earned = []) {
  const earnedRows = Array.isArray(earned) ? earned : [];
  const held = new Set(earnedRows.map((r) => rowKey(r.badge_key, r.tier)));
  const newlyEarned = [];

  // Record a badge the facts say is earned. Returns nothing; the caller keeps
  // its own display state.
  const award = ({ badgeKey, tier, points, name, label, icon }) => {
    if (held.has(rowKey(badgeKey, tier))) return;
    held.add(rowKey(badgeKey, tier));
    newlyEarned.push({ badge_key: badgeKey, tier: tier ?? null, points, name, label, icon });
  };

  const families = FAMILIES.map((family) => {
    const count = Number(facts[family.metric]) || 0;
    const index = reachedIndex(count, family.thresholds);

    // Every tier at or below the one reached is earned, so a user who imports a
    // full journal collects Bronze through Gold in one go rather than being
    // drip-fed one tier per log.
    for (let i = 0; i <= index; i += 1) {
      const tier = TIERS[i];
      award({
        badgeKey: family.key,
        tier,
        points: TIER_POINTS[tier],
        name: family.name,
        label: `${family.name}, ${TIER_LABEL[tier]}`,
        icon: family.icon,
      });
    }

    return {
      key: family.key,
      name: family.name,
      icon: family.icon,
      unit: family.unit,
      rule: family.rule,
      thresholds: family.thresholds,
      count,
      tierIndex: index,
      tier: index >= 0 ? TIERS[index] : null,
      tierLabel: index >= 0 ? TIER_LABEL[TIERS[index]] : null,
      nextThreshold: index < family.thresholds.length - 1 ? family.thresholds[index + 1] : null,
      nextTier: index < TIERS.length - 1 ? TIERS[index + 1] : null,
      progress: progressTo(count, family.thresholds, index),
    };
  });

  const varietalCounts = facts.varietalCounts instanceof Map
    ? facts.varietalCounts
    : new Map(Object.entries(facts.varietalCounts || {}));

  const grapes = [];
  for (const grape of GRAPES) {
    const count = Number(varietalCounts.get(grape.key)) || 0;
    const index = reachedIndex(count, GRAPE_THRESHOLDS);
    const badgeKey = grapeBadgeKey(grape.key);

    for (let i = 0; i <= index; i += 1) {
      const tier = GRAPE_TIERS[i];
      award({
        badgeKey,
        tier,
        points: GRAPE_TIER_POINTS[tier],
        name: grape.key,
        label: `${grape.key} ${GRAPE_TIER_LABEL[tier]}`,
        icon: 'fruit-grapes',
      });
    }

    grapes.push({
      key: badgeKey,
      grape: grape.key,
      name: index >= 0 ? `${grape.key} ${GRAPE_TIER_LABEL[GRAPE_TIERS[index]]}` : grape.key,
      count,
      thresholds: GRAPE_THRESHOLDS,
      tier: index >= 0 ? GRAPE_TIERS[index] : null,
      tierLabel: index >= 0 ? GRAPE_TIER_LABEL[GRAPE_TIERS[index]] : null,
      nextThreshold: index < GRAPE_THRESHOLDS.length - 1 ? GRAPE_THRESHOLDS[index + 1] : null,
      nextTier: index < GRAPE_TIERS.length - 1 ? GRAPE_TIERS[index + 1] : null,
      progress: progressTo(count, GRAPE_THRESHOLDS, index),
    });
  }

  const oneOffs = ONE_OFFS.map((badge) => {
    let passes = false;
    try {
      passes = Boolean(badge.test(facts));
    } catch {
      passes = false; // a fact the catalog expects is missing; never crash a screen
    }
    if (passes) {
      award({
        badgeKey: badge.key,
        tier: null,
        points: badge.points,
        name: badge.name,
        label: badge.name,
        icon: badge.icon,
      });
    }
    // Already held counts as earned even if the facts no longer say so.
    const alreadyHeld = earnedRows.some((r) => r.badge_key === badge.key);
    return {
      key: badge.key,
      shelf: badge.shelf,
      name: badge.name,
      icon: badge.icon,
      rule: badge.rule,
      points: badge.points,
      earned: passes || alreadyHeld,
    };
  });

  const points =
    earnedRows.reduce((sum, r) => sum + (Number(r.points) || 0), 0) +
    newlyEarned.reduce((sum, r) => sum + (Number(r.points) || 0), 0);

  return {
    families,
    // Only grapes you have actually tasted are worth showing; the rest would be
    // eighteen empty rows. newlyEarned above already covered every grape.
    grapes: grapes.filter((g) => g.count > 0),
    allGrapes: grapes,
    oneOffs,
    newlyEarned,
    points,
    level: levelForPoints(points),
    badgeCount: held.size,
  };
}
