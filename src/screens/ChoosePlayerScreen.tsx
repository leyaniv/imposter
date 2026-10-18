import type { Player } from '../game/types';
import { he } from '../i18n/he';
import { displayName } from '../ui/names';

interface Props {
  players: Player[];
  onChoose: (index: number) => void;
  onCancel: () => void;
}

export default function ChoosePlayerScreen({ players, onChoose, onCancel }: Props) {
  return (
    <main className="screen">
      <div className="screen-body">
        <h1 className="heading">{he.forgot.title}</h1>
        <p className="help">{he.forgot.help}</p>
        <div className="player-grid">
          {players.map((player, i) => (
            <button key={player.id} className="btn btn-secondary" onClick={() => onChoose(i)}>
              {displayName(player, i)}
            </button>
          ))}
        </div>
      </div>
      <div className="screen-actions">
        <button className="btn btn-ghost" onClick={onCancel}>
          {he.common.cancel}
        </button>
      </div>
    </main>
  );
}
