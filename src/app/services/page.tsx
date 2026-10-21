import type { Metadata } from 'next';
import ServicesBrowser from '@/components/ServicesBrowser';

export const metadata: Metadata = {
  title: 'Daleel | Bilad',
  description: 'Daleel by Bilad — find taxi, delivery, and mobile internet apps for your time in Iraq.',
};

export default function ServicesPage() { return <ServicesBrowser />; }
