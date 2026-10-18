import Scoreboard from '../components/Scoreboard';
import StickyActions from '../components/StickyActions';
import WordReport from '../components/WordReport';
import { roundPoints } from '../game/rules';
import type { Round, Winner, WordProblem } from '../game/types';
import { he } from '../i18n/he';
import { displayName } from '../ui/names';
import { winReasonText, winnerTitle } from '../ui/results';

interface Props {
  round: Round;
  scores: Record<string, number>;
  onSetWinner: (winner: Winner) => void;
  onResetScores: () => void;
  onReportWord: (problem: WordProblem) => void;
  onAgain: () => void;
  onNewGame: () => void;
}

export default function RoundEndScreen({
  round,
  scores,
  onSetWinner,
  onResetScores,
  onReportWord,
  onAgain,
  onNewGame,
}: Props) {
  const imposters = round.players
    .map((player, index) => ({ player, index }))
    .filter(({ player }) => round.imposterIds.includes(player.id));

  return (
    <main className="screen">
      <div className="screen-body center">
        <h1 className="heading">{he.roundEnd.title}</h1>

        {round.winner ? (
          <div className="winner-banner">
            <p className="winner-title">{winnerTitle(round)}</p>
            {winReasonText(round) && <p className="muted">{winReasonText(round)}</p>}
          </div>
        ) : (
          <div className="result-card">
            <p className="label">{he.roundEnd.whoWon}</p>
            <div className="actions-row">
              <button className="btn btn-secondary" onClick={() => onSetWinner('crew')}>
                {he.roundEnd.crew}
              </button>
              <button className="btn btn-secondary" onClick={() => onSetWinner('imposters')}>
                {he.roundEnd.imposterTeam(round.imposterIds.length)}
              </button>
            </div>
          </div>
        )}

        <div className="result-card">
          <p className="muted">{he.roundEnd.word}</p>
          <p className="reveal-word">{round.word}</p>
        </div>

        <div className="result-card">
          <p className="muted">{imposters.length > 1 ? he.roundEnd.imposters : he.roundEnd.imposter}</p>
          {imposters.map(({ player, index }) => (
            <div key={player.id} className="imposter-row">
              <p className="big-name">{displayName(player, index)}</p>
              <p className="muted">{he.roundEnd.hint(round.hints[player.id])}</p>
            </div>
          ))}
        </div>

        <Scoreboard players={round.players} scores={scores} gains={roundPoints(round)} onReset={onResetScores} />

        <div className="feedback">
          {!round.wordReported && <p className="help">{he.feedback.title}</p>}
          <WordReport reported={!!round.wordReported} onReport={onReportWord} />
        </div>
      </div>

      <StickyActions>
        <button className="btn btn-primary" onClick={onAgain}>
          {he.roundEnd.again}
        </button>
        <button className="btn btn-ghost" onClick={onNewGame}>
          {he.roundEnd.newGame}
        </button>
      </StickyActions>
    </main>
  );
}
