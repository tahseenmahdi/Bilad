import type { Metadata } from 'next';
import AIGuide from '@/components/AIGuide';

export const metadata: Metadata = {
  title: 'Your Iraq Guide | Bilad',
  description: 'Discover Iraq with Bilad’s local travel guide.',
};

export default function AIPage() { return <AIGuide />; }
