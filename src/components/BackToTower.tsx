import { AtmosphereLink } from './AtmosphereTransition';
import './back-to-tower.css';

export default function BackToTower({ href }: { href: string }) {
  return (
    <AtmosphereLink href={href} className="back-to-tower tower-return">
      <svg className="tower-return-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5m5-5-5 5 5 5" /></svg>
      <span>Back to the tower</span>
      <span className="tower-return-emblem" aria-hidden="true">
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 21h16M6 18h12v3H6zM8 14h9v4M10 10h6v4M12 6h3v4M13 3v3" /><path d="m8 17 9-3M10 13l6-3M12 9l3-3" /></svg>
      </span>
    </AtmosphereLink>
  );
}
