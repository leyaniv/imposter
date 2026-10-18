import { useState } from 'react';
import { CREW_POINTS, IMPOSTER_POINTS } from '../game/rules';
import type { Player } from '../game/types';
import { he } from '../i18n/he';
import { displayName } from '../ui/names';
import ConfirmDialog from './ConfirmDialog';

interface Props {
  /** לפי סדר הישיבה (בשביל "שחקן N" ובשביל סדר כשיש תיקו) */
  players: Player[];
  scores: Record<string, number>;
  /** כמה כל שחקן קיבל בסבב הזה */
  gains?: Record<string, number>;
  /** כותרת "ניקוד" בכרטיס. במסך הניקוד היא כבר כותרת המסך */
  showTitle?: boolean;
  onReset: () => void;
}

export function hasScores(players: readonly Player[], scores: Record<string, number>): boolean {
  return players.some((player) => (scores[player.id] ?? 0) > 0);
}

/** ניקוד מצטבר, מהגבוה לנמוך, עם מה שכל אחד קיבל עכשיו ואיפוס עם אישור */
export default function Scoreboard({ players, scores, gains = {}, showTitle = true, onReset }: Props) {
  const [confirmReset, setConfirmReset] = useState(false);
  const rows = players
    .map((player, index) => ({ player, index, score: scores[player.id] ?? 0 }))
    .sort((a, b) => b.score - a.score || a.index - b.index);

  if (!hasScores(players, scores)) return null;

  return (
    <section className="result-card scoreboard">
      <div className="label-row">
        {showTitle ? <h2 className="label">{he.scores.title}</h2> : <span />}
        <button className="link-btn" onClick={() => setConfirmReset(true)}>
          {he.scores.reset}
        </button>
      </div>
      <ol className="score-list">
        {rows.map(({ player, index, score }) => (
          <li key={player.id}>
            <span className="score-name">{displayName(player, index)}</span>
            {gains[player.id] && <span className="score-gain">{he.scores.gain(gains[player.id])}</span>}
            <span className="score-value">{score}</span>
          </li>
        ))}
      </ol>
      <p className="help">{he.scores.help(CREW_POINTS, IMPOSTER_POINTS)}</p>

      {confirmReset && (
        <ConfirmDialog
          message={he.scores.resetConfirm}
          confirmLabel={he.scores.resetYes}
          cancelLabel={he.common.cancel}
          onConfirm={() => {
            setConfirmReset(false);
            onReset();
          }}
          onCancel={() => setConfirmReset(false)}
        />
      )}
    </section>
  );
}
