import type { ReactNode } from 'react';
import RoundReveal from '../components/RoundReveal';
import Scoreboard from '../components/Scoreboard';
import StickyActions from '../components/StickyActions';
import WordReport from '../components/WordReport';
import { CAUGHT_IMPOSTER_POINTS, IMPOSTER_POINTS } from '../game/rules';
import type { WordProblem } from '../game/types';
import { he } from '../i18n/he';
import ConnectionNotice from './ConnectionNotice';
import type { ConnectionStatus } from './connection';
import type { RoomState, RoundState } from './protocol';
import ScoringBreakdown from './ScoringBreakdown';

interface Props {
  state: RoomState;
  round: RoundState;
  status: ConnectionStatus;
  reported: boolean;
  onReport: (problem: WordProblem) => void;
  onNext: () => void;
  onLobby: () => void;
  onResetScores: () => void;
  /** הפס העליון: השתקה, ניהול החדר, הגדרות ויציאה (RoomBar) */
  bar: ReactNode;
}

/** סוף הסבב: המילה, המתחזים והרמזים שלהם. המארח ממשיך לסבב נוסף או חוזר ללובי */
export default function RoundEndOnline({
  state,
  round,
  status,
  reported,
  onReport,
  onNext,
  onLobby,
  onResetScores,
  bar,
}: Props) {
  const reveal = round.reveal!;
  const isHost = state.hostId === state.you;
  const nameOf = (id: string) => round.players.find((player) => player.id === id)?.name ?? '';

  return (
    <main className="screen">
      {bar}
      <div className="screen-body center">
        <ConnectionNotice status={status} />
        <RoundReveal
          winner={reveal.winner}
          winReason={reveal.winReason}
          word={reveal.word}
          imposters={reveal.imposters.map(({ id, hint }) => ({ id, name: nameOf(id), hint }))}
          pop
          noWinner={
            reveal.imposterLeft && <p className="notice">{he.online.round.imposterLeft(reveal.imposters.length)}</p>
          }
        />

        <Scoreboard
          players={state.players}
          scores={state.scores}
          gains={reveal.points}
          onReset={isHost ? onResetScores : undefined}
          help={he.scores.helpOnline(IMPOSTER_POINTS, CAUGHT_IMPOSTER_POINTS)}
        />
        <ScoringBreakdown round={round} you={state.you} />

        <div className="feedback">
          {!reported && <p className="help">{he.feedback.title}</p>}
          <WordReport reported={reported} onReport={onReport} />
        </div>
      </div>

      <StickyActions>
        {/* יציאה מהחדר: ב-X שבפס העליון */}
        {isHost ? (
          <div className="actions-row">
            <button className="btn btn-primary" onClick={onNext}>
              {he.roundEnd.again}
            </button>
            <button className="btn btn-secondary" onClick={onLobby}>
              {he.online.round.toLobby}
            </button>
          </div>
        ) : (
          <p className="help center-text">{he.online.round.waitHost}</p>
        )}
      </StickyActions>
    </main>
  );
}
