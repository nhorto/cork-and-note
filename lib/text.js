// lib/text.js: small text helpers shared by the guided tools.

/**
 * Replace em and en dashes in model prose with plain punctuation. The owner
 * keeps every user-facing string free of em dashes, and the sommelier's
 * replies are shown verbatim, so the rule has to be applied to them too.
 * A spaced dash becomes a comma; an unspaced one becomes a hyphen so
 * "2019-2021" style ranges survive.
 */
export function softenDashes(value) {
  if (typeof value !== 'string') return value;
  return value
    .replace(/\s+[—–]\s+/g, ', ')
    .replace(/[—–]/g, '-');
}
