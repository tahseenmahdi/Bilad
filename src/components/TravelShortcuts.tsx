import { AtmosphereLink } from './AtmosphereTransition';
import TaxiIcon from './TaxiIcon';
import './travel-shortcuts.css';

const shortcuts = {
  taxi: { href: '/services/#taxi', title: 'Hire a taxi', description: 'Find a ride with Daleel', icon: <TaxiIcon /> },
  phrases: { href: '/say-it/#taxi', title: 'Talk to your driver', description: 'Useful Iraqi Arabic for the ride', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d="M5 17H3V5h18v12H10l-5 4v-4Z"/><path d="M7 9h10M7 13h6"/></svg> },
  planner: { href: '/ai/#map', title: 'Back to your trip', description: 'Continue exploring your day', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5ZM9 3v16M15 5v16"/></svg> },
};

export default function TravelShortcuts({ context }: { context: 'planner' | 'services' | 'phrases' }) {
  const items = context === 'planner' ? ['taxi', 'phrases'] as const : context === 'services' ? ['planner', 'phrases'] as const : ['taxi', 'planner'] as const;
  return <nav className="travel-shortcuts" aria-label="Continue your journey">{items.map(id => {
    const item = shortcuts[id];
    return <AtmosphereLink key={id} href={item.href} className="travel-shortcut"><span className="travel-shortcut-icon">{item.icon}</span><span className="travel-shortcut-copy"><strong>{item.title}</strong><small>{item.description}</small></span><span className="travel-shortcut-arrow" aria-hidden="true">↗</span></AtmosphereLink>;
  })}</nav>;
}
