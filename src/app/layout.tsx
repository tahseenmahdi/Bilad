import type { Metadata } from 'next';
import './globals.css';
import { AtmosphereTransition } from '@/components/AtmosphereTransition';
export const metadata: Metadata = { title: 'Bilad | بلاد', description: 'Bilad — Malwiya Minaret of Samarra.', icons: { icon: '/icon.svg' } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body><AtmosphereTransition>{children}</AtmosphereTransition></body></html>; }
