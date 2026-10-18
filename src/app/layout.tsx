import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Bilad — A land of firsts', description: 'Rediscover Iraq. An immersive journey through Samarra, Babylon, Ur, Hatra and Erbil, with stories and a journey of your own.', icons: { icon: '/icon.svg' } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
