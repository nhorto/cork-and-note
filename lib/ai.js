// lib/ai.js - AI service for Wine Sommelier
// Builds system prompt with user wine context, calls Edge Function
import * as FileSystem from 'expo-file-system';
import { supabase } from './supabase';
import { visitsService } from './visits';

export const aiService = {
  // Build the sommelier system prompt with user's wine history
  async buildSystemPrompt() {
    let wineContext = '';

    try {
      const result = await visitsService.getUserVisits();
      if (result.success && result.visits?.length > 0) {
        // Summarize last 20 wines
        const recentWines = [];
        for (const visit of result.visits) {
          for (const wine of (visit.wines || [])) {
            recentWines.push({
              name: wine.wine_name,
              type: wine.wine_type,
              varietal: wine.wine_varietal,
              year: wine.wine_year,
              rating: wine.overall_rating,
              winery: visit.wineries?.name,
              notes: wine.additional_notes,
              flavors: wine.wine_flavor_notes?.map(fn => fn.flavor_notes?.name).filter(Boolean),
            });
            if (recentWines.length >= 20) break;
          }
          if (recentWines.length >= 20) break;
        }

        if (recentWines.length > 0) {
          wineContext = `\n\nThe user's recent wine tasting history (${recentWines.length} wines):\n`;
          recentWines.forEach((w, i) => {
            wineContext += `${i + 1}. ${w.name || 'Unnamed'} - ${w.type}${w.varietal ? ` (${w.varietal})` : ''}${w.year ? `, ${w.year}` : ''}`;
            if (w.winery) wineContext += ` at ${w.winery}`;
            if (w.rating) wineContext += ` - rated ${w.rating}/5`;
            if (w.flavors?.length) wineContext += ` - notes: ${w.flavors.join(', ')}`;
            if (w.notes) wineContext += ` - "${w.notes}"`;
            wineContext += '\n';
          });
        }
      }
    } catch (err) {
      console.log('Could not fetch wine history for context:', err.message);
    }

    return `You are an expert wine sommelier and a warm, knowledgeable companion for a wine tasting trip through France's Bordeaux region. You have deep expertise in:
- French wines, especially Bordeaux (Left Bank, Right Bank, appellations)
- Wine varietals, terroir, tasting notes, and food pairings
- Winery recommendations and regional wine culture
- Reading wine labels and identifying wines from photos

Your personality: Friendly, passionate about wine, and approachable. You avoid being pretentious. You give practical, memorable advice. When you identify a wine from a photo, be specific about what you see and what it tells you.

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

Only include the wine_suggestions block when you have specific wine information to suggest. Always include a conversational response before the block.${wineContext}`;
  },

  // Convert a local photo URI to base64 for the AI.
  // Reads the file directly with expo-file-system — fetch(localUri).blob()
  // returns an EMPTY blob for file:// URIs in Expo/RN, which sent the model a
  // blank image (it couldn't actually see the wine).
  async photoToBase64(uri) {
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
  async sendMessage(messages, systemPrompt = null) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

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

    // Use Supabase client's functions.invoke — handles auth headers automatically
    const { data, error } = await supabase.functions.invoke('chat', {
      body: {
        messages: cappedMessages,
        system_prompt: prompt,
      },
    });

    if (error) {
      console.error('Edge Function invoke error:', error.message);
      throw new Error(error.message || 'AI request failed');
    }

    // Edge Function now always returns 200, check for error in body
    if (data?.error) {
      console.error('AI error:', data.error);
      console.error('AI details:', data.details || 'none');
      throw new Error(`${data.error}: ${data.details || 'unknown'}`);
    }

    return data;
  },

  // Parse wine suggestions from AI response
  parseSuggestions(responseText) {
    const match = responseText.match(/```wine_suggestions\n([\s\S]*?)\n```/);
    if (!match) return null;

    try {
      return JSON.parse(match[1]);
    } catch {
      return null;
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

  // Get the conversational part of the response (without suggestions block)
  getDisplayText(responseText) {
    return responseText.replace(/```wine_suggestions\n[\s\S]*?\n```/, '').trim();
  },
};
