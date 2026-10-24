import { useEffect, useRef, useState } from 'react';
import { track, type EventData } from '../analytics/posthog';
import words from '../data/words.he.json';
import { MAX_PLAYERS, maxImposters } from '../game/setup';
import type { WordEntry, WordProblem } from '../game/types';
import { listCategories } from '../game/words';
import { useBackGuard } from '../hooks/useBackGuard';
import { loadSavedSettings } from '../hooks/usePersistentReducer';
import { useWakeLock } from '../hooks/useWakeLock';
import { he } from '../i18n/he';
import { reloadToLatest } from '../pwa/registerServiceWorker';
import { playRevealSound, playVoteSound, unlockAudio } from '../ui/sound';
import { vibrate } from '../ui/vibrate';
import { createRoom } from './connection';
import EntryScreen from './EntryScreen';
import FreeGuessOnline from './FreeGuessOnline';
import HostMenu from './HostMenu';
import LeaveDialog from './LeaveDialog';
import LobbyScreen from './LobbyScreen';
import MessageScreen from './MessageScreen';
import OutcomeOnline from './OutcomeOnline';
import PlayOnline from './PlayOnline';
import { isRoomCode, type ClientMessage, type ErrorCode, type RoomSettings, type RoomState } from './protocol';
import RevealOnline from './RevealOnline';
import RoomBar from './RoomBar';
import RoundEndOnline from './RoundEndOnline';
import VoteOnline from './VoteOnline';
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
  return { categories, imposterCount, imposterNeverStarts, showCategory, secretVote: false };
}

/** מצב "כל אחד בטלפון שלו": פתיחת חדר, הצטרפות, לובי וסבבים */
export default function OnlineApp() {
  const [view, setView] = useState<View>(initialView);
  const [busy, setBusy] = useState(false);

  useEffect(() => syncUrl(view), [view]);

  // צליל אפשר להשמיע רק אחרי נגיעה בדף. הנגיעה הראשונה "פותחת" את הצלילים, כדי שצליל ההצבעה הראשון יישמע
  useEffect(() => {
    document.addEventListener('pointerdown', unlockAudio, { once: true });
    return () => document.removeEventListener('pointerdown', unlockAudio);
  }, []);

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

/** צליל ורטט כשנפתחת הצבעה (חוץ ממי שפתח, ואצל הנאשם רטט חזק יותר), וצליל בחשיפה של מי שהודח */
function useRoundSounds(state: RoomState | null) {
  const voteId = state?.round?.vote?.id;
  const revealedId = state?.round?.revealed && `${state.round.number}:${state.round.revealed.playerId}`;
  const seenVote = useRef(voteId);
  const seenReveal = useRef(revealedId);

  useEffect(() => {
    const vote = state?.round?.vote;
    if (vote && vote.id !== seenVote.current && vote.startedBy !== state.you) {
      playVoteSound();
      vibrate(vote.targetId === state.you ? [250, 120, 250] : 80);
    }
    seenVote.current = voteId;
  }, [voteId]);

  useEffect(() => {
    if (revealedId && revealedId !== seenReveal.current) playRevealSound();
    seenReveal.current = revealedId;
  }, [revealedId]);
}

/**
 * אירועי אנליטיקה של הסבב, מהטלפון של המארח בלבד, כדי שכל אירוע ייספר פעם אחת.
 * מזהים אותם לפי השינוי במצב שהשרת שלח.
 */
function useHostAnalytics(state: RoomState | null) {
  const previous = useRef(state);
  useEffect(() => {
    const before = previous.current?.round;
    previous.current = state;
    const round = state?.round;
    if (!state || !round || state.hostId !== state.you || before?.number !== round.number) return;
    const players = round.players.length;

    if (round.lastVote && round.lastVote.id !== before.lastVote?.id) {
      track('vote_result', {
        mode: 'online',
        eliminated: round.lastVote.eliminated,
        yes: round.lastVote.yes,
        no: round.lastVote.no,
        secret: state.settings.secretVote,
      });
    }
    if (round.revealed && round.revealed.playerId !== before.revealed?.playerId) {
      track('player_eliminated', {
        mode: 'online',
        was_imposter: round.revealed.imposter,
        players,
        eliminated: round.eliminatedIds.length,
      });
    }
    const reveal = round.reveal;
    if (before.guessPending && !round.guessPending) {
      track('last_guess', { mode: 'online', correct: reveal?.winReason === 'lastGuess' });
    }
    if (reveal?.winner && !before.reveal?.winner) {
      if (reveal.winReason === 'freeGuessRight' || reveal.winReason === 'freeGuessWrong') {
        track('free_guess', { mode: 'online', correct: reveal.winReason === 'freeGuessRight' });
      }
      track('round_result', {
        mode: 'online',
        winner: reveal.winner,
        reason: reveal.winReason ?? '',
        players,
        imposters: round.imposterCount,
        eliminated: round.eliminatedIds.length,
        word: reveal.word,
        word_category: reveal.category,
      });
    }
  }, [state]);
}

/** החדר עצמו: מחובר כל עוד המסך הזה מוצג, ומציג את המסך של השלב הנוכחי */
function RoomView({ code, name, onEnd }: { code: string; name: string; onEnd: (end: RoomEnd) => void }) {
  const { state, status, end, send } = useRoom(code, name);
  const [askLeave, setAskLeave] = useState(false);
  const [managing, setManaging] = useState(false);
  // באיזה סבב הטלפון הזה כבר דיווח על המילה
  const [reportedRound, setReportedRound] = useState(0);
  const nowHost = useNowHost(state);
  const isHost = !!state && state.hostId === state.you;

  useWakeLock(true);
  useRoundSounds(state);
  useHostAnalytics(state);
  // "חזרה" בטלפון לא עוזב את החדר בטעות. במקום זה שואלים אם לצאת
  useBackGuard(true, () => setAskLeave(true));

  useEffect(() => {
    if (end) onEnd(end);
  }, [end]);

  const leave = (newHostId?: string) => {
    send(newHostId ? { type: 'room:leave', newHostId } : { type: 'room:leave' });
    clearSession(code);
    onEnd({ kind: 'left' });
  };

  // האירוח עבר למישהו אחר בזמן שתפריט המארח פתוח: סוגרים אותו
  useEffect(() => {
    if (!isHost) setManaging(false);
  }, [isHost]);

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

  const leaveDialog = askLeave && state && (
    <LeaveDialog state={state} onLeave={leave} onCancel={() => setAskLeave(false)} />
  );

  if (!state) {
    return (
      <MessageScreen text={status === 'connecting' ? he.online.connecting : he.online.reconnecting}>
        <button className="btn btn-ghost" onClick={() => leave()}>
          {he.online.lobby.leave}
        </button>
      </MessageScreen>
    );
  }

  const round = state.round;
  const bar = <RoomBar isHost={isHost} onManage={() => setManaging(true)} onAskLeave={() => setAskLeave(true)} />;
  const transfer = (playerId: string) => send({ type: 'host:transfer', playerId });
  const kick = (playerId: string) => send({ type: 'lobby:kick', playerId });
  const reorder = (playerIds: string[]) => send({ type: 'lobby:reorder', playerIds });
  const reported = !!round && reportedRound === round.number;
  let screen;

  if (managing && isHost && state.phase !== 'lobby') {
    screen = (
      <HostMenu
        state={state}
        status={status}
        onReorder={reorder}
        onTransfer={transfer}
        onKick={kick}
        onClose={() => setManaging(false)}
      />
    );
  } else if (state.phase === 'lobby' || !round) {
    screen = (
      <LobbyScreen
        state={state}
        status={status}
        allCategories={allCategories}
        onReorder={reorder}
        onKick={kick}
        onTransfer={transfer}
        onSettings={(settings) => send({ type: 'lobby:settings', settings })}
        onStart={() => hostAction({ type: 'game:start' })}
        onResetScores={() => send({ type: 'scores:reset' })}
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
        onResetScores={() => send({ type: 'scores:reset' })}
        onAskLeave={() => setAskLeave(true)}
        bar={bar}
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
        bar={bar}
      />
    );
  } else if (round.vote) {
    screen = (
      <VoteOnline
        key={`vote-${round.vote.id}`}
        state={state}
        round={round}
        vote={round.vote}
        status={status}
        onCast={(yes) => send({ type: 'vote:cast', yes })}
        onCancel={() => send({ type: 'vote:cancel' })}
        onClose={() => send({ type: 'vote:close' })}
        bar={bar}
      />
    );
  } else if (round.revealed) {
    screen = (
      <OutcomeOnline
        key={`outcome-${round.revealed.playerId}`}
        state={state}
        round={round}
        status={status}
        onMark={(correct) => send({ type: 'guess:mark', correct })}
        onContinue={() => send({ type: 'reveal:continue' })}
        bar={bar}
      />
    );
  } else if (round.freeGuess) {
    screen = (
      <FreeGuessOnline
        key="free-guess"
        state={state}
        round={round}
        status={status}
        onMark={(correct) => send({ type: 'guess:mark', correct })}
        onCancel={() => send({ type: 'guess:cancel' })}
        bar={bar}
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
        onVote={(targetId) => send({ type: 'vote:start', targetId })}
        onFreeGuess={() => send({ type: 'guess:start' })}
        onEndRound={() => hostAction({ type: 'round:end' })}
        bar={bar}
      />
    );
  }

  return (
    <>
      {screen}
      {leaveDialog}
      <p className={`toast${nowHost ? ' toast-on' : ''}`} role="status">
        {nowHost ? he.online.host.nowHost : ''}
      </p>
    </>
  );
}

/** "האירוח עבר אליך" לכמה שניות, כשהטלפון הזה הופך למארח (לא כשהוא פתח את החדר) */
function useNowHost(state: RoomState | null): boolean {
  const isHost = !!state && state.hostId === state.you;
  const wasHost = useRef<boolean | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!state) return;
    if (wasHost.current === false && isHost) setShow(true);
    wasHost.current = isHost;
  }, [isHost, !!state]);

  useEffect(() => {
    if (!show) return;
    const timer = setTimeout(() => setShow(false), 4000);
    return () => clearTimeout(timer);
  }, [show]);

  return show;
}
