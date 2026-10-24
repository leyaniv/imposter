import { useEffect, useRef, useState } from 'react';
import ConfirmDialog from '../components/ConfirmDialog';
import { he } from '../i18n/he';
import type { PublicPlayer } from './protocol';

interface Props {
  player: PublicPlayer;
  /** יש הצבעה או ניחוש פתוחים: אי אפשר להעביר אירוח עכשיו */
  busy: boolean;
  onTransfer: () => void;
  onKick: () => void;
  onClose: () => void;
}

/** מה המארח יכול לעשות עם שחקן: להעביר לו את האירוח, או להוציא אותו מהחדר. כל אחד עם אישור */
export default function PlayerActions({ player, busy, onTransfer, onKick, onClose }: Props) {
  const [confirm, setConfirm] = useState<'transfer' | 'kick' | null>(null);
  const firstRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (confirm) {
    return (
      <ConfirmDialog
        message={confirm === 'transfer' ? he.online.host.transferConfirm(player.name) : he.online.lobby.kickConfirm(player.name)}
        confirmLabel={confirm === 'transfer' ? he.online.host.transferYes : he.online.lobby.kickYes}
        cancelLabel={he.common.cancel}
        onConfirm={() => {
          if (confirm === 'transfer') onTransfer();
          else onKick();
          onClose();
        }}
        onCancel={() => setConfirm(null)}
      />
    );
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label={player.name} onClick={(e) => e.stopPropagation()}>
        <p className="dialog-text">{player.name}</p>
        <button ref={firstRef} className="btn btn-secondary" disabled={busy} onClick={() => setConfirm('transfer')}>
          {he.online.host.transfer}
        </button>
        {busy && <p className="help center-text">{he.online.host.busy}</p>}
        <button className="btn btn-secondary" onClick={() => setConfirm('kick')}>
          {he.online.host.kick}
        </button>
        <button className="btn btn-ghost" onClick={onClose}>
          {he.common.cancel}
        </button>
      </div>
    </div>
  );
}
