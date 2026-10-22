import { guidePlaceIndex, validateGuideRequest, validateGuideResponse, GUIDE_LIMITS } from '@/lib/ai-guide';
import { serviceApps } from '@/lib/services';
import { origins } from '@/lib/destinations';

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

function buildSystemPrompt(): string {
  const placeIndex = guidePlaceIndex();
  const placeList = placeIndex.map(p => `• ${p.id}: ${p.name} (${p.arabic}) — ${p.region} — ${p.category}`).join('\n');
  const originList = origins.map(o => `• ${o.id}: ${o.name}`).join('\n');
  const serviceList = serviceApps.map(s => `• ${s.id}: ${s.name} — ${s.brief}`).join('\n');

  return `You are Milai, the friendly and knowledgeable local tour guide for Bilad — an Iraqi travel discovery platform. You speak warmly, like a well-traveled friend who loves sharing Iraq's stories. Keep replies concise (under ${GUIDE_LIMITS.reply} characters).

## Your knowledge base

### Places in Iraq you can reference (use exact IDs):
${placeList}

### Starting cities (origins):
${originList}

### Travel services:
${serviceList}

## Response format

You MUST respond with a single valid JSON object matching this exact schema — no markdown, no wrapping, just raw JSON:

{
  "reply": "Your conversational response text (max ${GUIDE_LIMITS.reply} chars)",
  "placeIds": ["array", "of", "place", "ids"],
  "serviceIds": ["array", "of", "service", "ids"],
  "actions": []
}

Rules for the response:
- "reply": A warm, informative answer. Use the place data above for accuracy. Mention specific places by name when relevant.
- "placeIds": Up to 6 place IDs from the list above that are relevant to the answer. These will be shown as clickable cards.
- "serviceIds": Up to 3 service IDs if the question involves transport, food delivery, or connectivity.
- "actions": An array of actions. You may include UP TO ${GUIDE_LIMITS.actions} actions. Supported action types:
  - {"type": "focus_place", "placeId": "<id>"} — highlight a place on the map
  - {"type": "nearby", "reference": "start"|"destination", "placeId": "<optional id>"} — show nearby places
  - {"type": "build_day", "originId": "<optional>", "minutes": <optional 60-720>, "category": "<optional: all|history|nature|culture>", "roundTrip": <optional boolean>} — build an itinerary
  - {"type": "add_stop", "placeId": "<id>"} — add a stop to the trip
  - {"type": "remove_stop", "placeId": "<id>"} — remove a stop
  - {"type": "reorder_stops", "stopIds": ["ordered","ids"]} — reorder stops
  - {"type": "save_trip"} — save the current trip
  - {"type": "complete_journey", "journeyId": "<id>"} — mark a journey complete
  - {"type": "recommend_service", "serviceId": "<id>"} — recommend a service

Action rules:
- Only include trip-editing actions (build_day, add_stop, remove_stop, reorder_stops) when the user EXPLICITLY asks to plan, build, add, remove, or reorder.
- Only include save_trip when the user EXPLICITLY asks to save/store.
- Only include complete_journey when the user EXPLICITLY asks to mark/complete/finish a journey.
- At most ONE write action (trip edits, save, or complete) per response.
- If no actions are needed, use an empty array [].
- NEVER invent place or service IDs. Only use IDs from the lists above.

## Context

The user's message may come with context about their active trip (origin, stops, time budget, category) and currently focused place. Use this to give contextual answers.

## Personality

- Be warm, enthusiastic, and genuine about Iraq
- Share cultural insights and practical tips
- When recommending places, explain WHY they're special
- If asked about safety, hours, or access: provide context but remind the user to confirm details locally
- You can understand and respond in both English and Arabic
- Keep responses focused and helpful — you're a guide, not a textbook`;
}

let cachedSystemPrompt: string | null = null;

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: 'Gemini API key is not configured. Set GEMINI_API_KEY in .env.local.' },
      { status: 500 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  let guideRequest;
  try {
    guideRequest = validateGuideRequest(body);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Invalid request format.' },
      { status: 400 }
    );
  }

  // Build conversation messages for Gemini
  const contents: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];

  // Add chat history
  for (const turn of guideRequest.history) {
    contents.push({
      role: turn.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: turn.text }],
    });
  }

  // Add current message with context
  let userMessage = guideRequest.message;
  if (guideRequest.context.trip || guideRequest.context.focusedPlaceId || guideRequest.context.journey) {
    userMessage += '\n\n[Context for this question — do not repeat this back to the user]\n';
    if (guideRequest.context.trip) {
      const t = guideRequest.context.trip;
      userMessage += `Active trip: origin=${t.origin?.name ?? 'none'}, minutes=${t.minutes}, category=${t.category}, stops=[${t.stopIds.join(',')}], roundTrip=${t.roundTrip}\n`;
    }
    if (guideRequest.context.focusedPlaceId) {
      userMessage += `Currently focused place: ${guideRequest.context.focusedPlaceId}\n`;
    }
    if (guideRequest.context.journey) {
      const j = guideRequest.context.journey;
      userMessage += `Saved journey: id=${j.id}, title=${j.title}, status=${j.status}\n`;
    }
  }

  contents.push({ role: 'user', parts: [{ text: userMessage }] });

  // Cache the system prompt (it's expensive to build)
  if (!cachedSystemPrompt) cachedSystemPrompt = buildSystemPrompt();

  try {
    const geminiBody = JSON.stringify({
      contents,
      systemInstruction: { parts: [{ text: cachedSystemPrompt }] },
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json',
      },
    });

    // Retry with backoff for transient Gemini errors (overloaded, rate-limited)
    const MAX_RETRIES = 2;
    let response: Response | null = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: geminiBody,
      });

      if (response.ok || ![429, 500, 502, 503].includes(response.status)) break;
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
      }
    }

    if (!response!.ok) {
      const errorBody = await response!.text();
      console.error('Gemini API error:', response!.status, errorBody);
      return Response.json(
        { error: `Gemini API returned ${response!.status}. ${response!.status === 503 || response!.status === 429 ? 'The API is temporarily overloaded. Please try again in a moment.' : 'Check your API key and quota.'}` },
        { status: 502 }
      );
    }

    const geminiResult = await response!.json();
    const text = geminiResult?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      const finishReason = geminiResult?.candidates?.[0]?.finishReason;
      if (finishReason === 'SAFETY') {
        return Response.json(
          { error: 'The response was blocked by safety filters. Try rephrasing your question.' },
          { status: 422 }
        );
      }
      return Response.json(
        { error: 'Gemini returned an empty response.' },
        { status: 502 }
      );
    }

    // Parse and validate the model's JSON output
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Model sometimes wraps JSON in markdown — try to extract it
      const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (match) {
        parsed = JSON.parse(match[1]);
      } else {
        // Last resort: return the text as a plain reply
        return Response.json({
          reply: text.slice(0, GUIDE_LIMITS.reply),
          placeIds: [],
          serviceIds: [],
          actions: [],
        });
      }
    }

    // Validate the response against our schema
    let validated;
    try {
      validated = validateGuideResponse(parsed, guideRequest);
    } catch (err) {
      // Validation failed — return the reply text but strip invalid actions
      const raw = parsed as Record<string, unknown>;
      return Response.json({
        reply: typeof raw.reply === 'string' ? raw.reply.slice(0, GUIDE_LIMITS.reply) : text.slice(0, GUIDE_LIMITS.reply),
        placeIds: [],
        serviceIds: [],
        actions: [],
      });
    }

    return Response.json(validated);
  } catch (err) {
    console.error('Guide API error:', err);
    return Response.json(
      { error: err instanceof Error ? err.message : 'Failed to reach Gemini.' },
      { status: 500 }
    );
  }
}
