import { useEffect, useState } from 'react';
import ConfirmDialog from '../components/ConfirmDialog';
import GameSettingsFields from '../components/GameSettingsFields';
import type { GameMode } from '../components/ModeToggle';
import Scoreboard from '../components/Scoreboard';
import { MIN_PLAYERS } from '../game/setup';
import { he } from '../i18n/he';
import LocalSetupFields, { type LocalSetup } from '../screens/LocalSetupFields';
import NewGameScreen from '../screens/NewGameScreen';
import { roomUrl, shareRoom } from '../ui/share';
import ConnectionNotice from './ConnectionNotice';
import type { ConnectionStatus } from './connection';
import PlayerActions from './PlayerActions';
import { formatCode, type PublicPlayer, type RoomSettings, type RoomState } from './protocol';
import RoomQr from './RoomQr';
import SeatList from './SeatList';
import SecretVoteToggle from './SecretVoteToggle';

interface Props {
  state: RoomState;
  status: ConnectionStatus;
  mode: GameMode;
  onModeChange: (mode: GameMode) => void;
  local: LocalSetup;
  onReorder: (playerIds: string[]) => void;
  onKick: (playerId: string) => void;
  onTransfer: (playerId: string) => void;
  onSettings: (settings: RoomSettings) => void;
  onStart: () => void;
  /** משחק מקומי במקום החדר: החדר נסגר ומי שהצטרף מנותק */
  onStartLocal: () => void;
  onResetScores: () => void;
  onAskLeave: () => void;
}

/**
 * "משחק חדש" אצל המארח כשיש חדר פתוח.
 * במקוון: החדר, מי שהצטרף וההגדרות. במקומי: רשימת השמות של הטלפון האחד, והחדר נשאר פתוח ברקע עד שמתחילים
 */
export default function HostSetup({
  state,
  status,
  mode,
  onModeChange,
  local,
  onReorder,
  onKick,
  onTransfer,
  onSettings,
  onStart,
  onStartLocal,
  onResetScores,
  onAskLeave,
}: Props) {
  const [actionsFor, setActionsFor] = useState<PublicPlayer | null>(null);
  const [confirm, setConfirm] = useState<'offline' | 'close' | null>(null);
  const [copied, setCopied] = useState(false);
  // מי שרוצה שיסרקו ממנו פותח את הקוד. מוסתר בהתחלה, כדי לא לתפוס את רוב המסך
  const [showQr, setShowQr] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 3000);
    return () => clearTimeout(timer);
  }, [copied]);

  const share = async () => {
    if ((await shareRoom(state.code)) === 'copied') setCopied(true);
  };

  const others = state.players.filter((player) => player.id !== state.you);
  const offline = state.players.filter((player) => !player.connected);
  const enough = state.players.length >= MIN_PLAYERS;

  const start = () => {
    if (mode === 'local') return others.length > 0 ? setConfirm('close') : onStartLocal();
    return offline.length > 0 ? setConfirm('offline') : onStart();
  };

  const online = (
    <>
      <ConnectionNotice status={status} />
      <div className="room-code-card">
        <p className="muted">{he.online.lobby.code}</p>
        <p className="room-code" dir="ltr">
          {formatCode(state.code)}
        </p>
        {showQr && <RoomQr url={roomUrl(state.code)} label={he.online.lobby.qrLabel(formatCode(state.code))} />}
        <button className="btn btn-secondary" onClick={share}>
          {he.online.lobby.share}
        </button>
        <button className="link-btn" onClick={() => setShowQr(!showQr)}>
          {showQr ? he.online.lobby.hideQr : he.online.lobby.showQr}
        </button>
      </div>

      <section className="field">
        <h2 className="label">{he.online.lobby.players(state.players.length)}</h2>
        <p className="help">{he.online.lobby.hostHelp}</p>
        <SeatList
          players={state.players}
          you={state.you}
          hostId={state.hostId}
          canReorder
          onReorder={onReorder}
          onMore={setActionsFor}
        />
      </section>

      <Scoreboard players={state.players} scores={state.scores} onReset={onResetScores} />

      <GameSettingsFields
        settings={state.settings}
        playerCount={state.players.length}
        allCategories={local.allCategories}
        onChange={(change) => onSettings({ ...state.settings, ...change })}
      />
      <SecretVoteToggle checked={state.settings.secretVote} onChange={(secretVote) => onSettings({ ...state.settings, secretVote })} />
    </>
  );

  return (
    <NewGameScreen
      mode={mode}
      onModeChange={onModeChange}
      notice={mode === 'online' && !enough ? he.online.lobby.minPlayers(MIN_PLAYERS) : undefined}
      canStart={mode === 'local' || enough}
      onStart={start}
      onExit={onAskLeave}
      overlay={
        <>
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
          {confirm && (
            <ConfirmDialog
              message={
                confirm === 'close'
                  ? he.newGame.closeRoomConfirm
                  : he.online.lobby.offlineWarning(offline.map((player) => player.name).join(', '))
              }
              confirmLabel={confirm === 'close' ? he.newGame.closeRoomYes : he.online.lobby.startAnyway}
              cancelLabel={he.common.cancel}
              onConfirm={() => {
                setConfirm(null);
                if (confirm === 'close') onStartLocal();
                else onStart();
              }}
              onCancel={() => setConfirm(null)}
            />
          )}
        </>
      }
    >
      {mode === 'online' ? online : <LocalSetupFields local={local} />}
    </NewGameScreen>
  );
}
