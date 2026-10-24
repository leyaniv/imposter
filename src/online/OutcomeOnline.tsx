import type { ReactNode } from 'react';
import { he } from '../i18n/he';
import ConnectionNotice from './ConnectionNotice';
import type { ConnectionStatus } from './connection';
import GuessMarker from './GuessMarker';
import type { RoomState, RoundState } from './protocol';

interface Props {
  state: RoomState;
  round: RoundState;
  status: ConnectionStatus;
  onMark: (correct: boolean) => void;
  onContinue: () => void;
  /** הפס העליון: השתקה, ניהול החדר ויציאה (RoomBar) */
  bar: ReactNode;
}

/** אחרי הדחה: "X... המתחזה!" או "לא המתחזה", ניחוש אחרון, ו"ממשיכים" (כמו OutcomeScreen בטלפון האחד) */
export default function OutcomeOnline({ state, round, status, onMark, onContinue, bar }: Props) {
  const revealed = round.revealed!;
  const name = round.players.find((player) => player.id === revealed.playerId)?.name ?? '';
  const result = round.lastVote?.targetId === revealed.playerId ? round.lastVote : undefined;
  const moreImposters = round.caughtIds.length < round.imposterCount;

  const actions = round.guessPending ? (
    revealed.playerId === state.you ? null : (
      <GuessMarker key={round.caughtIds.length} rightLabel={he.guess.right} wrongLabel={he.guess.wrong} onMark={onMark} />
    )
  ) : (
    <button className="btn btn-primary" onClick={onContinue}>
      {he.outcome.backToGame}
    </button>
  );

  return (
    <main className="screen">
      {bar}
      <div className="screen-body center">
        <ConnectionNotice status={status} />
        {result && <p className="muted">{he.online.vote.count(result.yes, result.no)}</p>}
        <p className="big-name pop">{name}</p>
        <p className={`outcome-tag${revealed.imposter ? ' outcome-imposter' : ''}`}>
          {revealed.imposter ? he.outcome.imposter : he.outcome.notImposter}
        </p>

        {round.guessPending ? (
          <>
            <h1 className="heading">{he.guess.lastTitle}</h1>
            <p className="muted">{he.guess.lastText}</p>
            <p className="label">{revealed.playerId === state.you ? he.online.guess.guesser : he.guess.ask}</p>
          </>
        ) : (
          <>
            {revealed.imposter && <p className="muted">{he.outcome.wrongGuess}</p>}
            {revealed.imposter && moreImposters && <p className="notice">{he.outcome.oneMoreImposter}</p>}
            <p className="muted">{he.outcome.goOn}</p>
          </>
        )}
      </div>
      {actions && <div className="screen-actions">{actions}</div>}
    </main>
  );
}
