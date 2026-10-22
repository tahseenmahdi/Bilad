import type { GuideResponse } from './ai-guide';
import { guideRequestContext, GUIDE_LIMITS, validateGuideRequest, validateGuideResponse } from './ai-guide';
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
  const request = validateGuideRequest({
    message,
    history: history.slice(-GUIDE_LIMITS.history).map(h => ({ role: h.role, text: h.text.slice(0, 1000) })),
    context,
  });

  const res = await fetch('/api/guide', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Network error' }));
    throw new Error(typeof body?.error?.message === 'string' ? body.error.message : `Milai’s AI service returned ${res.status}. Please retry.`);
  }

  const body: unknown = await res.json();
  if (!body || typeof body !== 'object' || !('success' in body) || body.success !== true || !('data' in body)) throw new Error('Milai’s AI service returned an invalid response. Please retry.');
  const response: GuideResponse = validateGuideResponse(body.data, request);
  return { response, fallback: false };
}
