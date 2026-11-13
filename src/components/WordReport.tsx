import type { WordProblem } from '../game/types';
import { he } from '../i18n/he';

interface Props {
  /** כבר דיווחו בסבב הזה */
  reported: boolean;
  onReport: (problem: WordProblem) => void;
}

/** כפתורים קטנים שמדווחים על מילה או רמז בעייתיים, כדי לשפר את המאגר */
export default function WordReport({ reported, onReport }: Props) {
  if (reported) {
    return (
      <p className="help" role="status">
        {he.feedback.thanks}
      </p>
    );
  }

  return (
    <div className="chips">
      <button className="chip" onClick={() => onReport('word_too_hard')}>
        {he.feedback.wordTooHard}
      </button>
      <button className="chip" onClick={() => onReport('hint_too_strong')}>
        {he.feedback.hintTooStrong}
      </button>
      <button className="chip" onClick={() => onReport('hint_too_far')}>
        {he.feedback.hintTooFar}
      </button>
    </div>
  );
}
