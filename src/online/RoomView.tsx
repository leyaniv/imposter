import { useEffect, useRef, useState } from 'react';
import type { GameMode } from '../components/ModeToggle';
import type { LocalSetup } from '../screens/LocalSetupFields';
import { track, type EventData } from '../analytics/posthog';
import { MAX_PLAYERS, maxImposters } from '../game/setup';
import type { Settings } from '../game/types';
import type { WordProblem } from '../game/types';
import { useBackGuard } from '../hooks/useBackGuard';
import { useWakeLock } from '../hooks/useWakeLock';
import { he } from '../i18n/he';
import { playRevealSound, playVoteSound } from '../ui/sound';
import { vibrate } from '../ui/vibrate';
import FreeGuessOnline from './FreeGuessOnline';
import HostMenu from './HostMenu';
import LeaveDialog from './LeaveDialog';
import HostSetup from './HostSetup';
import LobbyScreen from './LobbyScreen';
import MessageScreen from './MessageScreen';
import OutcomeOnline from './OutcomeOnline';
import PlayOnline from './PlayOnline';
import type { ClientMessage, ErrorCode, RoomSettings, RoomState } from './protocol';
import RevealOnline from './RevealOnline';
import RoomBar from './RoomBar';
import RoundEndOnline from './RoundEndOnline';
import VoteOnline from './VoteOnline';
import { clearSession, saveSecretVote } from './session';
import { useRoom, type RoomEnd } from './useRoom';


/** שגיאות שמחזירות למסך ההצטרפות, עם הסבר */
export function entryError(code: ErrorCode): string | undefined {
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

interface RoomViewProps {
  code: string;
  name: string;
  onEnd: (end: RoomEnd) => void;
  /** הבורר מקומי/מקוון במסך "משחק חדש" של המארח */
  mode: GameMode;
  onModeChange: (mode: GameMode) => void;
  /** המשחק המקומי, בשביל המארח שעבר ל"מקומי" בזמן שהחדר פתוח */
  local: LocalSetup;
  /** המארח התחיל משחק מקומי: החדר כבר נסגר */
  onStartLocal: () => void;
}

/** ההגדרות של המשחק המקומי מתוך הגדרות החדר (בלי "הצבעה חשאית", שקיימת רק בחדר) */
function localPart({ categories, imposterCount, imposterNeverStarts, showCategory }: RoomSettings): Partial<Settings> {
  return { categories, imposterCount, imposterNeverStarts, showCategory };
}

/**
 * החדר עצמו: מחובר כל עוד המסך הזה מוצג, ומציג את המסך של השלב הנוכחי.
 * המארח נשאר מחובר גם כשהוא עובר ל"מקומי", כדי שהאירוח לא יעבור למישהו אחר
 */
export function RoomView({ code, name, onEnd, mode, onModeChange, local, onStartLocal }: RoomViewProps) {
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
    // מארח שנשאר לבד סוגר את החדר, במקום להשאיר חדר ריק
    const alone = isHost && state!.players.length === 1;
    send(alone ? { type: 'room:close' } : newHostId ? { type: 'room:leave', newHostId } : { type: 'room:leave' });
    clearSession(code);
    onEnd({ kind: 'left' });
  };

  /** משחק מקומי במקום החדר: סוגרים את החדר (מי שהצטרף מקבל "המארח סגר את החדר") ומתחילים */
  const startLocal = () => {
    send({ type: 'room:close' });
    clearSession(code);
    onStartLocal();
  };

  /** ההגדרות משותפות: שינוי בחדר נשמר גם בטלפון, ושינוי במסך המקומי נשלח גם לחדר */
  const roomSettings = (settings: RoomSettings) => {
    send({ type: 'lobby:settings', settings });
    local.onChange(localPart(settings));
    saveSecretVote(settings.secretVote);
  };
  const sharedLocal: LocalSetup = {
    ...local,
    onChange: (change) => {
      local.onChange(change);
      if (!state || !isHost || state.phase !== 'lobby') return;
      const next = { ...state.settings, ...localPart({ ...state.settings, ...local.settings, ...change, secretVote: false }) };
      const changed = (['categories', 'imposterCount', 'imposterNeverStarts', 'showCategory'] as const).some(
        (key) => JSON.stringify(next[key]) !== JSON.stringify(state.settings[key]),
      );
      if (changed) send({ type: 'lobby:settings', settings: next });
    },
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
  } else if ((state.phase === 'lobby' || !round) && isHost) {
    screen = (
      <HostSetup
        state={state}
        status={status}
        mode={mode}
        onModeChange={onModeChange}
        local={sharedLocal}
        onReorder={reorder}
        onKick={kick}
        onTransfer={transfer}
        onSettings={roomSettings}
        onStart={() => hostAction({ type: 'game:start' })}
        onStartLocal={startLocal}
        onResetScores={() => send({ type: 'scores:reset' })}
        onAskLeave={() => setAskLeave(true)}
      />
    );
  } else if (state.phase === 'lobby' || !round) {
    screen = <LobbyScreen state={state} status={status} onAskLeave={() => setAskLeave(true)} />;
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
