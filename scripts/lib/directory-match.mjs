// scripts/lib/directory-match.mjs — pure helpers for matching directory rows
// to Google places (scripts/validate-winery-directory.mjs). No I/O, so the
// rules can be unit-tested (__tests__/directoryMatch.test.js).

// Words that say "winery" rather than which winery.
const GENERIC = new Set(['winery', 'wineries', 'vineyard', 'vineyards', 'cellar', 'cellars', 'estate', 'estates', 'wine', 'wines', 'tasting', 'room', 'farm', 'farms', 'the', 'at', 'of', 'and', 'inc', 'llc', 'co', 'company', 'family', 'winemakers', 'brewery', 'cidery', 'meadery']);
const tokens = (name) =>
  name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t && !GENERIC.has(t));
const editDistance = (a, b) => {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length][b.length];
};
const tokenMatch = (a, b) => a === b || (a.length >= 5 && b.length >= 5 && editDistance(a, b) <= 1);

/**
 * True when two winery names share enough distinctive words to be the same
 * place: at least half of the shorter name's distinctive words appear in
 * the other (one typo allowed per word), or one name has no distinctive
 * words at all (e.g. "The Winery"), in which case only distance decides.
 */
export function namesAgree(ours, theirs) {
  const a = tokens(ours);
  const b = tokens(theirs);
  if (!a.length || !b.length) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  const hits = short.filter((t) => long.some((u) => tokenMatch(t, u))).length;
  return hits / short.length >= 0.5;
}

export function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

