import { useEffect, useRef, useState } from 'react';
import ConfirmDialog from '../components/ConfirmDialog';
import DragHandle from '../components/DragHandle';
import StickyActions from '../components/StickyActions';
import { MIN_PLAYERS } from '../game/setup';
import { useDragReorder } from '../hooks/useDragReorder';
import { he } from '../i18n/he';
import { shareRoom } from '../ui/share';
import type { ConnectionStatus } from './connection';
import { formatCode, type PublicPlayer, type RoomState } from './protocol';

interface Props {
  state: RoomState;
  status: ConnectionStatus;
  /** עולה בכל לחיצה על "חזרה" בטלפון: שואלים אם לצאת מהחדר */
  leaveRequests: number;
  onReorder: (playerIds: string[]) => void;
  onKick: (playerId: string) => void;
  onLeave: () => void;
}

/** הלובי: הקוד, קישור לשיתוף, ומי בחדר לפי סדר הישיבה. המארח מסדר ומוציא שחקנים */
export default function LobbyScreen({ state, status, leaveRequests, onReorder, onKick, onLeave }: Props) {
  const isHost = state.hostId === state.you;
  // בזמן גרירה הרשימה זזה מיד אצלנו, והשרת מקבל את הסדר החדש בסוף הגרירה
  const [localOrder, setLocalOrder] = useState<PublicPlayer[] | null>(null);
  const [kickId, setKickId] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [copied, setCopied] = useState(false);

  const players = localOrder ?? state.players;
  const { rowRef, handleProps, rowProps, dragging } = useDragReorder(players, setLocalOrder, (list) =>
    onReorder(list.map((player) => player.id)),
  );

  // הגיע מצב חדש מהשרת (הסדר שנשלח, או שינוי של מישהו אחר): מציגים אותו. באמצע גרירה ממשיכים עם הסדר המקומי
  const draggingRef = useRef(dragging);
  draggingRef.current = dragging;
  useEffect(() => {
    if (!draggingRef.current) setLocalOrder(null);
  }, [state.players]);

  useEffect(() => {
    if (leaveRequests > 0) setConfirmLeave(true);
  }, [leaveRequests]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 3000);
    return () => clearTimeout(timer);
  }, [copied]);

  const share = async () => {
    if ((await shareRoom(state.code)) === 'copied') setCopied(true);
  };

  const kickTarget = state.players.find((player) => player.id === kickId);

  return (
    <main className="screen">
      <div className="screen-body">
        {status !== 'open' && (
          <p className="notice connection-notice" role="status">
            {status === 'connecting' ? he.online.connecting : he.online.reconnecting}
          </p>
        )}

        <div className="room-code-card">
          <p className="muted">{he.online.lobby.code}</p>
          <p className="room-code" dir="ltr">
            {formatCode(state.code)}
          </p>
          <button className="btn btn-secondary" onClick={share}>
            {he.online.lobby.share}
          </button>
        </div>

        <section className="field">
          <h2 className="label">{he.online.lobby.players(players.length)}</h2>
          <p className="help">{isHost ? he.online.lobby.hostHelp : he.online.lobby.guestHelp}</p>
          <ol className="name-list lobby-list">
            {players.map((player, i) => (
              <li key={player.id} ref={rowRef(player.id)} {...rowProps(player.id)}>
                {isHost && <DragHandle label={he.setup.movePlayer(player.name)} {...handleProps(player.id, i)} />}
                <span className="name-index">{i + 1}</span>
                <span className={`lobby-name${player.connected ? '' : ' offline'}`}>{player.name}</span>
                {player.id === state.you && <span className="badge">{he.online.lobby.you}</span>}
                {player.id === state.hostId && <span className="badge badge-accent">{he.online.lobby.host}</span>}
                {!player.connected && <span className="badge badge-muted">{he.online.lobby.offline}</span>}
                {isHost && player.id !== state.you && (
                  <button
                    className="icon-btn remove-btn"
                    aria-label={he.online.lobby.kick(player.name)}
                    onClick={() => setKickId(player.id)}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M7 7l10 10M17 7L7 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                )}
              </li>
            ))}
          </ol>
        </section>
      </div>

      <StickyActions>
        {isHost && (
          <>
            <p className="help center-text">
              {players.length < MIN_PLAYERS ? he.online.lobby.minPlayers(MIN_PLAYERS) : he.online.lobby.comingSoon}
            </p>
            <button className="btn btn-primary" disabled>
              {he.online.lobby.start}
            </button>
          </>
        )}
        <button className="btn btn-ghost" onClick={() => setConfirmLeave(true)}>
          {he.online.lobby.leave}
        </button>
      </StickyActions>

      <p className={`toast${copied ? ' toast-on' : ''}`} role="status">
        {copied ? he.online.lobby.linkCopied : ''}
      </p>

      {kickTarget && (
        <ConfirmDialog
          message={he.online.lobby.kickConfirm(kickTarget.name)}
          confirmLabel={he.online.lobby.kickYes}
          cancelLabel={he.common.cancel}
          onConfirm={() => {
            onKick(kickTarget.id);
            setKickId(null);
          }}
          onCancel={() => setKickId(null)}
        />
      )}
      {confirmLeave && (
        <ConfirmDialog
          message={he.online.lobby.leaveConfirm}
          confirmLabel={he.online.lobby.leaveYes}
          cancelLabel={he.online.lobby.stay}
          onConfirm={onLeave}
          onCancel={() => setConfirmLeave(false)}
        />
      )}
    </main>
  );
}
