import type { Metadata } from 'next';
import { existsSync } from 'node:fs';
import path from 'node:path';
import SayIt from '@/components/SayIt';
import { expressions } from '@/lib/expressions';

export const metadata: Metadata = {
  title: 'Say it in Iraq | Bilad',
  description: 'Everyday Iraqi Arabic for greetings, food, shopping, taxi rides, and shared moments. Explore clear English meanings and spoken audio.',
};

export default function SayItPage() {
  // Resolve recordings at build time so the static site never offers missing files.
  const recordings: Record<string, string> = {};
  for (const phrase of expressions) {
    if (existsSync(path.join(process.cwd(), 'public', 'audio', 'expressions', `${phrase.id}.mp3`))) {
      recordings[phrase.id] = `/audio/expressions/${phrase.id}.mp3`;
    }
  }
  return <SayIt recordings={recordings} />;
}
