import { places } from './destinations.ts';

export type TouristReply = { message: string; recommendations: string[] };

const normalize = (text: string) => text.toLowerCase().replace(/[-’']/g, ' ').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
const contains = (text: string, phrase: string) => (` ${text} `).includes(` ${normalize(phrase)} `);
const visitTime = (minutes: number) => minutes < 60 ? `${minutes} minutes` : `${Math.floor(minutes / 60)}${minutes % 60 ? ` hour ${minutes % 60} minutes` : minutes === 60 ? ' hour' : ' hours'}`;

export function answerTouristQuestion(input: string): TouristReply {
  const text = normalize(input);
  const matches = places.filter(place => place.aliases.some(alias => contains(text, alias)) || contains(text, place.name));
  if (matches.length) {
    return {
      message: matches.slice(0, 3).map(place => `${place.name} in ${place.region}: ${place.brief} Allow about ${visitTime(place.visitMinutes)} to explore.`).join(' '),
      recommendations: matches.slice(0, 3).map(place => place.id),
    };
  }

  const category = /\b(nature|mountain|mountains|waterfall|waterfalls|lake|lakes|marsh|marshes)\b/.test(text) ? 'nature'
    : /\b(culture|cultural|books|book|cafes|cafe|art|arts|religion|religious)\b/.test(text) ? 'culture'
      : /\b(history|historic|historical|ancient|heritage|archaeology|archaeological)\b/.test(text) ? 'history'
        : null;
  if (category) {
    const recommendations = places.filter(place => place.category === category).slice(0, 3);
    return {
      message: `${category === 'nature' ? 'For landscapes and outdoor discoveries' : category === 'culture' ? 'For living culture and local stories' : 'For Iraq’s long history and heritage'}, start with ${recommendations.map(place => place.name).join(', ')}. Open any place to read its story and see it on the map.`,
      recommendations: recommendations.map(place => place.id),
    };
  }

  if (/\b(arabic|language|phrase|phrases|speak|say|hello|thank|thanks)\b/.test(text)) {
    return { message: 'I can help you get comfortable with Iraqi Arabic. Open “Say it in Iraq” for useful greetings, taxi phrases, dining words, and audio-friendly pronunciation prompts.', recommendations: [] };
  }
  if (/\b(taxi|transport|ride|rides|internet|sim|service|services)\b/.test(text)) {
    return { message: 'For practical travel services, Daleel collects local taxi, delivery, and internet options in one place. Availability can vary by city, so check the provider before relying on it.', recommendations: [] };
  }
  if (/\b(plan|trip|itinerary|route|day)\b/.test(text)) {
    return { message: 'I can help with a timed itinerary in the map planner. Open the map when you want to choose a starting point, build a route, or save a journey.', recommendations: [] };
  }
  if (/\b(safe|safety|open|opening|hours|access|ticket|tickets|visa|weather)\b/.test(text)) {
    return { message: 'Travel conditions, access, opening hours, tickets, weather, and entry requirements can change. Use the destination stories for context, then confirm current details with the site, local authorities, or your host before travelling.', recommendations: [] };
  }

  return { message: 'Ask me about Iraqi places, history, culture, nature, useful phrases, or travel services. When you want to build and save an itinerary, open the map planner.', recommendations: [] };
}
