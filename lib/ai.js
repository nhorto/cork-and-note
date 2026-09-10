// lib/ai.js - AI service for Wine Sommelier
// Builds system prompt with user wine context, calls Edge Function
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { Image } from 'react-native';
import { supabase } from './supabase';
import { cellarService, describeBottleForPrompt } from './cellar';
import { publishMeter } from './pro';
import { varietalText } from './varietals';
import { visitsService } from './visits';
import { aiConsentError, getAiConsent, requireAiConsent } from './aiConsent';

// Longest-edge cap for photos sent to the AI (launch plan §4.3). Anthropic's
// image token cost scales with pixel count, and ~1,000px is plenty for label
// reads; camera photos are often 4,000px+. Display/storage uploads keep the
// original — this cap applies only to the base64 copy sent to the model.
const MAX_AI_IMAGE_EDGE = 1000;

export const aiService = {
  // ─── System prompt context ────────────────────────────────────────────
  // The sommelier is only as good as what it knows about YOUR wine. Three
  // sources feed it, each capped so a heavy user's prompt stays bounded and
  // each fetched defensively — context is a nice-to-have, and a failure to load
  // it must never be the reason chat breaks.

  // Recent tastings. `winemaker` matters more than it looks: "Octagon" is
  // unidentifiable, "Octagon — Barboursville Vineyards" is a specific wine the
  // model (or a web search) can actually reason about.
  async _tastingLines(limit = 20) {
    const result = await visitsService.getUserVisits();
    if (!result.success || !result.visits?.length) return [];

    const lines = [];
    for (const visit of result.visits) {
      for (const wine of visit.wines || []) {
        let line = wine.wine_name || 'Unnamed';
        if (wine.wine_year) line += ` ${wine.wine_year}`;
        if (wine.winemaker) line += ` — ${wine.winemaker}`;
        const meta = [wine.wine_type, varietalText(wine.wine_varietal)].filter(Boolean).join(', ');
        if (meta) line += ` (${meta})`;
        if (visit.wineries?.name) line += ` at ${visit.wineries.name}`;
        if (wine.overall_rating) line += ` · rated ${wine.overall_rating}/5`;
        const flavors = wine.wine_flavor_notes
          ?.map((fn) => fn.flavor_notes?.name)
          .filter(Boolean);
        if (flavors?.length) line += ` · notes: ${flavors.join(', ')}`;
        if (wine.additional_notes) line += ` · "${String(wine.additional_notes).slice(0, 120)}"`;
        lines.push(line);
        if (lines.length >= limit) return lines;
      }
    }
    return lines;
  },

  // What's actually in the cellar. Without this the main sommelier can discuss
  // wine in the abstract but cannot answer "what should I open with steak
  // tonight?" — the single most useful question a cellar owner has.
  async _cellarLines(limit = 40) {
    const result = await cellarService.getCellar();
    if (!result.success || !result.bottles?.length) return { lines: [], total: 0 };
    const bottles = result.bottles;
    return {
      lines: bottles.slice(0, limit).map((b) => describeBottleForPrompt(b)),
      total: bottles.length,
    };
  },

  // Where they drink. This is what makes the sommelier regional without us
  // hardcoding a region: the addresses say Virginia (or Sonoma, or Kent) and
  // the model takes its cue from them.
  async _placeLines(limit = 12) {
    const result = await visitsService.getUserVisits();
    if (!result.success || !result.visits?.length) return [];

    const seen = new Map();
    for (const visit of result.visits) {
      const winery = visit.wineries;
      if (!winery?.name || seen.has(winery.name)) continue;
      const where = winery.address ? String(winery.address).slice(0, 80) : null;
      seen.set(winery.name, where ? `${winery.name} — ${where}` : winery.name);
      if (seen.size >= limit) break;
    }
    return [...seen.values()];
  },

  // Build the sommelier system prompt, grounded in the user's own wine.
  async buildSystemPrompt() {
    // Settled, not all — one slow or failing source must not cost us the others.
    const [tastings, cellar, places] = await Promise.all([
      this._tastingLines().catch((err) => {
        console.log('Tasting context unavailable:', err.message);
        return [];
      }),
      this._cellarLines().catch((err) => {
        console.log('Cellar context unavailable:', err.message);
        return { lines: [], total: 0 };
      }),
      this._placeLines().catch((err) => {
        console.log('Place context unavailable:', err.message);
        return [];
      }),
    ]);

    let context = '';
    if (places.length > 0) {
      context += `\n\nWineries and tasting rooms the user has visited:\n`;
      context += places.map((p) => `- ${p}`).join('\n');
    }
    if (tastings.length > 0) {
      context += `\n\nThe user's recent tastings (${tastings.length}):\n`;
      context += tastings.map((line, i) => `${i + 1}. ${line}`).join('\n');
    }
    if (cellar.lines.length > 0) {
      const shown =
        cellar.total > cellar.lines.length
          ? `${cellar.lines.length} of ${cellar.total} lots shown`
          : `${cellar.total} lot${cellar.total === 1 ? '' : 's'}`;
      context += `\n\nWhat is currently in the user's cellar (${shown}). Each line is `;
      context += `"Wine Vintage — Producer (type, varietal, region) · qty · drink-window status · rating · location":\n`;
      context += cellar.lines.map((line) => `- ${line}`).join('\n');
      context += `\n\nWhen the user asks what to open, recommend from THIS list and say why; never invent a bottle they do not own.`;
    }

    return `You are an expert wine sommelier and a warm, knowledgeable companion inside Cork & Note, the user's wine tasting journal. You have deep expertise in:
- Wine regions worldwide — old world and new, celebrated appellations and small local producers alike
- Varietals, terroir, tasting notes, and food pairings
- Reading wine labels and identifying wines from photos
- Helping someone build a cellar and drink it at the right time

Meet the user where they actually drink. Their visits, tastings, and cellar are below — let those set the regional register of your answers, and never assume they are somewhere they are not. If their wine is from Virginia, talk about Virginia as knowledgeably as you would about Bordeaux.

Your personality: Friendly, passionate about wine, and approachable. You avoid being pretentious. You give practical, memorable advice. When you identify a wine from a photo, be specific about what you see and what it tells you.

If a web search tool is available to you, use it when the user asks about a SPECIFIC wine, producer, vintage, or winery that you cannot describe confidently from memory — small and regional producers especially, where guessing produces plausible-sounding fiction. Do not search for general wine knowledge you already have (how malolactic fermentation works, what pairs with duck, what Cabernet Franc tastes like); answer those directly. When you have searched, weave what you found into a normal conversational answer — do not narrate the search or pad the reply with sourcing commentary. If a search turns up nothing solid, say plainly that you could not find reliable information on that wine rather than filling the gap with invention.

When the user asks you to help identify or describe a wine (especially during wine entry), include a JSON suggestions block at the END of your response in this exact format:

\`\`\`wine_suggestions
{
  "winemaker": "string or null",
  "wine_name": "string or null",
  "wine_type": "Red|White|Rosé|Sparkling|Dessert|Red Blend|White Blend|Orange or null",
  "varietal": "string or null",
  "year": "string or null",
  "flavor_tags": ["array of flavor notes"] or null,
  "characteristics": {
    "sweetness": "number 0-5 or null",
    "tannins": "number 0-5 or null",
    "acidity": "number 0-5 or null",
    "body": "number 0-5 or null",
    "alcohol": "number 0-5 or null"
  },
  "overall_rating": "number 0-5 or null",
  "additional_notes": "string or null"
}
\`\`\`

Guidance for the characteristics and ratings:
- Each characteristic (sweetness, tannins, acidity, body, alcohol) and the overall_rating is a number on a 0–5 scale, where 0 means very low/absent and 5 means very high. Decimals are allowed (e.g. 3.5).
- overall_rating is your suggested quality rating for the wine on the same 0–5 scale.
- Only fill in a value you can reasonably infer from the wine, the label, the varietal/region, or the conversation. If you cannot reasonably infer a value, set it to null rather than guessing.
- winemaker is the winery or producer that made the wine.
- additional_notes is a short free-text tasting note or description suitable to drop into a notes field.

Only include the wine_suggestions block when you have specific wine information to suggest. Always include a conversational response before the block.${context}`;
  },

  // Convert a local photo URI to base64 for the AI.
  // Reads the file directly with expo-file-system — fetch(localUri).blob()
  // returns an EMPTY blob for file:// URIs in Expo/RN, which sent the model a
  // blank image (it couldn't actually see the wine).
  async photoToBase64(uri) {
    // Downscale oversized photos before upload. Best-effort: any failure here
    // (unreadable dimensions, manipulator missing on an old dev client) falls
    // through to sending the original, exactly as before.
    try {
      const { width, height } = await new Promise((resolve, reject) =>
        Image.getSize(uri, (w, h) => resolve({ width: w, height: h }), reject)
      );
      if (Math.max(width, height) > MAX_AI_IMAGE_EDGE) {
        // Resize with only one dimension so aspect ratio is preserved.
        const resize =
          width >= height ? { width: MAX_AI_IMAGE_EDGE } : { height: MAX_AI_IMAGE_EDGE };
        const result = await ImageManipulator.manipulateAsync(uri, [{ resize }], {
          compress: 0.8,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        });
        if (result?.base64) {
          return { base64: result.base64, mediaType: 'image/jpeg' };
        }
      }
    } catch (err) {
      console.log('Photo downscale failed, sending original:', err.message);
    }

    try {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const lower = (uri || '').toLowerCase();
      const mediaType = lower.endsWith('.png')
        ? 'image/png'
        : lower.endsWith('.webp')
        ? 'image/webp'
        : 'image/jpeg';
      return { base64, mediaType };
    } catch (err) {
      console.error('Failed to convert photo to base64:', err);
      return null;
    }
  },

  // Send messages to the Edge Function and get AI response
  // messages format: { role, content, images?: [{ base64, mediaType }] }
  async sendMessage(messages, systemPrompt = null, options = {}) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');
    await requireAiConsent(session.user.id);

    // Build system prompt if not provided
    const prompt = systemPrompt || await this.buildSystemPrompt();

    // Cap message history at last 20 messages for token cost
    // Strip base64 images from old messages to save tokens (only keep latest)
    const cappedMessages = messages.slice(-20).map((m, i, arr) => {
      // Only include images on the most recent user message to save payload size
      if (i < arr.length - 1) {
        return { role: m.role, content: m.content };
      }
      return m;
    });

    // Optional server-side task hint → the Edge Function maps it to a model
    // (e.g. 'label_scan' uses a cheaper model). Omitted → default chat model.
    const body = { messages: cappedMessages, system_prompt: prompt };
    if (options && typeof options.task === 'string') body.task = options.task;

    // Consent may have been withdrawn or the account changed while preparing context.
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (currentSession?.user?.id !== session.user.id) throw new Error('Please sign in again.');
    if (!(await getAiConsent(session.user.id))) throw aiConsentError();
    // Use Supabase client's functions.invoke — handles auth headers automatically
    const { data, error } = await supabase.functions.invoke('chat', { body });

    if (error) {
      // functions.invoke surfaces non-2xx as a FunctionsHttpError whose .message
      // is the generic "Edge Function returned a non-2xx status code"; the
      // function's friendly JSON body ("Daily limit reached…", etc.) is only on
      // error.context. Extract it so users see the real message.
      let serverMessage = null;
      let serverCode = null;
      try {
        const bodyJson = await error.context?.json?.();
        serverMessage = bodyJson?.error || null;
        serverCode = bodyJson?.code || null;
        // A refused call still reports the meter, which is how a gate can say
        // "no free scans left" instead of just failing.
        publishMeter(bodyJson?.meter);
      } catch {
        // body wasn't JSON / already consumed — fall through to the generic message
      }
      console.error('Edge Function invoke error:', serverMessage || error.message);
      const wrapped = new Error(serverMessage || error.message || 'AI request failed');
      // isPaywallError() reads this: only a 402 should open the paywall, never a
      // dropped connection or an abuse rate-limit.
      if (serverCode) wrapped.code = serverCode;
      throw wrapped;
    }

    // A 200 response can still carry a handled error in the body.
    if (data?.error) {
      console.error('AI error:', data.error);
      console.error('AI details:', data.details || 'none');
      throw new Error(`${data.error}: ${data.details || 'unknown'}`);
    }

    // Every AI response carries the meter it just spent; publishing it keeps the
    // "2 free scans left this month" hints correct across all six AI features
    // without each of them having to remember to refresh.
    publishMeter(data?.meter);

    return data;
  },

  // Parse wine suggestions from AI response.
  //
  // The wine-entry chat is free-form prose, so — unlike parseTonightsPick et al.
  // — we deliberately KEEP the ```wine_suggestions fence mandatory: falling back
  // to "any {...} in the text" would wrongly attach a "Use Suggestions" button to
  // ordinary chat replies. We only relax the fence's surrounding whitespace (the
  // old `\n...\n` was brittle — a missing/extra newline silently dropped a valid
  // block) and, as a last resort, extract the first {...} found *inside* the
  // matched fence.
  parseSuggestions(responseText) {
    if (!responseText) return null;
    const match = responseText.match(/```wine_suggestions\s*\n?([\s\S]*?)```/);
    if (!match) return null;

    const block = match[1];
    try {
      return JSON.parse(block.trim());
    } catch {
      const obj = block.match(/\{[\s\S]*\}/);
      if (!obj) return null;
      try {
        return JSON.parse(obj[0]);
      } catch {
        return null;
      }
    }
  },

  // Parse a "tonight's pick" cellar recommendation block from an AI response.
  // Mirrors parseSuggestions: the model emits a fenced ```tonights_pick JSON
  // block (see lib/cellarSommelier.js for the prompt + expected shape). Returns
  // the parsed object, or null if absent/unparseable so callers can fall back.
  parseTonightsPick(responseText) {
    if (!responseText) return null;
    // Be lenient about the fence's language tag / leading whitespace.
    const match = responseText.match(/```(?:tonights_pick)?\s*\n?([\s\S]*?)```/);
    const block = match ? match[1] : responseText;
    try {
      return JSON.parse(block.trim());
    } catch {
      // Last resort: pull the first {...} object out of the prose.
      const obj = block.match(/\{[\s\S]*\}/);
      if (!obj) return null;
      try {
        return JSON.parse(obj[0]);
      } catch {
        return null;
      }
    }
  },

  // Parse a "drink window" suggestion block from an AI response (R4 / #54).
  // Mirrors parseTonightsPick: the model emits a fenced ```drink_window JSON
  // block (see lib/drinkWindow.js for the prompt + expected shape). Returns the
  // parsed object, or null if absent/unparseable so callers can fall back to
  // manual entry. Lenient about the fence tag and stray prose.
  parseDrinkWindow(responseText) {
    if (!responseText) return null;
    const match = responseText.match(/```(?:drink_window)?\s*\n?([\s\S]*?)```/);
    const block = match ? match[1] : responseText;
    try {
      return JSON.parse(block.trim());
    } catch {
      const obj = block.match(/\{[\s\S]*\}/);
      if (!obj) return null;
      try {
        return JSON.parse(obj[0]);
      } catch {
        return null;
      }
    }
  },

  // Parse a "food pairing" block from an AI response (R10 / #61).
  // Mirrors parseDrinkWindow: the model emits a fenced ```food_pairing JSON
  // block (see lib/cellarPairing.js for the prompt + expected shape). Returns
  // the parsed object, or null if absent/unparseable so callers can fall back.
  // Lenient about the fence tag and stray prose.
  parsePairing(responseText) {
    if (!responseText) return null;
    const match = responseText.match(/```(?:food_pairing)?\s*\n?([\s\S]*?)```/);
    const block = match ? match[1] : responseText;
    try {
      return JSON.parse(block.trim());
    } catch {
      const obj = block.match(/\{[\s\S]*\}/);
      if (!obj) return null;
      try {
        return JSON.parse(obj[0]);
      } catch {
        return null;
      }
    }
  },

  // Parse a "label scan" block from an AI response (R9 / #59).
  // Mirrors parsePairing: after reading a wine-label photo the model emits a
  // fenced ```cellar_label JSON block (see lib/cellarScan.js for the prompt +
  // expected shape) which prefills the cellar add form. Returns the parsed
  // object, or null if absent/unparseable so the caller can fall back to a
  // blank, fully-editable form. Lenient about the fence tag and stray prose.
  //
  // SECURITY: the label image and this response are UNTRUSTED data. This only
  // JSON-parses the block; the caller whitelists the fields it keeps. Nothing
  // here is evaluated or used for control flow.
  parseLabelScan(responseText) {
    if (!responseText) return null;
    const match = responseText.match(/```(?:cellar_label)?\s*\n?([\s\S]*?)```/);
    const block = match ? match[1] : responseText;
    try {
      return JSON.parse(block.trim());
    } catch {
      const obj = block.match(/\{[\s\S]*\}/);
      if (!obj) return null;
      try {
        return JSON.parse(obj[0]);
      } catch {
        return null;
      }
    }
  },

  // Parse a "tasting menu" block from an AI response (#139). The array-aware
  // sibling of parseLabelScan: after reading a multi-wine tasting card the model
  // emits a fenced ```tasting_menu block holding { "wines": [ {…}, … ] } (see
  // lib/cellarScan.js for the prompt + per-wine shape). Returns the parsed value
  // (an object with a `wines` array, or a bare array), or null if absent /
  // unparseable so the caller can fall back to manual entry. Lenient about the
  // fence tag and stray prose.
  //
  // SECURITY: the card image and this response are UNTRUSTED data. This only
  // JSON-parses the block; the caller (normalizeMenu) whitelists each wine's
  // fields. Nothing here is evaluated or used for control flow.
  parseTastingMenu(responseText) {
    if (!responseText) return null;
    const match = responseText.match(/```(?:tasting_menu)?\s*\n?([\s\S]*?)```/);
    const block = match ? match[1] : responseText;
    try {
      return JSON.parse(block.trim());
    } catch {
      // Fall back to the first JSON object or array embedded in the block.
      const obj = block.match(/\{[\s\S]*\}/) || block.match(/\[[\s\S]*\]/);
      if (!obj) return null;
      try {
        return JSON.parse(obj[0]);
      } catch {
        return null;
      }
    }
  },

  // Get the conversational part of the response, with our structured-output
  // control blocks removed. The UI renders those blocks from PARSED JSON (see
  // parseSuggestions / parseTonightsPick / parsePairing / parseDrinkWindow /
  // parseLabelScan), so the raw fenced JSON must never reach the screen.
  // Only our KNOWN tags are stripped — a user's legitimate ```js / ```sql /
  // etc. answer in free-form chat is preserved. Lenient about the tag's
  // trailing newline and global so multiple blocks in one reply all go.
  getDisplayText(responseText) {
    if (!responseText) return '';
    const STRUCTURED_TAGS = [
      'wine_suggestions',
      'tonights_pick',
      'food_pairing',
      'drink_window',
      'cellar_label',
      'tasting_menu',
    ];
    const pattern = new RegExp(
      '```(?:' + STRUCTURED_TAGS.join('|') + ')\\s*\\n?[\\s\\S]*?```',
      'g'
    );
    return responseText.replace(pattern, '').trim();
  },
};
