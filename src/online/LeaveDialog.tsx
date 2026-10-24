import { useEffect, useRef, useState } from 'react';
import ConfirmDialog from '../components/ConfirmDialog';
import { he } from '../i18n/he';
import type { RoomState } from './protocol';

interface Props {
  state: RoomState;
  onLeave: (newHostId?: string) => void;
  onCancel: () => void;
}

/** ברירת המחדל: השחקן המחובר הבא בסדר הישיבה, כמו בשרת */
function defaultHost(state: RoomState): string | undefined {
  const index = state.players.findIndex((player) => player.id === state.you);
  const others = [...state.players.slice(index + 1), ...state.players.slice(0, Math.max(index, 0))].filter(
    (player) => player.id !== state.you,
  );
  return (others.find((player) => player.connected) ?? others[0])?.id;
}

/** "לצאת מהחדר?". המארח בוחר גם למי להעביר את האירוח */
export default function LeaveDialog({ state, onLeave, onCancel }: Props) {
  const others = state.players.filter((player) => player.id !== state.you);
  const [newHostId, setNewHostId] = useState(() => defaultHost(state));
  const cancelRef = useRef<HTMLButtonElement>(null);
  const isHost = state.hostId === state.you;

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  if (!isHost || others.length === 0) {
    return (
      <ConfirmDialog
        message={he.online.lobby.leaveConfirm}
        confirmLabel={he.online.lobby.leaveYes}
        cancelLabel={he.online.lobby.stay}
        onConfirm={() => onLeave()}
        onCancel={onCancel}
      />
    );
  }

  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <div
        className="dialog"
        role="alertdialog"
        aria-modal="true"
        aria-label={he.online.lobby.leaveConfirm}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="dialog-text">{he.online.lobby.leaveConfirm}</p>
        <p className="help">{he.online.host.leaveChoose}</p>
        <div className="host-choice" role="radiogroup" aria-label={he.online.host.leaveChoose}>
          {others.map((player) => (
            <label key={player.id} className="toggle host-option">
              <input
                type="radio"
                name="new-host"
                checked={newHostId === player.id}
                onChange={() => setNewHostId(player.id)}
              />
              <span className={player.connected ? undefined : 'muted'}>
                {player.name}
                {!player.connected && ` (${he.online.lobby.offline})`}
              </span>
            </label>
          ))}
        </div>
        <button className="btn btn-danger" onClick={() => onLeave(newHostId)}>
          {he.online.lobby.leaveYes}
        </button>
        <button ref={cancelRef} className="btn btn-ghost" onClick={onCancel}>
          {he.online.lobby.stay}
        </button>
      </div>
    </div>
  );
}
