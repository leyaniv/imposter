import Scoreboard, { hasScores } from '../components/Scoreboard';
import StickyActions from '../components/StickyActions';
import type { Player } from '../game/types';
import { he } from '../i18n/he';

interface Props {
  players: Player[];
  scores: Record<string, number>;
  onReset: () => void;
  onBack: () => void;
}

/** הניקוד של הערב, בלי להתחיל או לסיים סבב */
export default function ScoresScreen({ players, scores, onReset, onBack }: Props) {
  return (
    <main className="screen">
      <div className="screen-body">
        <h1 className="heading">{he.scores.title}</h1>
        {hasScores(players, scores) ? (
          <Scoreboard players={players} scores={scores} showTitle={false} onReset={onReset} />
        ) : (
          <p className="muted">{he.scores.empty}</p>
        )}
      </div>
      <StickyActions>
        <button className="btn btn-primary" onClick={onBack}>
          {he.scores.back}
        </button>
      </StickyActions>
    </main>
  );
}
