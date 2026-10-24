import { useState } from 'react';
import ConfirmDialog from '../components/ConfirmDialog';
import { he } from '../i18n/he';

interface Props {
  rightLabel: string;
  wrongLabel: string;
  onMark: (correct: boolean) => void;
}

/**
 * "נכון" ו"שגוי" לניחוש שנאמר בקול. אחרי סימון מחכים שהשרת יעדכן.
 * 🔒 מופיע גם אצל מתחזה שעוד לא נתפס (השרת מתעלם מהסימון שלו), כדי שהמסך שלו ייראה כמו של כולם.
 */
export default function GuessMarker({ rightLabel, wrongLabel, onMark }: Props) {
  const [confirm, setConfirm] = useState<boolean | null>(null);
  const [marked, setMarked] = useState(false);

  if (marked) {
    return (
      <p className="muted" role="status">
        {he.online.guess.waiting}
      </p>
    );
  }

  return (
    <>
      <button className="btn btn-primary" onClick={() => setConfirm(true)}>
        {rightLabel}
      </button>
      <button className="btn btn-secondary" onClick={() => setConfirm(false)}>
        {wrongLabel}
      </button>
      {confirm !== null && (
        <ConfirmDialog
          message={he.online.guess.markConfirm(confirm)}
          confirmLabel={he.online.guess.markYes}
          cancelLabel={he.common.cancel}
          onConfirm={() => {
            setMarked(true);
            setConfirm(null);
            onMark(confirm);
          }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  );
}
