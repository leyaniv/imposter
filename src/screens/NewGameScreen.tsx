import type { ReactNode } from 'react';
import ModeToggle, { type GameMode } from '../components/ModeToggle';
import StickyActions from '../components/StickyActions';
import { he } from '../i18n/he';

interface Props {
  mode: GameMode;
  onModeChange: (mode: GameMode) => void;
  /** מה שמתחת לבורר: שחקנים והגדרות (מקומי), או החדר (מקוון) */
  children: ReactNode;
  /** למשל "צריך לפחות 3 שחקנים" */
  notice?: string;
  canStart: boolean;
  onStart: () => void;
  onExit: () => void;
  /** הודעות, חלונות ועוד שמוצגים מעל המסך */
  overlay?: ReactNode;
}

/** מסך "משחק חדש": אותו מסך למשחק מקומי ולמקוון, וההבדל הוא רק מה שמתחת לבורר */
export default function NewGameScreen({ mode, onModeChange, children, notice, canStart, onStart, onExit, overlay }: Props) {
  return (
    <main className="screen">
      <div className="screen-body">
        <h1 className="heading">{he.newGame.title}</h1>
        <ModeToggle mode={mode} onChange={onModeChange} />
        {children}
      </div>

      <StickyActions>
        {notice && <p className="help center-text">{notice}</p>}
        <button className="btn btn-primary" disabled={!canStart} onClick={onStart}>
          {he.newGame.start}
        </button>
        <button className="btn btn-ghost" onClick={onExit}>
          {he.newGame.exit}
        </button>
      </StickyActions>

      {overlay}
    </main>
  );
}
