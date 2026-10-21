import type { Metadata } from 'next';
import './globals.css';
import { AtmosphereTransition } from '@/components/AtmosphereTransition';
import JourneyProvider from '@/components/JourneyProvider';
export const metadata: Metadata = { title: 'Bilad | بلاد', description: 'Bilad — Malwiya Minaret of Samarra.', icons: { icon: '/icon.svg' } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body><JourneyProvider><AtmosphereTransition>{children}</AtmosphereTransition></JourneyProvider></body></html>; }
