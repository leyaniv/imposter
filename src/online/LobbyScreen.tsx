import { useEffect, useState } from 'react';
import ConfirmDialog from '../components/ConfirmDialog';
import GameSettingsFields from '../components/GameSettingsFields';
import Scoreboard from '../components/Scoreboard';
import StickyActions from '../components/StickyActions';
import { MIN_PLAYERS, maxImposters } from '../game/setup';
import { he } from '../i18n/he';
import { shareRoom } from '../ui/share';
import ConnectionNotice from './ConnectionNotice';
import type { ConnectionStatus } from './connection';
import PlayerActions from './PlayerActions';
import { formatCode, type PublicPlayer, type RoomSettings, type RoomState } from './protocol';
import SeatList from './SeatList';

interface Props {
  state: RoomState;
  status: ConnectionStatus;
  allCategories: string[];
  onReorder: (playerIds: string[]) => void;
  onKick: (playerId: string) => void;
  onTransfer: (playerId: string) => void;
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
  onTransfer,
  onSettings,
  onStart,
  onResetScores,
  onAskLeave,
}: Props) {
  const isHost = state.hostId === state.you;
  const [actionsFor, setActionsFor] = useState<PublicPlayer | null>(null);
  const [confirmStart, setConfirmStart] = useState(false);
  const [copied, setCopied] = useState(false);

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
          <h2 className="label">{he.online.lobby.players(state.players.length)}</h2>
          <p className="help">{isHost ? he.online.lobby.hostHelp : he.online.lobby.guestHelp}</p>
          <SeatList
            players={state.players}
            you={state.you}
            hostId={state.hostId}
            canReorder={isHost}
            onReorder={onReorder}
            onMore={isHost ? setActionsFor : undefined}
          />
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

      {actionsFor && (
        <PlayerActions
          player={actionsFor}
          busy={false}
          onTransfer={() => onTransfer(actionsFor.id)}
          onKick={() => onKick(actionsFor.id)}
          onClose={() => setActionsFor(null)}
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
