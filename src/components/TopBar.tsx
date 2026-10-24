import type { ReactNode } from 'react';
import { he } from '../i18n/he';

/** פס עליון עם כפתור יציאה מהמשחק, ואם צריך עוד כפתורים לפניו (למשל השתקה) */
export default function TopBar({ onExit, children }: { onExit: () => void; children?: ReactNode }) {
  return (
    <div className="top-bar">
      {children}
      <button className="icon-btn" aria-label={he.exit.button} onClick={onExit}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
