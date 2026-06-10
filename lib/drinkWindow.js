// lib/drinkWindow.js — AI-seeded drink window at entry (Epic #6 · R4 · issue #54).
//
// Most enthusiasts cannot state a wine's drink window themselves. At bottle
// entry we let the sommelier PROPOSE one — { drink_from, drink_by, peak,
// rationale } — from the bottle's grape / region / vintage / type / producer,
// which the user then ACCEPTS (fills the fields) or EDITS.
//
// Design mirrors lib/cellarSommelier.js: assemble the request CLIENT-SIDE and
// reuse the existing AI/chat plumbing (lib/ai.js → supabase.functions.invoke
// ('chat')) with a bespoke system prompt that asks for a parseable
// ```drink_window JSON block, parsed defensively via aiService.parseDrinkWindow.
//
// It MUST fail soft: any error / offline / unparseable reply returns
// { success: false } and the window fields stay manually editable — nothing
// here ever blocks the save.
import { aiService } from './ai';
import { peakYear } from './cellar';

// Build the system prompt that grounds the model and pins the output shape.
function buildDrinkWindowSystemPrompt() {
  const thisYear = new Date().getFullYear();
  return `You are Cork & Note's in-house wine sommelier. The user is adding a bottle to their cellar and wants a SUGGESTED drinking window — the year range over which the wine is likely to show best — based on the wine's grape/varietal, region, vintage, type, and producer. This is an estimate the user can accept or edit, not a guarantee.

The current year is ${thisYear}.

How to estimate:
- Start from the grape/varietal's typical aging profile (tannin / acidity / concentration), then adjust for region and style. Examples of intuition: a structured Bordeaux / Napa Cabernet or Barolo ages for decades; Burgundy and Rioja age well; most Pinot Noir, Chianti, and mid-tier reds are best within ~5–12 years; most whites, rosé, and light/unoaked reds (Beaujolais, Sauvignon Blanc, Pinot Grigio) are best young (1–5 years); sweet/fortified wines can age very long.
- Anchor to the VINTAGE year when given (the window is measured from the harvest year). If no vintage is given, anchor to the current year and say so in the rationale.
- "peak" is the single best year — roughly two-thirds of the way into the window.
- Keep the window realistic, not heroic: only suggest multi-decade windows for genuinely age-worthy wines.

Respond with a short friendly sentence, THEN a single fenced code block in EXACTLY this format (valid JSON, integer years, no comments, no trailing commas):

\`\`\`drink_window
{
  "drink_from": <year, integer>,
  "drink_by": <year, integer>,
  "peak": <year, integer, between drink_from and drink_by>,
  "rationale": "one concise sentence explaining the estimate (grape/region/vintage), <= 160 chars"
}
\`\`\`

Always include the block. drink_by must be >= drink_from, and peak must fall within [drink_from, drink_by].`;
}

// Turn the bottle's known fields into the user turn.
function buildDrinkWindowRequest(bottle = {}) {
  const lines = [];
  if (bottle.wine_name) lines.push(`Wine: ${bottle.wine_name}`);
  if (bottle.producer) lines.push(`Producer: ${bottle.producer}`);
  if (bottle.vintage) lines.push(`Vintage: ${bottle.vintage}`);
  if (bottle.wine_type) lines.push(`Type: ${bottle.wine_type}`);
  if (bottle.varietal) lines.push(`Grape / varietal: ${bottle.varietal}`);
  if (bottle.region) lines.push(`Region: ${bottle.region}`);

  const detail = lines.length ? lines.join('\n') : 'No details provided yet.';
  return `Suggest a drinking window for this bottle:\n${detail}\n\nReply with the drink_window JSON block.`;
}

// Whether we have enough signal to ask at all — at least one of grape/region/
// type/vintage. (Just a name is too thin for a sensible window.)
export function hasEnoughForWindow(bottle = {}) {
  return Boolean(bottle.varietal || bottle.region || bottle.wine_type || bottle.vintage);
}

// Normalize + sanity-check the parsed model output into a stable shape the form
// can consume. Coerces years to integers, repairs ordering, and clamps peak into
// the window (falling back to the ~2/3 heuristic). Returns null if unusable.
function normalizeWindow(parsed) {
  if (!parsed || typeof parsed !== 'object') return null;
  const yr = (v) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  };
  let from = yr(parsed.drink_from);
  let by = yr(parsed.drink_by);
  if (from == null && by == null) return null;
  // If only one bound came back, mirror it so we still have a usable range.
  if (from == null) from = by;
  if (by == null) by = from;
  if (by < from) [from, by] = [by, from];

  let peak = yr(parsed.peak);
  if (peak == null || peak < from || peak > by) {
    peak = peakYear(from, by);
  }

  const rationale =
    typeof parsed.rationale === 'string' && parsed.rationale.trim()
      ? parsed.rationale.trim()
      : '';

  return { drink_from: from, drink_by: by, peak, rationale };
}

export const drinkWindowAI = {
  // Ask the sommelier to propose a window for `bottle`.
  // Returns { success: true, window: { drink_from, drink_by, peak, rationale }, raw }
  // or { success: false, error } — callers treat any failure as "stay manual".
  async suggest(bottle = {}) {
    try {
      const systemPrompt = buildDrinkWindowSystemPrompt();
      const userRequest = buildDrinkWindowRequest(bottle);

      const aiResponse = await aiService.sendMessage(
        [{ role: 'user', content: userRequest }],
        systemPrompt
      );
      const responseText = aiResponse?.response || '';

      const parsed = aiService.parseDrinkWindow(responseText);
      const window = normalizeWindow(parsed);

      if (!window) {
        return {
          success: false,
          error: 'Could not read a drink window from the sommelier',
        };
      }

      return { success: true, window, raw: responseText };
    } catch (err) {
      console.error('drinkWindowAI.suggest error:', err);
      return { success: false, error: err.message || 'Suggestion failed' };
    }
  },
};

// Exported for unit-testing / reuse without the service object.
export { buildDrinkWindowSystemPrompt, buildDrinkWindowRequest, normalizeWindow };
