// lib/ai.js - AI service for Wine Sommelier
// Builds system prompt with user wine context, calls Edge Function
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

  // Convert a local photo URI to base64
  async photoToBase64(uri) {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          // reader.result is like "data:image/jpeg;base64,/9j/4AAQ..."
          const dataUrl = reader.result;
          const base64 = dataUrl.split(',')[1];
          const mimeMatch = dataUrl.match(/data:(.*?);/);
          const mediaType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
          resolve({ base64, mediaType });
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
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

  // Get the conversational part of the response (without suggestions block)
  getDisplayText(responseText) {
    return responseText.replace(/```wine_suggestions\n[\s\S]*?\n```/, '').trim();
  },
};
