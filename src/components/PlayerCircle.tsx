import type { Player } from '../game/types';
import { he } from '../i18n/he';
import { displayName } from '../ui/names';
import { hasScores } from './Scoreboard';

interface Props {
  players: Player[];
  highlightIndex: number;
  /** ההגרלה נחתה על מי שמתחיל */
  landed?: boolean;
  eliminatedIds?: readonly string[];
  /** ניקוד הערב ליד כל שם (לא מוצג כשלאף אחד אין נקודות) */
  scores?: Record<string, number>;
  /** כשמוגדר, אפשר ללחוץ על שחקנים שעוד במשחק */
  onSelect?: (index: number) => void;
}

/** השחקנים במעגל לפי סדר הישיבה: שחקן 1 למעלה, והשאר עם כיוון השעון */
export default function PlayerCircle({ players, highlightIndex, landed, eliminatedIds = [], scores, onSelect }: Props) {
  const radius = 40; // אחוזים מגודל הריבוע
  const showScores = !!scores && hasScores(players, scores);

  return (
    <div className={`player-circle${players.length > 8 ? ' compact' : ''}${showScores ? ' with-scores' : ''}`}>
      <svg className="clockwise-arrow" viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          <marker id="arrowhead" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M0 0 L10 5 L0 10 z" fill="currentColor" />
          </marker>
        </defs>
        <path
          d="M50 22 A28 28 0 1 1 25.75 36"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          markerEnd="url(#arrowhead)"
        />
      </svg>

      {players.map((player, i) => {
        const angle = (2 * Math.PI * i) / players.length;
        const style = { left: `${50 + radius * Math.sin(angle)}%`, top: `${50 - radius * Math.cos(angle)}%` };
        const out = eliminatedIds.includes(player.id);
        const className = [
          'seat',
          i === highlightIndex && !out ? 'seat-active' : '',
          i === highlightIndex && landed ? 'landed' : '',
          out ? 'seat-out' : '',
          onSelect && !out ? 'seat-button' : '',
        ]
          .filter(Boolean)
          .join(' ');
        const label = (
          <>
            <span className="seat-name">{displayName(player, i)}</span>
            {showScores && <span className="seat-score">{he.scores.points(scores[player.id] ?? 0)}</span>}
          </>
        );

        return onSelect && !out ? (
          <button key={player.id} className={className} style={style} onClick={() => onSelect(i)}>
            {label}
          </button>
        ) : (
          <span key={player.id} className={className} style={style}>
            {label}
          </span>
        );
      })}
    </div>
  );
}
