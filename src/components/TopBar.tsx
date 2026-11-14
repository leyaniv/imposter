import type { ReactNode } from 'react';
import { he } from '../i18n/he';
import SettingsButton from './SettingsButton';
import type { SettingsFrom } from './SettingsProvider';

interface Props {
  onExit: () => void;
  /** לקורא מסך. ברירת המחדל: "יציאה מהמשחק" */
  exitLabel?: string;
  /** מאיזה מסך פתחו את ההגדרות, לסטטיסטיקה */
  settingsFrom?: SettingsFrom;
  /** עוד כפתורים לפני ההגדרות (למשל השתקה), או כותרת */
  children?: ReactNode;
  /** top-bar-titled: כשהכותרת של המסך בתוך הפס */
  className?: string;
}

/** פס עליון עם הגדרות ו-X ליציאה, ואם צריך עוד כפתורים או כותרת לפניהם */
export default function TopBar({ onExit, exitLabel = he.exit.button, settingsFrom = 'game', children, className }: Props) {
  return (
    <div className={className ? `top-bar ${className}` : 'top-bar'}>
      {children}
      <SettingsButton from={settingsFrom} />
      <button className="icon-btn" aria-label={exitLabel} onClick={onExit}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
