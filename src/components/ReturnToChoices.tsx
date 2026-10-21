import './return-to-choices.css';

export default function ReturnToChoices({ label, onClick, compact = false }: { label: string; onClick: () => void; compact?: boolean }) {
  return (
    <button type="button" className={`return-to-choices${compact ? ' return-to-choices-compact' : ''}`} onClick={onClick}>
      <span className="return-to-choices-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 7-5 5 5 5M4 12h10a5 5 0 0 0 5-5" /></svg>
      </span>
      <span className="return-to-choices-label">{label}</span>
      <span className="return-to-choices-grid" aria-hidden="true"><i /><i /><i /><i /></span>
    </button>
  );
}
