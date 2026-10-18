import type { Player } from '../game/types';
import { displayName } from '../ui/names';

interface Props {
  players: Player[];
  highlightIndex: number;
}

/** השחקנים במעגל לפי סדר הישיבה: שחקן 1 למעלה, והשאר עם כיוון השעון */
export default function PlayerCircle({ players, highlightIndex }: Props) {
  const radius = 40; // אחוזים מגודל הריבוע

  return (
    <div className={`player-circle${players.length > 8 ? ' compact' : ''}`}>
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
        const left = 50 + radius * Math.sin(angle);
        const top = 50 - radius * Math.cos(angle);
        return (
          <span
            key={player.id}
            className={`seat${i === highlightIndex ? ' seat-active' : ''}`}
            style={{ left: `${left}%`, top: `${top}%` }}
          >
            {displayName(player, i)}
          </span>
        );
      })}
    </div>
  );
}
