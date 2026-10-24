import StickyActions from '../components/StickyActions';
import WordReport from '../components/WordReport';
import type { WordProblem } from '../game/types';
import { he } from '../i18n/he';
import ConnectionNotice from './ConnectionNotice';
import type { ConnectionStatus } from './connection';
import type { RoomState, RoundState } from './protocol';

interface Props {
  state: RoomState;
  round: RoundState;
  status: ConnectionStatus;
  reported: boolean;
  onReport: (problem: WordProblem) => void;
  onNext: () => void;
  onLobby: () => void;
  onAskLeave: () => void;
}

/** סוף הסבב: המילה, המתחזים והרמזים שלהם. המארח ממשיך לסבב נוסף או חוזר ללובי */
export default function RoundEndOnline({ state, round, status, reported, onReport, onNext, onLobby, onAskLeave }: Props) {
  const reveal = round.reveal!;
  const isHost = state.hostId === state.you;
  const nameOf = (id: string) => round.players.find((player) => player.id === id)?.name ?? '';

  return (
    <main className="screen">
      <div className="screen-body center">
        <ConnectionNotice status={status} />
        <h1 className="heading">{he.roundEnd.title}</h1>
        {reveal.imposterLeft && <p className="notice">{he.online.round.imposterLeft(reveal.imposters.length)}</p>}

        <div className="result-card">
          <p className="muted">{he.roundEnd.word}</p>
          <p className="reveal-word">{reveal.word}</p>
        </div>

        <div className="result-card">
          <p className="muted">{reveal.imposters.length > 1 ? he.roundEnd.imposters : he.roundEnd.imposter}</p>
          {reveal.imposters.map(({ id, hint }) => (
            <div key={id} className="imposter-row">
              <p className="big-name">{nameOf(id)}</p>
              <p className="muted">{he.roundEnd.hint(hint)}</p>
            </div>
          ))}
        </div>

        <div className="feedback">
          {!reported && <p className="help">{he.feedback.title}</p>}
          <WordReport reported={reported} onReport={onReport} />
        </div>
      </div>

      <StickyActions>
        {isHost ? (
          <>
            <button className="btn btn-primary" onClick={onNext}>
              {he.roundEnd.again}
            </button>
            <button className="btn btn-secondary" onClick={onLobby}>
              {he.online.round.toLobby}
            </button>
          </>
        ) : (
          <p className="help center-text">{he.online.round.waitHost}</p>
        )}
        <button className="btn btn-ghost" onClick={onAskLeave}>
          {he.online.lobby.leave}
        </button>
      </StickyActions>
    </main>
  );
}
