import type { WordProblem } from '../game/types';
import { he } from '../i18n/he';

interface Props {
  /** כבר דיווחו בסבב הזה */
  reported: boolean;
  onReport: (problem: WordProblem) => void;
}

/** שני כפתורים קטנים שמדווחים על מילה או רמז בעייתיים, כדי לשפר את המאגר */
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
      <button className="chip" onClick={() => onReport('unknown_word')}>
        {he.feedback.unknownWord}
      </button>
      <button className="chip" onClick={() => onReport('hint_too_strong')}>
        {he.feedback.hintTooStrong}
      </button>
    </div>
  );
}
