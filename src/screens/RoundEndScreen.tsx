import type { Round } from '../game/types';
import { he } from '../i18n/he';
import { displayName } from '../ui/names';

interface Props {
  round: Round;
  onAgain: () => void;
  onNewGame: () => void;
}

export default function RoundEndScreen({ round, onAgain, onNewGame }: Props) {
  const imposters = round.players
    .map((player, index) => ({ player, index }))
    .filter(({ player }) => round.imposterIds.includes(player.id));

  return (
    <main className="screen">
      <div className="screen-body center">
        <h1 className="heading">{he.roundEnd.title}</h1>

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
      </div>

      <div className="screen-actions">
        <button className="btn btn-primary" onClick={onAgain}>
          {he.roundEnd.again}
        </button>
        <button className="btn btn-ghost" onClick={onNewGame}>
          {he.roundEnd.newGame}
        </button>
      </div>
    </main>
  );
}
