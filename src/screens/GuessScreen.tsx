import type { ReactNode } from 'react';
import TopBar from '../components/TopBar';
import { he } from '../i18n/he';

interface Props {
  /** מה שמוצג מעל הכותרת, למשל מי הודח */
  before?: ReactNode;
  title: string;
  text: string;
  /** ברירת מחדל: "שומעים את הניחוש בקול. הוא נכון?" */
  ask?: string;
  /** ברירת מחדל: "הניחוש נכון" / "הניחוש שגוי" */
  rightLabel?: string;
  wrongLabel?: string;
  onAnswer: (correct: boolean) => void;
  onCancel?: () => void;
  onExit?: () => void;
}

/** המתחזה אומר את הניחוש בקול, והשחקנים (שיודעים את המילה) מסמנים אם הוא נכון */
export default function GuessScreen({
  before,
  title,
  text,
  ask = he.guess.ask,
  rightLabel = he.guess.right,
  wrongLabel = he.guess.wrong,
  onAnswer,
  onCancel,
  onExit,
}: Props) {
  return (
    <main className="screen">
      {onExit && <TopBar onExit={onExit} />}
      <div className="screen-body center">
        {before}
        <h1 className="heading">{title}</h1>
        <p className="muted">{text}</p>
        <p className="label">{ask}</p>
      </div>
      <div className="screen-actions">
        <button className="btn btn-primary" onClick={() => onAnswer(true)}>
          {rightLabel}
        </button>
        <button className="btn btn-secondary" onClick={() => onAnswer(false)}>
          {wrongLabel}
        </button>
        {onCancel && (
          <button className="btn btn-ghost" onClick={onCancel}>
            {he.common.cancel}
          </button>
        )}
      </div>
    </main>
  );
}
