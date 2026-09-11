// lib/ai.js - AI service for Wine Sommelier
// Builds system prompt with user wine context, calls Edge Function
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { Image } from 'react-native';
import { supabase, supabaseAnonKey, supabaseUrl } from './supabase';
import { streamEdgeFunction } from './chatStream';
import { cellarService, describeBottleForPrompt } from './cellar';
import { publishMeter } from './pro';
import { varietalText } from './varietals';
import { visitsService } from './visits';
import { AI_SHARING_VERSION, aiConsentError, getAiConsent, requireAiConsent } from './aiConsent';
import { buildSommelierPrompt } from './sommelierPrompt';

// Default longest edge for bottle labels and chat attachments. Dense cards
// and lists explicitly request the tested 1,568px setting. Display/storage
// uploads keep the original; this cap affects only the AI upload copy.
const MAX_AI_IMAGE_EDGE = 1000;
// Tested longest-edge setting for dense cards and lists. Keep upload size
// bounded while preserving more small print than the single-label default.
const MAX_AI_IMAGE_EDGE_CEILING = 1568;

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

    return buildSommelierPrompt({ places, tastings, cellar });
  },

  // Convert a local photo URI to base64 for the AI.
  // Reads the file directly with expo-file-system — fetch(localUri).blob()
  // returns an EMPTY blob for file:// URIs in Expo/RN, which sent the model a
  // blank image (it couldn't actually see the wine).
  //
  // `maxEdge` overrides the default cap for callers that need to read small
  // print — a restaurant wine list photographed across a table is unreadable
  // at 1,000px but fine at 1,600. Bounded so a caller cannot ship a 4,000px
  // original by accident.
  async photoToBase64(uri, { maxEdge = MAX_AI_IMAGE_EDGE } = {}) {
    const edge = Math.min(Math.max(Number(maxEdge) || MAX_AI_IMAGE_EDGE, 400), MAX_AI_IMAGE_EDGE_CEILING);
    // Downscale oversized photos before upload. Best-effort: any failure here
    // (unreadable dimensions, manipulator missing on an old dev client) falls
    // through to the original for already-supported formats.
    try {
      const { width, height } = await new Promise((resolve, reject) =>
        Image.getSize(uri, (w, h) => resolve({ width: w, height: h }), reject)
      );
      // Re-encode even small photos: HEIC inputs must not be sent as JPEG bytes.
      const actions = Math.max(width, height) > edge
        ? [{ resize: width >= height ? { width: edge } : { height: edge } }]
        : [];
      const result = await ImageManipulator.manipulateAsync(uri, actions, {
        compress: 0.8,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      });
      if (result?.base64) return { base64: result.base64, mediaType: 'image/jpeg' };
    } catch (err) {
      console.log('Photo conversion failed:', err.message);
    }

    // An unconverted HEIC/HEIF file cannot be labeled image/jpeg.
    if (/\.hei[cf](?:[?#]|$)/i.test(uri || '')) return null;
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
    // (e.g. scans use Gemini extraction). Omitted → default chat model.
    const body = { messages: cappedMessages, system_prompt: prompt, ai_sharing_version: AI_SHARING_VERSION };
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

  // Chat-only streaming sibling of sendMessage. Structured AI features keep
  // using the atomic JSON response because they must parse a complete fenced
  // payload before touching a form. onDelta receives the full text-so-far.
  async sendMessageStream(messages, systemPrompt = null, { onDelta } = {}) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');
    await requireAiConsent(session.user.id);

    const prompt = systemPrompt || await this.buildSystemPrompt();
    const cappedMessages = messages.slice(-20).map((message, index, all) =>
      index < all.length - 1
        ? { role: message.role, content: message.content }
        : message
    );

    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (currentSession?.user?.id !== session.user.id) throw new Error('Please sign in again.');
    if (!(await getAiConsent(session.user.id))) throw aiConsentError();

    const data = await streamEdgeFunction({
      url: supabaseUrl,
      anonKey: supabaseAnonKey,
      accessToken: currentSession.access_token,
      body: { messages: cappedMessages, system_prompt: prompt },
      onDelta,
    });
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
      // Fall back to the first JSON object or array embedded in the block. A
      // bare array of wines matches the object pattern too (first { to last }),
      // which is not valid JSON on its own, so try each shape in turn.
      for (const candidate of [block.match(/\{[\s\S]*\}/), block.match(/\[[\s\S]*\]/)]) {
        if (!candidate) continue;
        try {
          return JSON.parse(candidate[0]);
        } catch {
          // not this shape; try the next
        }
      }
      return null;
    }
  },

  // Get the conversational part of the response, with our structured-output
  // control blocks removed. The UI renders those blocks from PARSED JSON (see
  // parseSuggestions / parseTonightsPick / parsePairing / parseDrinkWindow /
  // parseLabelScan), so the raw fenced JSON must never reach the screen.
  // Only our KNOWN tags are stripped — a user's legitimate ```js / ```sql /
  // etc. answer in free-form chat is preserved. Lenient about the tag's
  // trailing newline and global so multiple blocks in one reply all go.
  // Generic fenced-JSON extractor for the guided tools, so each tool does not
  // grow its own copy of the lenient pattern above. Returns the parsed value
  // or null; never throws. `truncated` is true when the fence was opened but
  // never closed — the model ran out of output budget mid-object, and the
  // caller must treat that as a failed call, not splice a partial result.
  parseFencedJson(responseText, tag) {
    if (!responseText || !tag) return { value: null, truncated: false };
    // The tag must end at the fence: `wine_list` is a prefix of
    // `wine_list_picks`, and a plain indexOf would read the wrong block.
    const open = responseText.search(new RegExp('```' + tag + '(?![A-Za-z0-9_])'));
    if (open === -1) {
      // Some replies drop the tag; accept a bare JSON object/array as a
      // fallback only when the whole reply is one.
      const trimmed = responseText.trim();
      if (/^[[{][\s\S]*[\]}]$/.test(trimmed)) {
        try {
          return { value: JSON.parse(trimmed), truncated: false };
        } catch {
          return { value: null, truncated: false };
        }
      }
      return { value: null, truncated: false };
    }
    const bodyStart = responseText.indexOf('\n', open);
    if (bodyStart === -1) return { value: null, truncated: true };
    const close = responseText.indexOf('```', bodyStart);
    if (close === -1) return { value: null, truncated: true };
    try {
      return { value: JSON.parse(responseText.slice(bodyStart, close).trim()), truncated: false };
    } catch {
      return { value: null, truncated: false };
    }
  },

  getDisplayText(responseText) {
    if (!responseText) return '';
    const STRUCTURED_TAGS = [
      'wine_suggestions',
      'tonights_pick',
      'food_pairing',
      'drink_window',
      'cellar_label',
      'tasting_menu',
      // Guided Pro tools (2026-09-11). Parsed with parseFencedJson below.
      'wine_list',
      'wine_list_picks',
      'taste_report',
      'trip_plan',
    ];
    const pattern = new RegExp(
      '```(?:' + STRUCTURED_TAGS.join('|') + ')\\s*\\n?[\\s\\S]*?```',
      'g'
    );
    return responseText.replace(pattern, '').trim();
  },
};
