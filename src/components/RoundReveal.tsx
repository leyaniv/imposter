import type { ReactNode } from 'react';
import type { WinReason, Winner } from '../game/types';
import { he } from '../i18n/he';

interface Props {
  winner?: Winner;
  winReason?: WinReason;
  word: string;
  imposters: { id: string; name: string; hint: string }[];
  /** אנימציה להכרזת המנצח (במשחק המקוון היא מופיעה בבת אחת אצל כולם) */
  pop?: boolean;
  /** כשעוד אין מנצח: מה שמופיע מתחת לכותרת "סוף הסבב", למשל "למי הניצחון?" */
  noWinner?: ReactNode;
}

/**
 * החלק העליון של סוף הסבב: מי ניצח ולמה, עם שמות המתחזים בתוך ההכרזה, והמילה עם הרמז שלה.
 * כשאין מנצח (סיום ידני בטלפון אחד, או מתחזה שיצא מהחדר) נשארות הכותרת "סוף הסבב" וכרטיס המתחזים.
 */
export default function RoundReveal({ winner, winReason, word, imposters, pop, noWinner }: Props) {
  const count = imposters.length;
  const names = imposters.map(({ name }) => name).join(' ו');
  const reason = winReason ? he.winner.reason[winReason](count) : '';
  // למילה עם רמז אחד, שני המתחזים מקבלים אותו רמז
  const sameHint = imposters.every(({ hint }) => hint === imposters[0]?.hint);

  return (
    <>
      {winner ? (
        <div className={`winner-banner${pop ? ' pop' : ''}`}>
          <h1 className="winner-title">{winner === 'crew' ? he.winner.crew : he.winner.imposters(count)}</h1>
          {winner === 'crew' ? (
            winReason === 'allCaught' ? (
              <p className="muted">{he.winner.caught(count, names)}</p>
            ) : (
              <>
                {reason && <p className="muted">{reason}</p>}
                <p className="winner-imposters">{he.roundEnd.imposterLine(count, names)}</p>
              </>
            )
          ) : (
            // המתחזים ניצחו: אולי אף אחד עוד לא יודע מי הם, אז השם גדול
            <>
              <p className="winner-names">{names}</p>
              {reason && <p className="muted">{reason}</p>}
            </>
          )}
        </div>
      ) : (
        <>
          <h1 className="heading">{he.roundEnd.title}</h1>
          {noWinner}
        </>
      )}

      <div className="result-card">
        <p className="muted">{he.roundEnd.word}</p>
        <p className="reveal-word">{word}</p>
        <p className="muted">
          {!sameHint
            ? he.roundEnd.hintsWere(imposters.map(({ name, hint }) => `${hint} (${name})`).join(', '))
            : he.roundEnd.hintWas(imposters[0]?.hint ?? '')}
        </p>
      </div>

      {!winner && (
        <div className="result-card">
          <p className="muted">{count > 1 ? he.roundEnd.imposters : he.roundEnd.imposter}</p>
          {imposters.map(({ id, name }) => (
            <p key={id} className="big-name">
              {name}
            </p>
          ))}
        </div>
      )}
    </>
  );
}
