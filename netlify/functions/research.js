import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const SYSTEM = `You are a sales intelligence analyst specializing in the promotional products industry. \
Your client is a headwear and apparel supplier looking to prioritize distributor relationships. \
Research the given distributor thoroughly using web search, then return a single valid JSON object \
— no markdown fences, no explanation, just the raw JSON.`;

function buildPrompt(name) {
  return `Research the promotional products distributor "${name}" and return a JSON profile with exactly these fields:

{
  "name": "official company name as publicly listed",
  "location": "primary city and state (e.g. Oshkosh, WI)",
  "founded": "founding year or approximate decade",
  "size": "small" | "mid" | "large",
  "volume": "estimated annual promotional products spend (e.g. $2M–$5M)",
  "reps": "estimated sales rep count as a number or range (e.g. 8–12)",
  "tier": "High" | "Mid" | "Low",
  "specialty": "primary focus or niche (e.g. Corporate apparel, Safety products)",
  "categories": ["array", "of", "product", "categories", "they", "buy"],
  "geography": ["array", "of", "states", "or", "regions", "served"],
  "summary": "2–3 sentence overview: market position, what they're known for, and any notable clients or verticals",
  "online": "their website URL plus a brief note on social media activity (LinkedIn, Instagram, etc.)"
}

Tier rating (for a headwear and apparel supplier):
- High: Large-volume distributor, actively sources headwear/apparel, 20+ reps, broad geography
- Mid: Medium volume, some apparel focus, 5–20 reps, regional reach
- Low: Small volume, minimal apparel focus, under 5 reps, or very niche/local

Search the web for accurate, current information. Return ONLY the JSON object.`;
}

function extractJson(text) {
  // Strip markdown code fences if present
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const match = stripped.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON object found in model response');
  return JSON.parse(match[0]);
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let name, webSearch;
  try {
    ({ name, webSearch } = JSON.parse(event.body));
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  if (!name?.trim()) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Distributor name is required' }) };
  }

  try {
    const messages = [{ role: 'user', content: buildPrompt(name.trim()) }];
    let finalText = null;

    // If webSearch is off, skip the agentic loop entirely — one direct call
    if (!webSearch) {
      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 4096,
        system: SYSTEM,
        messages,
      });
      const textBlock = response.content.find((b) => b.type === 'text');
      finalText = textBlock?.text ?? null;
    }

    // Agentic loop — runs until the model stops using tools (web search mode)
    for (let turn = 0; turn < 2 && finalText === null; turn++) {
      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 4096,
        system: SYSTEM,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages,
      });

      if (response.stop_reason === 'end_turn') {
        const textBlock = response.content.find((b) => b.type === 'text');
        if (textBlock) finalText = textBlock.text;
        break;
      }

      if (response.stop_reason === 'tool_use') {
        // Add the assistant turn to history
        messages.push({ role: 'assistant', content: response.content });

        // Return tool results so the model can continue
        const toolResults = response.content
          .filter((b) => b.type === 'tool_use')
          .map((b) => ({
            type: 'tool_result',
            tool_use_id: b.id,
            // For web_search_20250305, Anthropic executes the search server-side;
            // pass back any content the block carries, or a safe fallback.
            content:
              Array.isArray(b.content) && b.content.length
                ? b.content
                : 'Search executed.',
          }));

        if (toolResults.length) {
          messages.push({ role: 'user', content: toolResults });
        }
      }
    }

    if (!finalText) {
      return {
        statusCode: 500,
        headers: CORS,
        body: JSON.stringify({ error: 'Model did not return a text response' }),
      };
    }

    const profile = extractJson(finalText);

    // Attach runtime metadata
    profile.id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    profile.researchedAt = new Date().toISOString();
    profile.notes = '';

    return { statusCode: 200, headers: CORS, body: JSON.stringify(profile) };
  } catch (err) {
    console.error('[research] error:', err);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: err.message ?? 'Internal server error' }),
    };
  }
};
