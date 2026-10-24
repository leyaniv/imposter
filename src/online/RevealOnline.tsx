import { useEffect, useState } from 'react';
import { he } from '../i18n/he';
import RevealScreen, { type ShownRole } from '../screens/RevealScreen';
import ConnectionNotice from './ConnectionNotice';
import type { ConnectionStatus } from './connection';
import type { RoomState, RoundState } from './protocol';

/** התפקיד כפי שמסך החשיפה מציג אותו */
export function shownRole(round: RoundState): ShownRole | null {
  if (!round.role) return null;
  return {
    imposter: round.role.kind === 'imposter',
    text: round.role.kind === 'imposter' ? round.role.hint : round.role.word,
    category: round.category,
  };
}

interface Props {
  state: RoomState;
  round: RoundState;
  status: ConnectionStatus;
  onSeen: () => void;
  onSkip: () => void;
}

/** כל טלפון מציג את התפקיד שלו. אחרי "ראיתי" ממתינים לשאר, והמארח יכול להמשיך בלי לחכות */
export default function RevealOnline({ state, round, status, onSeen, onSkip }: Props) {
  const role = shownRole(round)!;
  // מיד אחרי הלחיצה עוברים למסך ההמתנה, בלי לחכות לתשובה מהשרת
  const [seenHere, setSeenHere] = useState(false);
  const seen = seenHere || round.seenIds.includes(state.you);

  // "ראיתי" נשלח כשהחיבור היה מנותק: שולחים שוב כשהוא חוזר
  useEffect(() => {
    if (seenHere && status === 'open' && !round.seenIds.includes(state.you)) onSeen();
  }, [status]);

  if (!seen) {
    return (
      <RevealScreen
        role={role}
        doneLabel={he.online.round.done}
        onDone={() => {
          setSeenHere(true);
          onSeen();
        }}
      />
    );
  }

  const waiting = round.players.filter((player) => !round.seenIds.includes(player.id) && !round.leftIds.includes(player.id));
  return (
    <main className="screen">
      <div className="screen-body center">
        <ConnectionNotice status={status} />
        <h1 className="heading">{he.online.round.waitingTitle}</h1>
        {waiting.length > 0 && (
          <>
            <p className="muted">{he.online.round.waitingFor}</p>
            <p className="label">{waiting.map((player) => player.name).join(', ')}</p>
          </>
        )}
      </div>
      {state.hostId === state.you && (
        <div className="screen-actions">
          <button className="btn btn-secondary" onClick={onSkip}>
            {he.online.round.skip}
          </button>
        </div>
      )}
    </main>
  );
}
