import TopBar from '../components/TopBar';
import { he } from '../i18n/he';
import ConnectionNotice from './ConnectionNotice';
import type { ConnectionStatus } from './connection';
import GuessMarker from './GuessMarker';
import MuteButton from './MuteButton';
import type { RoomState, RoundState } from './protocol';

interface Props {
  state: RoomState;
  round: RoundState;
  status: ConnectionStatus;
  onMark: (correct: boolean) => void;
  onCancel: () => void;
  onAskLeave: () => void;
}

/** ניחוש חופשי: המתחזה אומר ניחוש בקול. נכון = ניצחון למתחזים, שגוי = ניצחון לשחקנים */
export default function FreeGuessOnline({ state, round, status, onMark, onCancel, onAskLeave }: Props) {
  const startedHere = round.freeGuess?.startedBy === state.you;

  return (
    <main className="screen">
      <TopBar onExit={onAskLeave}>
        <MuteButton />
      </TopBar>
      <div className="screen-body center">
        <ConnectionNotice status={status} />
        <h1 className="heading">{he.guess.freeTitle}</h1>
        <p className="muted">{he.guess.freeText}</p>
        <p className="label">{he.guess.freeAsk}</p>
      </div>
      <div className="screen-actions">
        <GuessMarker rightLabel={he.guess.freeRight(round.imposterCount)} wrongLabel={he.guess.freeWrong} onMark={onMark} />
        {startedHere && (
          <button className="btn btn-ghost" onClick={onCancel}>
            {he.online.guess.cancel}
          </button>
        )}
      </div>
    </main>
  );
}
