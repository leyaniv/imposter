import { useState } from 'react';
import { he } from '../i18n/he';
import ConnectionNotice from './ConnectionNotice';
import type { ConnectionStatus } from './connection';
import PlayerActions from './PlayerActions';
import type { PublicPlayer, RoomState } from './protocol';
import SeatList from './SeatList';

interface Props {
  state: RoomState;
  status: ConnectionStatus;
  onReorder: (playerIds: string[]) => void;
  onTransfer: (playerId: string) => void;
  onKick: (playerId: string) => void;
  onClose: () => void;
}

/** יש הצבעה או ניחוש פתוחים: לא משנים סדר ולא מעבירים אירוח, כדי שהמסכים לא יזוזו באמצע */
export function roomBusy(state: RoomState): boolean {
  const round = state.round;
  return !!round && (!!round.vote || !!round.freeGuess || round.guessPending);
}

/** תפריט המארח באמצע סבב: סדר ישיבה, העברת אירוח והוצאת שחקן */
export default function HostMenu({ state, status, onReorder, onTransfer, onKick, onClose }: Props) {
  const [actionsFor, setActionsFor] = useState<PublicPlayer | null>(null);
  const busy = roomBusy(state);
  const inRound = new Set(state.round?.players.map((player) => player.id) ?? []);

  return (
    <main className="screen">
      <div className="screen-body">
        <ConnectionNotice status={status} />
        <h1 className="heading">{he.online.host.title}</h1>
        <section className="field">
          <h2 className="label">{he.online.host.seats}</h2>
          <p className={`help${busy ? ' warn' : ''}`}>{busy ? he.online.host.locked : he.online.host.seatsHelp}</p>
          <SeatList
            players={state.players}
            you={state.you}
            hostId={state.hostId}
            canReorder={!busy}
            onReorder={onReorder}
            onMore={setActionsFor}
            note={(player) => (state.round && !inRound.has(player.id) ? he.online.host.nextRound : undefined)}
          />
        </section>
      </div>

      <div className="screen-actions">
        <button className="btn btn-primary" onClick={onClose}>
          {he.online.host.back}
        </button>
      </div>

      {actionsFor && (
        <PlayerActions
          player={actionsFor}
          busy={busy}
          onTransfer={() => onTransfer(actionsFor.id)}
          onKick={() => onKick(actionsFor.id)}
          onClose={() => setActionsFor(null)}
        />
      )}
    </main>
  );
}
