import { useEffect, useState } from 'react';
import Scoreboard from '../components/Scoreboard';
import StickyActions from '../components/StickyActions';
import { maxImposters } from '../game/setup';
import { he } from '../i18n/he';
import { roomUrl, shareRoom } from '../ui/share';
import ConnectionNotice from './ConnectionNotice';
import type { ConnectionStatus } from './connection';
import { formatCode, type RoomSettings, type RoomState } from './protocol';
import RoomQr from './RoomQr';
import SeatList from './SeatList';

interface Props {
  state: RoomState;
  status: ConnectionStatus;
  onAskLeave: () => void;
}

/** "כל הקטגוריות · מתחזה אחד · המתחזה לא מתחיל" */
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

/** הלובי של מי שהצטרף: ממתינים שהמארח יתחיל. רואים מי בחדר, את ההגדרות, ואפשר לשתף את הקישור. המארח רואה את HostSetup */
export default function LobbyScreen({ state, status, onAskLeave }: Props) {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 3000);
    return () => clearTimeout(timer);
  }, [copied]);

  const share = async () => {
    if ((await shareRoom(state.code)) === 'copied') setCopied(true);
  };

  return (
    <main className="screen">
      <div className="screen-body">
        <ConnectionNotice status={status} />

        <div className="room-code-card">
          <p className="muted">{he.online.lobby.waitingTitle}</p>
          <p className="room-code" dir="ltr">
            {formatCode(state.code)}
          </p>
          <p className="help">{he.online.lobby.waitingHost}</p>
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
          <p className="help">{he.online.lobby.guestHelp}</p>
          <SeatList players={state.players} you={state.you} hostId={state.hostId} canReorder={false} onReorder={() => {}} />
        </section>

        <Scoreboard players={state.players} scores={state.scores} />

        <section className="field">
          <h2 className="label">{he.online.lobby.settings}</h2>
          <p className="help">{settingsSummary(state.settings, state.players.length)}</p>
        </section>
      </div>

      <StickyActions>
        <button className="btn btn-ghost" onClick={onAskLeave}>
          {he.online.lobby.leave}
        </button>
      </StickyActions>

      <p className={`toast${copied ? ' toast-on' : ''}`} role="status">
        {copied ? he.online.lobby.linkCopied : ''}
      </p>
    </main>
  );
}
