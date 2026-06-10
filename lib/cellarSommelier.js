// lib/cellarSommelier.js — "Tonight's pick": point the AI sommelier at the
// user's own cellar (Epic #6 · R1 · issue #51).
//
// Design: assemble the cellar context CLIENT-SIDE and reuse the existing
// AI/chat plumbing (lib/ai.js → supabase.functions.invoke('chat')) rather than
// changing the Edge Function. We send a one-shot request with a bespoke system
// prompt that (a) grounds the model in the user's in-cellar bottles + each
// bottle's derived drink-window status and (b) asks for a parseable
// ```tonights_pick JSON block. The result is parsed defensively.
//
// Only reads existing exports from lib/cellar.js (getCellar / drinkWindowStatus)
// — it never writes to or modifies that file.
import { aiService } from './ai';
import { cellarService, drinkWindowStatus } from './cellar';

// Tap-first picker options (free text stays optional). Kept here so the card UI
// and the prompt stay in sync.
export const OCCASIONS = [
  'Casual weeknight',
  'Date night',
  'Celebration',
  'With friends',
  'Relaxing solo',
  'Special occasion',
];

export const CUISINES = [
  'Red meat / steak',
  'Poultry',
  'Pork',
  'Fish / seafood',
  'Pasta',
  'Pizza',
  'Cheese / charcuterie',
  'Spicy food',
  'Vegetarian',
  'Dessert',
  'No food',
];

export const MOODS = [
  'Bold & full',
  'Light & easy',
  'Crisp & fresh',
  'Smooth & elegant',
  'Adventurous',
  'A safe favorite',
];

// Human-readable label for a derived drink-window status.
const STATUS_LABEL = {
  too_young: 'still too young',
  ready: 'ready to drink',
  drink_up: 'drink up soon (final stretch)',
  past_peak: 'likely past peak',
};

function statusLabel(status) {
  return status ? STATUS_LABEL[status] || status : 'drink window unknown';
}

// Render one bottle as a compact, stable line for the prompt context. We assign
// a 1-based ref so the model can point back at an exact bottle and we can match
// its pick to a real lot afterward.
function describeBottle(b, ref) {
  const name = b.wine_name || 'Unnamed wine';
  const producer = b.producer || b.wineries?.name;
  const parts = [];
  if (b.wine_type) parts.push(b.wine_type);
  if (b.varietal) parts.push(b.varietal);
  if (b.region) parts.push(b.region);
  const meta = parts.join(', ');

  let line = `[${ref}] ${name}`;
  if (b.vintage) line += ` ${b.vintage}`;
  if (producer) line += ` — ${producer}`;
  if (meta) line += ` (${meta})`;
  line += ` · qty ${b.quantity ?? 1}`;
  line += ` · ${statusLabel(b.drinkStatus ?? drinkWindowStatus(b.drink_from, b.drink_by, b.vintage))}`;
  if (b.rating != null) line += ` · your rating ${b.rating}/5`;
  if (b.location) line += ` · ${b.location}`;
  if (b.notes) line += ` · note: "${String(b.notes).slice(0, 120)}"`;
  return line;
}

// Build the full system prompt that grounds the sommelier in the cellar and
// pins the output shape. `bottles` is the annotated in-cellar list.
function buildCellarSystemPrompt(bottles) {
  const ready = bottles.filter((b) =>
    ['ready', 'drink_up'].includes(b.drinkStatus ?? drinkWindowStatus(b.drink_from, b.drink_by, b.vintage))
  ).length;

  const inventory = bottles.map((b, i) => describeBottle(b, i + 1)).join('\n');

  return `You are Cork & Note's in-house wine sommelier helping the user decide what to drink tonight — but you may ONLY recommend bottles the user ALREADY OWNS, listed below. Never invent a wine, never suggest something to buy. This is friendly advice, not a command: explain your reasoning so the user can trust (or overrule) it.

The user's current cellar (${bottles.length} lot${bottles.length === 1 ? '' : 's'} in cellar, ${ready} ready to drink). Each line is "[ref] Wine Vintage — Producer (type, varietal, region) · qty · drink-window status · your rating · location":
${inventory}

How to choose:
- Strongly prefer bottles whose drink-window status is "ready to drink" or "drink up soon"; gently favor "drink up soon" so good bottles aren't lost. Only pick "still too young" or "likely past peak" if nothing better fits, and say so.
- Honor the user's occasion / cuisine / mood / free-text request when given. The cuisine is a food PAIRING target — match it well.
- Pick exactly ONE hero bottle plus TWO different alternatives (different wines from the list, ideally a different style or a contingency).
- Keep the tone warm and concrete; reference the actual wine, not generic "a Pinot."

Respond with a short friendly sentence, THEN a single fenced code block in EXACTLY this format (valid JSON, no comments, no trailing commas):

\`\`\`tonights_pick
{
  "pick": {
    "ref": <the [ref] number of the chosen bottle>,
    "name": "wine name as shown",
    "vintage": "vintage or null",
    "producer": "producer or null",
    "why": "one or two sentences: why this bottle tonight (occasion/pairing/drink-window)",
    "flavor_highlights": ["2-4 short flavor/structure descriptors"]
  },
  "alternatives": [
    { "ref": <ref>, "name": "wine name", "vintage": "vintage or null", "why": "one short line" },
    { "ref": <ref>, "name": "wine name", "vintage": "vintage or null", "why": "one short line" }
  ]
}
\`\`\`

Only reference refs that appear in the cellar list above. If the cellar has fewer than 3 lots, include as many alternatives as you can (0, 1, or 2). Always include the pick and always include the flavor_highlights.`;
}

// Strip the tonights_pick code block (and any stray fenced JSON) so only the
// model's friendly conversational sentence is shown as the lead-in. aiService's
// getDisplayText only knows about the wine_suggestions block, so we handle our
// own fence here rather than changing that shared helper.
function stripPickBlock(responseText) {
  if (!responseText) return '';
  return responseText
    .replace(/```(?:tonights_pick)?\s*\n?[\s\S]*?```/g, '')
    .trim();
}

// Turn the tap-first selections + free text into the user turn.
function buildUserRequest({ occasion, cuisine, mood, freeText } = {}) {
  const lines = [];
  if (occasion) lines.push(`Occasion: ${occasion}`);
  if (cuisine) lines.push(`Food / cuisine: ${cuisine}`);
  if (mood) lines.push(`Mood: ${mood}`);
  if (freeText && freeText.trim()) lines.push(`Notes: ${freeText.trim()}`);

  const preamble =
    lines.length > 0
      ? `What should I drink tonight, from my cellar?\n${lines.join('\n')}`
      : 'What should I drink tonight, from my cellar? Surprise me with a great pick I already own.';

  return `${preamble}\n\nRemember: only recommend bottles from my cellar, and reply with the tonights_pick JSON block.`;
}

// Match a ref / name from the AI response back to a real lot so the card can
// link to the bottle's detail screen. Ref is the 1-based index into `bottles`.
function resolveBottle(bottles, ref, name) {
  if (Number.isInteger(ref) && ref >= 1 && ref <= bottles.length) {
    return bottles[ref - 1];
  }
  if (name) {
    const needle = String(name).trim().toLowerCase();
    return (
      bottles.find((b) => (b.wine_name || '').trim().toLowerCase() === needle) || null
    );
  }
  return null;
}

// Normalize the parsed model output into a stable shape the UI can render,
// attaching the resolved bottle id where possible.
function normalizePick(parsed, bottles) {
  if (!parsed || !parsed.pick) return null;
  const p = parsed.pick;
  const pickedBottle = resolveBottle(bottles, p.ref, p.name);

  const alternatives = Array.isArray(parsed.alternatives)
    ? parsed.alternatives.slice(0, 2).map((a) => {
        const alt = resolveBottle(bottles, a?.ref, a?.name);
        return {
          name: a?.name || alt?.wine_name || 'Unnamed wine',
          vintage: a?.vintage ?? alt?.vintage ?? null,
          why: a?.why || '',
          bottleId: alt?.id ?? null,
        };
      })
    : [];

  return {
    pick: {
      name: p.name || pickedBottle?.wine_name || 'Unnamed wine',
      vintage: p.vintage ?? pickedBottle?.vintage ?? null,
      producer: p.producer ?? pickedBottle?.producer ?? pickedBottle?.wineries?.name ?? null,
      why: p.why || '',
      flavorHighlights: Array.isArray(p.flavor_highlights)
        ? p.flavor_highlights.filter(Boolean).slice(0, 4)
        : [],
      bottleId: pickedBottle?.id ?? null,
    },
    alternatives,
  };
}

export const cellarSommelier = {
  OCCASIONS,
  CUISINES,
  MOODS,

  // Fetch the user's in-cellar bottles (read-only reuse of lib/cellar.js).
  // Returns { success, bottles } where bottles are drink-window-annotated.
  async getCellarBottles() {
    const res = await cellarService.getCellar();
    if (!res.success) return { success: false, error: res.error, bottles: [] };
    return { success: true, bottles: res.bottles || [] };
  },

  // Ask the sommelier for tonight's pick, grounded in `bottles`.
  // Returns { success, recommendation, raw } or { success:false, error }.
  // `recommendation` is the normalized { pick, alternatives } shape; `raw` is the
  // model's conversational text (block stripped) for display/debugging.
  async getTonightsPick(bottles, selections = {}) {
    try {
      if (!Array.isArray(bottles) || bottles.length === 0) {
        return { success: false, empty: true, error: 'Your cellar is empty' };
      }

      const systemPrompt = buildCellarSystemPrompt(bottles);
      const userRequest = buildUserRequest(selections);

      const aiResponse = await aiService.sendMessage(
        [{ role: 'user', content: userRequest }],
        systemPrompt
      );
      const responseText = aiResponse?.response || '';

      const parsed = aiService.parseTonightsPick(responseText);
      const recommendation = normalizePick(parsed, bottles);

      if (!recommendation) {
        return {
          success: false,
          error: 'Could not read a recommendation from the sommelier',
          raw: stripPickBlock(responseText),
        };
      }

      return {
        success: true,
        recommendation,
        raw: aiService.getDisplayText(responseText),
      };
    } catch (err) {
      console.error('getTonightsPick error:', err);
      return { success: false, error: err.message || 'Recommendation failed' };
    }
  },

  // Convenience: fetch + recommend in one call.
  async recommend(selections = {}) {
    const cellar = await this.getCellarBottles();
    if (!cellar.success) return { success: false, error: cellar.error };
    if (cellar.bottles.length === 0) {
      return { success: false, empty: true, error: 'Your cellar is empty', bottles: [] };
    }
    const result = await this.getTonightsPick(cellar.bottles, selections);
    return { ...result, bottles: cellar.bottles };
  },
};

// Exported for unit-testing / reuse without going through the service object.
export { buildCellarSystemPrompt, buildUserRequest, normalizePick };
