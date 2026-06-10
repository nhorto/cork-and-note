// lib/cellarPairing.js — per-bottle wine→dish food pairing (Epic #6 · R10 · #61).
//
// The REVERSE of "tonight's pick" (#51): instead of "what should I drink with
// this dish?", this answers "I want to open THIS bottle — what should I cook /
// serve with it?" The pairing is rendered as a first-class element on the
// bottle's detail page (per the research: pairing should live where the
// decision is made — see docs/research/wine-cellar-ux.md §2.5).
//
// Design mirrors lib/cellarSommelier.js: assemble the context CLIENT-SIDE and
// reuse the existing AI/chat plumbing (lib/ai.js → supabase.functions.invoke
// ('chat')) rather than changing the Edge Function. We send a one-shot request
// with a bespoke system prompt that grounds the model in THAT single bottle and
// asks for a parseable ```food_pairing JSON block, parsed defensively so we
// never throw to the UI.
//
// This module may READ from lib/cellar.js but must NOT modify it.
import { aiService } from './ai';

// Optional tap-first refinements (occasion / season). Kept here so the card UI
// and the prompt stay in sync. The MVP works with none of these selected.
export const OCCASIONS = [
  'Casual weeknight',
  'Date night',
  'Dinner party',
  'Celebration',
  'Relaxing solo',
];

export const SEASONS = [
  'Spring',
  'Summer',
  'Autumn',
  'Winter',
];

// Describe the single bottle as a compact, stable block for the prompt so the
// model grounds its suggestions in exactly this wine (not a generic varietal).
function describeBottle(b = {}) {
  const name = b.wine_name || 'Unnamed wine';
  const producer = b.producer || b.wineries?.name;
  const lines = [`Wine: ${name}${b.vintage ? ` ${b.vintage}` : ''}`];
  if (producer) lines.push(`Producer: ${producer}`);
  if (b.wine_type) lines.push(`Type: ${b.wine_type}`);
  if (b.varietal) lines.push(`Varietal: ${b.varietal}`);
  if (b.region) lines.push(`Region: ${b.region}`);
  if (b.drink_from || b.drink_by) {
    lines.push(`Drink window: ${b.drink_from || '—'}–${b.drink_by || '—'}`);
  }
  if (b.rating != null) lines.push(`Your rating: ${b.rating}/5`);
  if (b.notes) lines.push(`Your notes: "${String(b.notes).slice(0, 200)}"`);
  return lines.join('\n');
}

// Build the system prompt grounding the sommelier in THIS bottle and pinning
// the output shape. `bottle` is a single cellar lot object.
function buildPairingSystemPrompt(bottle) {
  return `You are Cork & Note's in-house wine sommelier. The user owns the specific bottle below and wants to open it — your job is to suggest what to COOK or SERVE with THIS wine. This is friendly, practical advice: name real, specific dishes and explain the reasoning, so the user can trust (or overrule) you.

The bottle:
${describeBottle(bottle)}

How to advise:
- Keep the pairings GENERIC and flexible — think proteins, preparations, and ingredient categories the user can riff on, NOT fully composed restaurant plates. Good: "a good grilled steak or other red meat", "rich seafood like salmon or seared scallops", "hard aged cheeses", "earthy mushroom dishes". Avoid over-specific single dishes like "herb-crusted rack of lamb with rosemary jus" — that's too prescriptive.
- Stay bottle-aware in your REASONING: use the wine's actual body, tannin, acidity, sweetness, age, and region to explain WHY a category works, but keep the headline suggestion broad enough to leave the user room to choose.
- Honor the user's occasion / season when given.
- Offer a small, varied set (3–5 pairings) spanning categories where it makes sense — e.g. a red meat, a seafood or lighter option, a cheese, maybe a vegetarian option — so there's a real choice, not five steaks.
- Keep each "why" to one or two warm, concrete sentences.

Respond with a short friendly sentence, THEN a single fenced code block in EXACTLY this format (valid JSON, no comments, no trailing commas):

\`\`\`food_pairing
{
  "intro": "one short friendly line framing the pairings for this bottle",
  "pairings": [
    {
      "dish": "a food category / protein / preparation, broad not a single composed plate (e.g. grilled red meat, or seafood like salmon or scallops)",
      "why": "one or two sentences: why it works with THIS wine",
      "category": "main | starter | cheese | vegetarian | dessert | occasion"
    }
  ]
}
\`\`\`

Include 3 to 5 pairings. Always include "dish" and "why" for each. "category" is optional but helpful. Do not suggest a different wine — the bottle is already chosen.`;
}

// Turn the optional tap-first selections + free text into the user turn.
function buildUserRequest(bottle = {}, { occasion, season, freeText } = {}) {
  const name = bottle.wine_name || 'this bottle';
  const lines = [];
  if (occasion) lines.push(`Occasion: ${occasion}`);
  if (season) lines.push(`Season: ${season}`);
  if (freeText && freeText.trim()) lines.push(`Notes: ${freeText.trim()}`);

  const preamble = `I want to open ${name}${bottle.vintage ? ` ${bottle.vintage}` : ''}. What should I cook or serve with it?`;
  const context = lines.length > 0 ? `\n${lines.join('\n')}` : '';

  return `${preamble}${context}\n\nReply with the food_pairing JSON block. Keep the suggestions fairly generic — proteins, preparations, and food categories I can riff on, not over-specific single plates — but explain why each works for this bottle.`;
}

// Normalize the parsed model output into a stable shape the UI can render.
// Never throws: returns null when there's nothing usable.
function normalizePairing(parsed) {
  if (!parsed) return null;

  const rawPairings = Array.isArray(parsed.pairings) ? parsed.pairings : [];
  const pairings = rawPairings
    .map((p) => {
      const dish = p?.dish ? String(p.dish).trim() : '';
      if (!dish) return null;
      return {
        dish,
        why: p?.why ? String(p.why).trim() : '',
        category: p?.category ? String(p.category).trim().toLowerCase() : null,
      };
    })
    .filter(Boolean)
    .slice(0, 5);

  if (pairings.length === 0) return null;

  return {
    intro: parsed.intro ? String(parsed.intro).trim() : '',
    pairings,
  };
}

export const cellarPairing = {
  OCCASIONS,
  SEASONS,

  // Ask the sommelier what to cook / serve with `bottle`.
  // Returns { success, pairing, raw } or { success:false, error }.
  // `pairing` is the normalized { intro, pairings[] } shape; `raw` is the
  // model's friendly lead-in (block stripped) for display.
  async getPairings(bottle, selections = {}) {
    try {
      if (!bottle || (!bottle.wine_name && !bottle.varietal && !bottle.wine_type)) {
        return { success: false, error: 'Not enough detail on this bottle to suggest a pairing.' };
      }

      const systemPrompt = buildPairingSystemPrompt(bottle);
      const userRequest = buildUserRequest(bottle, selections);

      const aiResponse = await aiService.sendMessage(
        [{ role: 'user', content: userRequest }],
        systemPrompt
      );
      const responseText = aiResponse?.response || '';

      const parsed = aiService.parsePairing(responseText);
      const pairing = normalizePairing(parsed);

      if (!pairing) {
        return {
          success: false,
          error: 'Could not read a pairing from the sommelier. Please try again.',
        };
      }

      return {
        success: true,
        pairing,
        raw: aiService.getDisplayText(responseText),
      };
    } catch (err) {
      console.error('getPairings error:', err);
      return { success: false, error: err.message || 'Pairing failed' };
    }
  },
};

// Exported for unit-testing / reuse without going through the service object.
export { buildPairingSystemPrompt, buildUserRequest, normalizePairing };
