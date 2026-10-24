import { useEffect, useRef, useState } from 'react';
import ConfirmDialog from '../components/ConfirmDialog';
import DragHandle from '../components/DragHandle';
import GameSettingsFields from '../components/GameSettingsFields';
import Scoreboard from '../components/Scoreboard';
import StickyActions from '../components/StickyActions';
import { MIN_PLAYERS, maxImposters } from '../game/setup';
import { useDragReorder } from '../hooks/useDragReorder';
import { he } from '../i18n/he';
import { shareRoom } from '../ui/share';
import ConnectionNotice from './ConnectionNotice';
import type { ConnectionStatus } from './connection';
import { formatCode, type PublicPlayer, type RoomSettings, type RoomState } from './protocol';

interface Props {
  state: RoomState;
  status: ConnectionStatus;
  allCategories: string[];
  onReorder: (playerIds: string[]) => void;
  onKick: (playerId: string) => void;
  onSettings: (settings: RoomSettings) => void;
  onStart: () => void;
  onResetScores: () => void;
  onAskLeave: () => void;
}

/** "כל הקטגוריות · מתחזה אחד · המתחזה לא מתחיל", בשביל מי שלא מארח */
function settingsSummary(settings: RoomSettings, playerCount: number): string {
  const imposters = Math.min(settings.imposterCount, maxImposters(playerCount));
  return [
    settings.categories.length === 0
      ? he.online.lobby.allCategories
      : settings.categories.length <= 2
        ? settings.categories.join(', ')
        : he.online.lobby.categories(settings.categories.length),
    he.setup.imposters(imposters),
    settings.imposterNeverStarts && he.online.lobby.imposterNeverStarts,
    settings.showCategory && he.online.lobby.showCategory,
    settings.secretVote && he.online.lobby.secretVote,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** הלובי: הקוד, קישור לשיתוף, מי בחדר לפי סדר הישיבה, וההגדרות. המארח מסדר, מוציא, בוחר הגדרות ומתחיל */
export default function LobbyScreen({
  state,
  status,
  allCategories,
  onReorder,
  onKick,
  onSettings,
  onStart,
  onResetScores,
  onAskLeave,
}: Props) {
  const isHost = state.hostId === state.you;
  // בזמן גרירה הרשימה זזה מיד אצלנו, והשרת מקבל את הסדר החדש בסוף הגרירה
  const [localOrder, setLocalOrder] = useState<PublicPlayer[] | null>(null);
  const [kickId, setKickId] = useState<string | null>(null);
  const [confirmStart, setConfirmStart] = useState(false);
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
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 3000);
    return () => clearTimeout(timer);
  }, [copied]);

  const share = async () => {
    if ((await shareRoom(state.code)) === 'copied') setCopied(true);
  };

  const offline = state.players.filter((player) => !player.connected);
  const enough = state.players.length >= MIN_PLAYERS;
  const start = () => (offline.length > 0 ? setConfirmStart(true) : onStart());

  const kickTarget = state.players.find((player) => player.id === kickId);

  return (
    <main className="screen">
      <div className="screen-body">
        <ConnectionNotice status={status} />

        <div className="room-code-card">
          <p className="muted">{isHost ? he.online.lobby.code : he.online.lobby.waitingTitle}</p>
          <p className="room-code" dir="ltr">
            {formatCode(state.code)}
          </p>
          {!isHost && <p className="help">{he.online.lobby.waitingHost}</p>}
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

        <Scoreboard players={state.players} scores={state.scores} onReset={isHost ? onResetScores : undefined} />

        {isHost ? (
          <>
            <GameSettingsFields
              settings={state.settings}
              playerCount={state.players.length}
              allCategories={allCategories}
              onChange={(change) => onSettings({ ...state.settings, ...change })}
            />
            <div className="field">
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={state.settings.secretVote}
                  onChange={(e) => onSettings({ ...state.settings, secretVote: e.target.checked })}
                />
                <span>{he.online.lobby.secretVote}</span>
              </label>
              <p className="help">{he.online.lobby.secretVoteHelp}</p>
            </div>
          </>
        ) : (
          <section className="field">
            <h2 className="label">{he.online.lobby.settings}</h2>
            <p className="help">{settingsSummary(state.settings, state.players.length)}</p>
          </section>
        )}
      </div>

      <StickyActions>
        {isHost && (
          <>
            {!enough && <p className="help center-text">{he.online.lobby.minPlayers(MIN_PLAYERS)}</p>}
            <button className="btn btn-primary" disabled={!enough} onClick={start}>
              {he.online.lobby.start}
            </button>
          </>
        )}
        <button className="btn btn-ghost" onClick={onAskLeave}>
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
      {confirmStart && (
        <ConfirmDialog
          message={he.online.lobby.offlineWarning(offline.map((player) => player.name).join(', '))}
          confirmLabel={he.online.lobby.startAnyway}
          cancelLabel={he.common.cancel}
          onConfirm={() => {
            setConfirmStart(false);
            onStart();
          }}
          onCancel={() => setConfirmStart(false)}
        />
      )}
    </main>
  );
}
