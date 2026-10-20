import type { Metadata } from 'next';
import AIGuide from '@/components/AIGuide';

export const metadata: Metadata = {
  title: 'Your AI Guide | Bilad',
  description: 'Discover Iraq with Bilad, your personal AI tourism guide.',
};

export default function AIPage() { return <AIGuide />; }
