import { createGuideHandler } from '../../../lib/server/guide-api';

export const runtime = 'nodejs';
const handle = createGuideHandler();

export async function POST(request: Request) {
  return handle(request);
}
