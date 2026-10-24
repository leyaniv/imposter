import { useEffect, useState } from 'react';
import { track, type EventData } from '../analytics/posthog';
import ConfirmDialog from '../components/ConfirmDialog';
import words from '../data/words.he.json';
import { MAX_PLAYERS, maxImposters } from '../game/setup';
import type { WordEntry, WordProblem } from '../game/types';
import { listCategories } from '../game/words';
import { useBackGuard } from '../hooks/useBackGuard';
import { loadSavedSettings } from '../hooks/usePersistentReducer';
import { useWakeLock } from '../hooks/useWakeLock';
import { he } from '../i18n/he';
import { reloadToLatest } from '../pwa/registerServiceWorker';
import { createRoom } from './connection';
import EntryScreen from './EntryScreen';
import LobbyScreen from './LobbyScreen';
import MessageScreen from './MessageScreen';
import PlayOnline from './PlayOnline';
import { isRoomCode, type ClientMessage, type ErrorCode, type RoomSettings, type RoomState } from './protocol';
import RevealOnline from './RevealOnline';
import RoundEndOnline from './RoundEndOnline';
import { clearSession, loadName, loadSession, saveName } from './session';
import { useRoom, type RoomEnd } from './useRoom';

const allCategories = listCategories(words as WordEntry[]);

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

/** חדר חדש מתחיל מההגדרות האחרונות של המארח במצב הטלפון האחד */
function initialSettings(): RoomSettings {
  const { categories, imposterCount, imposterNeverStarts, showCategory } = loadSavedSettings();
  return { categories, imposterCount, imposterNeverStarts, showCategory };
}

/** מצב "כל אחד בטלפון שלו": פתיחת חדר, הצטרפות, לובי וסבבים */
export default function OnlineApp() {
  const [view, setView] = useState<View>(initialView);
  const [busy, setBusy] = useState(false);

  useEffect(() => syncUrl(view), [view]);

  const create = async (name: string) => {
    saveName(name.trim());
    setBusy(true);
    const result = await createRoom(initialSettings());
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

/** אירוע התחלת סבב, מהטלפון של המארח בלבד, כדי שכל סבב ייספר פעם אחת */
function roundStartEvent(state: RoomState, again: boolean): EventData {
  const { settings } = state;
  return {
    mode: 'online',
    players: state.players.length,
    imposters: Math.min(settings.imposterCount, maxImposters(state.players.length)),
    imposter_never_starts: settings.imposterNeverStarts,
    show_category: settings.showCategory,
    categories: settings.categories.length === 0 ? 'all' : [...settings.categories].sort().join(', '),
    category_count: settings.categories.length,
    again,
  };
}

/** החדר עצמו: מחובר כל עוד המסך הזה מוצג, ומציג את המסך של השלב הנוכחי */
function RoomView({ code, name, onEnd }: { code: string; name: string; onEnd: (end: RoomEnd) => void }) {
  const { state, status, end, send } = useRoom(code, name);
  const [askLeave, setAskLeave] = useState(false);
  // באיזה סבב הטלפון הזה כבר דיווח על המילה
  const [reportedRound, setReportedRound] = useState(0);

  useWakeLock(true);
  // "חזרה" בטלפון לא עוזב את החדר בטעות. במקום זה שואלים אם לצאת
  useBackGuard(true, () => setAskLeave(true));

  useEffect(() => {
    if (end) onEnd(end);
  }, [end]);

  const leave = () => {
    send({ type: 'room:leave' });
    clearSession(code);
    onEnd({ kind: 'left' });
  };

  /** פעולה של המארח שמתחילה או מסיימת סבב, עם אירוע אנליטיקה */
  const hostAction = (message: ClientMessage) => {
    if (!state) return;
    if (message.type === 'game:start' || message.type === 'round:next') {
      track('round_start', roundStartEvent(state, message.type === 'round:next'));
    } else if (message.type === 'round:end') {
      track('round_end', { mode: 'online', players: state.round?.players.length ?? 0 });
    }
    send(message);
  };

  const report = (problem: WordProblem) => {
    const round = state?.round;
    if (!round) return;
    setReportedRound(round.number);
    // כל טלפון מדווח על מה שהוא יודע: המילה, הרמז שלו, או הכול בסוף הסבב
    track('word_feedback', {
      mode: 'online',
      kind: problem,
      during_round: !round.reveal,
      word: round.reveal?.word ?? (round.role?.kind === 'crew' ? round.role.word : ''),
      hints: round.reveal
        ? round.reveal.imposters.map((imposter) => imposter.hint).join(', ')
        : round.role?.kind === 'imposter'
          ? round.role.hint
          : '',
      word_category: round.reveal?.category ?? round.category ?? '',
    });
  };

  const leaveDialog = askLeave && (
    <ConfirmDialog
      message={he.online.lobby.leaveConfirm}
      confirmLabel={he.online.lobby.leaveYes}
      cancelLabel={he.online.lobby.stay}
      onConfirm={leave}
      onCancel={() => setAskLeave(false)}
    />
  );

  if (!state) {
    return (
      <MessageScreen text={status === 'connecting' ? he.online.connecting : he.online.reconnecting}>
        <button className="btn btn-ghost" onClick={leave}>
          {he.online.lobby.leave}
        </button>
      </MessageScreen>
    );
  }

  const round = state.round;
  const reported = !!round && reportedRound === round.number;
  let screen;

  if (state.phase === 'lobby' || !round) {
    screen = (
      <LobbyScreen
        state={state}
        status={status}
        allCategories={allCategories}
        onReorder={(playerIds) => send({ type: 'lobby:reorder', playerIds })}
        onKick={(playerId) => send({ type: 'lobby:kick', playerId })}
        onSettings={(settings) => send({ type: 'lobby:settings', settings })}
        onStart={() => hostAction({ type: 'game:start' })}
        onAskLeave={() => setAskLeave(true)}
      />
    );
  } else if (state.phase === 'roundEnd') {
    screen = (
      <RoundEndOnline
        key={round.number}
        state={state}
        round={round}
        status={status}
        reported={reported}
        onReport={report}
        onNext={() => hostAction({ type: 'round:next' })}
        onLobby={() => send({ type: 'round:lobby' })}
        onAskLeave={() => setAskLeave(true)}
      />
    );
  } else if (!round.role) {
    // הצטרף באמצע הסבב
    screen = (
      <MessageScreen title={he.online.round.lateTitle} text={he.online.round.lateText}>
        <button className="btn btn-ghost" onClick={() => setAskLeave(true)}>
          {he.online.lobby.leave}
        </button>
      </MessageScreen>
    );
  } else if (state.phase === 'reveal') {
    screen = (
      <RevealOnline
        key={round.number}
        state={state}
        round={round}
        status={status}
        onSeen={() => send({ type: 'role:seen' })}
        onSkip={() => send({ type: 'reveal:skip' })}
      />
    );
  } else {
    screen = (
      <PlayOnline
        key={round.number}
        state={state}
        round={round}
        status={status}
        reported={reported}
        onReport={report}
        onEndRound={() => hostAction({ type: 'round:end' })}
        onAskLeave={() => setAskLeave(true)}
      />
    );
  }

  return (
    <>
      {screen}
      {leaveDialog}
    </>
  );
}
