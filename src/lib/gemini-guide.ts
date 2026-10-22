import type { GuideContext, GuideResponse } from './ai-guide';
import { guideRequestContext, GUIDE_LIMITS } from './ai-guide';
import type { Trip } from './trip-planner';

export type GeminiGuideResult = {
  response: GuideResponse;
  fallback: boolean;
};

/**
 * Call the Gemini-powered guide API route.
 * Returns the structured GuideResponse from the model.
 */
export async function askGeminiGuide(
  message: string,
  trip: Trip,
  focused: string | null,
  history: { role: 'user' | 'assistant'; text: string }[],
  journey?: { id: string; title: string; status: 'idea' | 'planned' | 'done' },
): Promise<GeminiGuideResult> {
  const context = guideRequestContext(message, trip, focused, journey);

  const res = await fetch('/api/guide', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: message.slice(0, GUIDE_LIMITS.message),
      history: history.slice(-GUIDE_LIMITS.history).map(h => ({
        role: h.role,
        text: h.text.slice(0, 1000),
      })),
      context,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Network error' }));
    throw new Error(body.error ?? `Guide API error (${res.status})`);
  }

  const response: GuideResponse = await res.json();
  return { response, fallback: false };
}
