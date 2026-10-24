import { useEffect, useState, type ReactNode } from 'react';
import { track } from '../analytics/posthog';
import { MAX_PLAYERS } from '../game/setup';
import { useBackGuard } from '../hooks/useBackGuard';
import { useWakeLock } from '../hooks/useWakeLock';
import { he } from '../i18n/he';
import { reloadToLatest } from '../pwa/registerServiceWorker';
import { createRoom } from './connection';
import EntryScreen from './EntryScreen';
import LobbyScreen from './LobbyScreen';
import { isRoomCode, type ErrorCode } from './protocol';
import { clearSession, loadName, loadSession, saveName } from './session';
import { useRoom, type RoomEnd } from './useRoom';

type View =
  | { screen: 'entry'; code: string; error?: string }
  | { screen: 'room'; code: string; name: string }
  | { screen: 'ended'; code: string; end: RoomEnd }
  | { screen: 'outdated' };

/** שגיאות שמחזירות למסך ההצטרפות, עם הסבר */
function entryError(code: ErrorCode): string | undefined {
  switch (code) {
    case 'name_required':
    case 'name_taken':
    case 'room_not_found':
    case 'bad_token':
      return he.online.errors[code];
    case 'room_full':
      return he.online.errors.room_full(MAX_PLAYERS);
    default:
      return undefined;
  }
}

/** המסך הראשון לפי הכתובת: ?room=<code> מצטרף לחדר (או חוזר אליו אחרי ריענון), ?online פותח את המסך הראשי */
function initialView(): View {
  const code = new URLSearchParams(location.search).get('room') ?? '';
  if (!isRoomCode(code)) return { screen: 'entry', code: '' };
  return loadSession(code)?.joined ? { screen: 'room', code, name: loadName() } : { screen: 'entry', code };
}

/** הכתובת משקפת את החדר, כדי שריענון והעתקת הכתובת יחזירו לאותו מקום */
function syncUrl(view: View) {
  const query = view.screen === 'room' || (view.screen === 'entry' && view.code) ? `?room=${view.code}` : '?online';
  if (location.search !== query) history.replaceState(history.state, '', query);
}

/** מצב "כל אחד בטלפון שלו". בשלב הזה: פתיחת חדר, הצטרפות ולובי */
export default function OnlineApp() {
  const [view, setView] = useState<View>(initialView);
  const [busy, setBusy] = useState(false);

  useEffect(() => syncUrl(view), [view]);

  const create = async (name: string) => {
    saveName(name.trim());
    setBusy(true);
    const result = await createRoom();
    setBusy(false);
    if ('error' in result) {
      if (result.error === 'outdated') setView({ screen: 'outdated' });
      else setView({ screen: 'entry', code: '', error: he.online.errors.network });
      return;
    }
    track('room_created');
    setView({ screen: 'room', code: result.code, name: name.trim() });
  };

  const join = (code: string, name: string) => {
    saveName(name.trim());
    setView({ screen: 'room', code, name: name.trim() });
  };

  const onEnd = (code: string, end: RoomEnd) => {
    if (end.kind === 'left') return setView({ screen: 'entry', code: '' });
    if (end.kind !== 'error') return setView({ screen: 'ended', code, end });
    if (end.code === 'outdated') return setView({ screen: 'outdated' });
    setView({ screen: 'entry', code: end.code === 'room_not_found' ? '' : code, error: entryError(end.code) });
  };

  switch (view.screen) {
    case 'entry':
      return (
        <EntryScreen
          key={view.code}
          code={view.code}
          name={loadName()}
          error={view.error}
          busy={busy}
          onCreate={create}
          onJoin={join}
          onClearCode={() => setView({ screen: 'entry', code: '' })}
        />
      );

    case 'room':
      return <RoomView key={view.code} code={view.code} name={view.name} onEnd={(end) => onEnd(view.code, end)} />;

    case 'ended':
      return (
        <MessageScreen text={he.online.ended[view.end.kind === 'error' ? 'closed' : view.end.kind]}>
          {view.end.kind === 'replaced' && (
            <button className="btn btn-primary" onClick={() => setView({ screen: 'room', code: view.code, name: loadName() })}>
              {he.online.ended.reconnect}
            </button>
          )}
          <button
            className={`btn ${view.end.kind === 'replaced' ? 'btn-ghost' : 'btn-primary'}`}
            onClick={() => setView({ screen: 'entry', code: '' })}
          >
            {he.online.ended.toStart}
          </button>
        </MessageScreen>
      );

    case 'outdated':
      return (
        <MessageScreen title={he.online.outdated.title} text={he.online.outdated.text}>
          <button className="btn btn-primary" onClick={reloadToLatest}>
            {he.online.outdated.reload}
          </button>
        </MessageScreen>
      );
  }
}

/** החדר עצמו: מחובר כל עוד המסך הזה מוצג */
function RoomView({ code, name, onEnd }: { code: string; name: string; onEnd: (end: RoomEnd) => void }) {
  const { state, status, end, send } = useRoom(code, name);
  const [leaveRequests, setLeaveRequests] = useState(0);

  useWakeLock(true);
  // "חזרה" בטלפון לא עוזב את החדר בטעות. במקום זה הלובי שואל אם לצאת
  useBackGuard(true, () => setLeaveRequests((n) => n + 1));

  useEffect(() => {
    if (end) onEnd(end);
  }, [end]);

  const leave = () => {
    send({ type: 'room:leave' });
    clearSession(code);
    onEnd({ kind: 'left' });
  };

  if (!state) {
    return (
      <MessageScreen text={status === 'connecting' ? he.online.connecting : he.online.reconnecting}>
        <button className="btn btn-ghost" onClick={leave}>
          {he.online.lobby.leave}
        </button>
      </MessageScreen>
    );
  }

  return (
    <LobbyScreen
      state={state}
      status={status}
      leaveRequests={leaveRequests}
      onReorder={(playerIds) => send({ type: 'lobby:reorder', playerIds })}
      onKick={(playerId) => send({ type: 'lobby:kick', playerId })}
      onLeave={leave}
    />
  );
}

function MessageScreen({ title, text, children }: { title?: string; text: string; children: ReactNode }) {
  return (
    <main className="screen">
      <div className="screen-body center">
        {title && <h1 className="heading">{title}</h1>}
        <p className={title ? 'muted' : 'label'}>{text}</p>
      </div>
      <div className="screen-actions">{children}</div>
    </main>
  );
}
