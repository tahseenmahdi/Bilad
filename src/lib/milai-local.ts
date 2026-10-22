import { answerTouristQuestion } from './tourist-guide.ts';
import { applyMilaiCommand, type Trip } from './trip-planner.ts';

const tripCommand = /\b(plan|build|add|include|remove|skip|drop|clear|reset|start over|show nearby|find nearby|nearby|nearest|optimi[sz]e|reorder|shorter|longer|more time|less time|half a day|half day|full day|one way|round trip)\b/i;

export type LocalGuideResponse = { reply: string; placeIds: string[]; serviceIds: string[] };
export type LocalMilaiResult = {
  response: LocalGuideResponse;
  trip: Trip;
  changed: boolean;
  openMap: 'nearby' | 'trip' | null;
};

export function answerMilaiLocally(question: string, current: Trip): LocalMilaiResult {
  if (tripCommand.test(question)) {
    const command = applyMilaiCommand(question, current);
    const openMap = command.changed ? 'trip' : /\b(nearby|nearest)\b/i.test(question) && command.recommendations.length ? 'nearby' : null;
    return {
      response: { reply: command.message, placeIds: command.recommendations, serviceIds: [] },
      trip: command.trip,
      changed: command.changed,
      openMap,
    };
  }

  const answer = answerTouristQuestion(question);
  return {
    response: { reply: answer.message, placeIds: answer.recommendations, serviceIds: [] },
    trip: current,
    changed: false,
    openMap: null,
  };
}
