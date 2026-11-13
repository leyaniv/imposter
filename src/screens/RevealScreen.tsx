import { useEffect, useRef, useState } from 'react';
import HoldToReveal from '../components/HoldToReveal';
import type { Round } from '../game/types';
import { he } from '../i18n/he';

/** מה שמוצג במסך החשיפה. בלי שאר הסבב, כדי שגם טלפון שמכיר רק את התפקיד שלו יוכל להציג אותו */
export interface ShownRole {
  imposter: boolean;
  /** המילה, או הרמז של המתחזה */
  text: string;
  /** רק כשכולם יודעים את הקטגוריה */
  category?: string;
}

/** התפקיד של שחקן בסבב, במצב הטלפון האחד */
export function roundRole(round: Round, playerIndex: number): ShownRole {
  const { id } = round.players[playerIndex];
  const imposter = round.imposterIds.includes(id);
  return {
    imposter,
    text: imposter ? round.hints[id] : round.word,
    category: round.showCategory ? round.category : undefined,
  };
}

/** כמה זמן צריך להחזיק בסך הכול כדי שזה ייחשב כמבט אמיתי, ולא נגיעה בטעות */
export const AUTO_CONTINUE_LOOK_MS = 1000;
/** כמה שניות אחרי השחרור ממשיכים לבד */
export const AUTO_CONTINUE_SECONDS = 3;

interface Props {
  role: ShownRole;
  doneLabel: string;
  onDone: () => void;
  /**
   * ממשיכים לבד כמה שניות אחרי שהשחקן הסתכל ושחרר. רק במשחק המקוון: שם לכל אחד יש טלפון משלו,
   * והכפתור רק אומר "אני מוכן". בטלפון אחד הכפתור שומר על הסוד לפני שמעבירים, ולכן שם לוחצים בעצמם.
   */
  autoContinue?: boolean;
}

/**
 * המסך של המתחזה בנוי בדיוק כמו המסך של שחקן רגיל, כדי שאי אפשר יהיה לזהות אותו ממבט מהצד.
 * בשורה הגדולה המתחזה רואה את התפקיד שלו ולא את הרמז, כדי שלא יחשוב שהרמז הוא המילה הסודית.
 */
export default function RevealScreen({ role, doneLabel, onDone, autoContinue = false }: Props) {
  const [seen, setSeen] = useState(false);
  // כמה שניות נשארו עד שממשיכים לבד. null: אין ספירה
  const [countdown, setCountdown] = useState<number | null>(null);
  // מתחלף בכל ספירה חדשה, כדי שפס המילוי יתחיל מההתחלה
  const [countdownId, setCountdownId] = useState(0);
  const heldMs = useRef(0);
  const heldSince = useRef<number | null>(null);
  const done = useRef(false);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    onDone();
  };

  const onHeldChange = (held: boolean) => {
    if (!autoContinue) return;
    if (held) {
      // מציצים שוב: הספירה מתבטלת, ותתחיל מחדש בשחרור הבא
      heldSince.current = Date.now();
      setCountdown(null);
      return;
    }
    if (heldSince.current === null) return;
    heldMs.current += Date.now() - heldSince.current;
    heldSince.current = null;
    if (heldMs.current >= AUTO_CONTINUE_LOOK_MS) {
      setCountdown(AUTO_CONTINUE_SECONDS);
      setCountdownId((id) => id + 1);
    }
  };

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      finish();
      return;
    }
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const counting = countdown !== null && countdown > 0;

  return (
    <main className="screen no-select">
      <div className="screen-body center">
        <HoldToReveal onFirstReveal={() => setSeen(true)} onHeldChange={onHeldChange}>
          {role.category && <p className="category-tag">{he.category(role.category)}</p>}
          {role.imposter ? (
            <>
              <p className="reveal-label">{he.reveal.imposterLabel}</p>
              <p className="reveal-word">{he.reveal.imposterRole}</p>
              <p className="reveal-footer">
                {he.reveal.imposterHint} <span className="reveal-hint">{role.text}</span>
              </p>
            </>
          ) : (
            <>
              <p className="reveal-label">{he.reveal.crewLabel}</p>
              <p className="reveal-word">{role.text}</p>
              <p className="reveal-footer">{he.reveal.crewFooter}</p>
            </>
          )}
        </HoldToReveal>
      </div>
      <div className="screen-actions">
        <button className={`btn btn-primary${counting ? ' btn-countdown' : ''}`} disabled={!seen} onClick={finish}>
          {counting && (
            <span
              key={countdownId}
              className="btn-countdown-fill"
              style={{ animationDuration: `${AUTO_CONTINUE_SECONDS}s` }}
              aria-hidden="true"
            />
          )}
          <span className="btn-label">
            {!seen ? he.reveal.lookFirst : counting ? he.reveal.autoContinue(countdown) : doneLabel}
          </span>
        </button>
      </div>
    </main>
  );
}
