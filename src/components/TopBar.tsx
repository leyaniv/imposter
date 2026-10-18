import { he } from '../i18n/he';

/** פס עליון עם כפתור יציאה מהמשחק */
export default function TopBar({ onExit }: { onExit: () => void }) {
  return (
    <div className="top-bar">
      <button className="icon-btn" aria-label={he.exit.button} onClick={onExit}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
