// lib/wineDisplay.js
// Single source of truth for a tasted wine's display title.
//
// Rule (owner): if a wine has no explicit name, the VARIETAL becomes the name —
// e.g. a nameless "Prosecco / Sparkling" shows as "Prosecco", not "Sparkling
// Wine". Only when there's neither name nor varietal do we fall back to the
// type. Both the My Wines list and the Wine Detail screen call this so the
// title never drifts between them.
import { varietalText } from './varietals';

export function wineDisplayName(wine) {
  if (!wine) return 'Unnamed Wine';
  const name = wine.wine_name?.trim();
  // wine_varietal is a text[] (#135) — may also be a legacy string; varietalText
  // handles both and yields e.g. "Cabernet Sauvignon, Merlot".
  const varietal = varietalText(wine.wine_varietal);
  const type = wine.wine_type?.trim();
  return name || varietal || (type ? `${type} Wine` : 'Unnamed Wine');
}
