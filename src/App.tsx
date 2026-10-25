import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { trackAction, trackVisits } from './analytics/events';
import { track } from './analytics/posthog';
import ConfirmDialog from './components/ConfirmDialog';
import type { GameMode } from './components/ModeToggle';
import { hasScores } from './components/Scoreboard';
import words from './data/words.he.json';
import { cryptoRng } from './game/random';
import { startRoundAction, type Action } from './game/reducer';
import { ROUND_PHASES, type WordEntry } from './game/types';
import { countFreshWords, listCategories } from './game/words';
import { useBackGuard } from './hooks/useBackGuard';
import { usePersistentReducer } from './hooks/usePersistentReducer';
import { useWakeLock } from './hooks/useWakeLock';
import { he } from './i18n/he';
import { createRoom } from './online/connection';
import CreateRoomFields from './online/CreateRoomFields';
import EntryScreen from './online/EntryScreen';
import MessageScreen from './online/MessageScreen';
import { RoomView, entryError } from './online/RoomView';
import { isRoomCode } from './online/protocol';
import { loadMode, loadName, loadSecretVote, loadSession, saveMode, saveName, saveSecretVote } from './online/session';
import type { RoomEnd } from './online/useRoom';
import { reloadToLatest } from './pwa/registerServiceWorker';
import HomeScreen from './screens/HomeScreen';
import PassScreen from './screens/PassScreen';
import RevealScreen, { roundRole } from './screens/RevealScreen';
import RoundEndScreen from './screens/RoundEndScreen';
import RulesScreen from './screens/RulesScreen';
import AboutScreen from './screens/AboutScreen';
import ChangelogScreen from './screens/ChangelogScreen';
import ScoresScreen from './screens/ScoresScreen';
import LocalSetupFields, { type LocalSetup } from './screens/LocalSetupFields';
import NewGameScreen from './screens/NewGameScreen';
import StartScreen from './screens/StartScreen';
import { displayName } from './ui/names';
import { unlockAudio } from './ui/sound';

const bank: WordEntry[] = words;
const allCategories = listCategories(bank);

/** משחק מקוון: הצטרפות, חדר, או הודעה אחרי שהחדר נגמר. null = המשחק המקומי והמסכים הרגילים */
type Online =
  | { screen: 'join'; code: string; error?: string }
  | { screen: 'room'; code: string; name: string }
  | { screen: 'ended'; code: string; end: RoomEnd }
  | { screen: 'outdated' }
  | null;

const params = new URLSearchParams(location.search);

/** קישור לחדר (?room=<code>): הצטרפות, או חזרה לחדר אחרי ריענון */
function initialOnline(): Online {
  const code = params.get('room') ?? '';
  if (!isRoomCode(code)) return null;
  return loadSession(code)?.joined ? { screen: 'room', code, name: loadName() } : { screen: 'join', code };
}

/** הכתובת משקפת את החדר, כדי שריענון והעתקת הכתובת יחזירו לאותו מקום */
function syncUrl(online: Online) {
  const code = online?.screen === 'room' || online?.screen === 'join' ? online.code : '';
  const query = code ? `?room=${code}` : '';
  if (location.search !== query) history.replaceState(history.state, '', location.pathname + query);
}

export default function App() {
  const [state, dispatchGame] = usePersistentReducer();
  const dispatch = (action: Action) => {
    trackAction(state, action);
    dispatchGame(action);
  };
  const [confirmExit, setConfirmExit] = useState(false);
  const [online, setOnline] = useState<Online>(initialOnline);
  // ?online (קישור מגרסה קודמת) פותח את "משחק חדש" במצב מקוון
  const [mode, setMode] = useState<GameMode>(() => (params.has('online') ? 'online' : loadMode()));
  const [secretVote, setSecretVote] = useState(loadSecretVote);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string>();
  const { phase, round } = state;
  const inRound = ROUND_PHASES.includes(phase);

  // רק בפתיחה
  useEffect(() => {
    trackVisits(state);
    if (params.has('online')) dispatch({ type: 'openSetup' });
  }, []);

  useEffect(() => syncUrl(online), [online]);

  // צליל אפשר להשמיע רק אחרי נגיעה בדף. הנגיעה הראשונה "פותחת" את הצלילים, כדי שצליל ההצבעה הראשון יישמע
  useEffect(() => {
    document.addEventListener('pointerdown', unlockAudio, { once: true });
    return () => document.removeEventListener('pointerdown', unlockAudio);
  }, []);

  useWakeLock(phase === 'pass' || phase === 'reveal' || phase === 'start');

  // בחדר מקוון ה"חזרה" מטופלת שם (RoomView שואל אם לצאת)
  useBackGuard(phase !== 'home' && !online, () => {
    if (inRound) setConfirmExit(true);
    else if (phase === 'changelog') dispatch({ type: 'openAbout' });
    else dispatch({ type: 'goHome' });
  });

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [phase, round?.revealIndex]);

  const startRound = () => dispatch(startRoundAction(state, bank, cryptoRng));
  const askExit = () => setConfirmExit(true);

  const changeMode = (next: GameMode) => {
    setMode(next);
    saveMode(next);
    setCreateError(undefined);
    track('mode_switch', { mode: next });
  };

  const changeSecretVote = (next: boolean) => {
    setSecretVote(next);
    saveSecretVote(next);
  };

  const local: LocalSetup = {
    settings: state.settings,
    allCategories,
    freshWords: countFreshWords(bank, state.settings.categories, state.usedWords),
    usedWords: state.usedWords.length,
    onChange: (settings) => dispatch({ type: 'updateSettings', settings }),
    onResetUsedWords: () => dispatch({ type: 'resetUsedWords' }),
    onStart: startRound,
  };

  /** פתיחת חדר מקוון, עם ההגדרות שבחרו (אותן הגדרות של המשחק המקומי) */
  const create = async (name: string) => {
    saveName(name.trim());
    setCreating(true);
    setCreateError(undefined);
    const { categories, imposterCount, imposterNeverStarts, showCategory } = state.settings;
    const result = await createRoom({ categories, imposterCount, imposterNeverStarts, showCategory, secretVote });
    setCreating(false);
    if ('error' in result) {
      if (result.error === 'outdated') setOnline({ screen: 'outdated' });
      else setCreateError(he.online.errors.network);
      return;
    }
    track('room_created');
    setOnline({ screen: 'room', code: result.code, name: name.trim() });
  };

  const join = (code: string, name: string) => {
    saveName(name.trim());
    setOnline({ screen: 'room', code, name: name.trim() });
  };

  const leaveOnline = () => {
    setOnline(null);
    dispatch({ type: 'goHome' });
  };

  const onRoomEnd = (code: string, end: RoomEnd) => {
    if (end.kind === 'left') return leaveOnline();
    if (end.kind !== 'error') return setOnline({ screen: 'ended', code, end });
    if (end.code === 'outdated') return setOnline({ screen: 'outdated' });
    setOnline({ screen: 'join', code: end.code === 'room_not_found' ? '' : code, error: entryError(end.code) });
  };

  if (online) {
    switch (online.screen) {
      case 'join':
        return (
          <EntryScreen
            key={online.code}
            code={online.code}
            name={loadName()}
            error={online.error}
            onJoin={join}
            onClearCode={() => setOnline({ screen: 'join', code: '' })}
            onBack={leaveOnline}
          />
        );

      case 'room':
        return (
          <RoomView
            key={online.code}
            code={online.code}
            name={online.name}
            onEnd={(end) => onRoomEnd(online.code, end)}
            mode={mode}
            onModeChange={changeMode}
            local={local}
            onStartLocal={() => {
              setOnline(null);
              startRound();
            }}
          />
        );

      case 'ended': {
        const { end } = online;
        return (
          <MessageScreen text={he.online.ended[end.kind === 'error' ? 'closed' : end.kind]}>
            {end.kind === 'replaced' && (
              <button className="btn btn-primary" onClick={() => setOnline({ screen: 'room', code: online.code, name: loadName() })}>
                {he.online.ended.reconnect}
              </button>
            )}
            <button className={`btn ${end.kind === 'replaced' ? 'btn-ghost' : 'btn-primary'}`} onClick={leaveOnline}>
              {he.online.ended.toStart}
            </button>
          </MessageScreen>
        );
      }

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

  let screen: ReactNode;
  switch (phase) {
    case 'home':
      screen = (
        <HomeScreen
          showScores={hasScores(state.settings.players, state.scores)}
          onNewGame={() => dispatch({ type: 'openSetup' })}
          onJoin={() => setOnline({ screen: 'join', code: '' })}
          onScores={() => dispatch({ type: 'openScores' })}
          onRules={() => dispatch({ type: 'openRules' })}
          onAbout={() => dispatch({ type: 'openAbout' })}
        />
      );
      break;

    case 'rules':
      screen = <RulesScreen onBack={() => dispatch({ type: 'goHome' })} />;
      break;

    case 'about':
      screen = (
        <AboutScreen
          onChangelog={() => dispatch({ type: 'openChangelog' })}
          onBack={() => dispatch({ type: 'goHome' })}
        />
      );
      break;

    case 'changelog':
      screen = <ChangelogScreen onBack={() => dispatch({ type: 'openAbout' })} />;
      break;

    case 'scores':
      screen = (
        <ScoresScreen
          players={state.settings.players}
          scores={state.scores}
          onReset={() => dispatch({ type: 'resetScores' })}
          onBack={() => dispatch({ type: 'goHome' })}
        />
      );
      break;

    case 'setup':
      screen = (
        <NewGameScreen
          mode={mode}
          onModeChange={changeMode}
          canStart={mode === 'local'}
          onStart={startRound}
          onExit={() => dispatch({ type: 'goHome' })}
        >
          {mode === 'local' ? (
            <LocalSetupFields local={local} />
          ) : (
            <CreateRoomFields
              local={local}
              name={loadName()}
              secretVote={secretVote}
              onSecretVote={changeSecretVote}
              error={createError}
              busy={creating}
              onCreate={create}
            />
          )}
        </NewGameScreen>
      );
      break;

    case 'pass': {
      const index = round!.revealIndex;
      screen = (
        <PassScreen
          name={displayName(round!.players[index], index)}
          progress={he.pass.progress(index + 1, round!.players.length)}
          onConfirm={() => dispatch({ type: 'confirmPlayer' })}
          onExit={askExit}
        />
      );
      break;
    }

    case 'reveal': {
      const isLast = round!.revealIndex === round!.players.length - 1;
      screen = (
        <RevealScreen
          role={roundRole(round!, round!.revealIndex)}
          doneLabel={isLast ? he.reveal.last : he.reveal.next}
          onDone={() => dispatch({ type: 'nextPlayer' })}
        />
      );
      break;
    }

    case 'start':
      screen = (
        <StartScreen
          round={round!}
          scores={state.scores}
          onAnnounced={() => dispatch({ type: 'announceStarter' })}
          onEliminate={(playerId) => dispatch({ type: 'eliminate', playerId })}
          onLastGuess={(correct) => dispatch({ type: 'lastGuess', correct })}
          onDismissReveal={() => dispatch({ type: 'dismissReveal' })}
          onFreeGuess={(correct) => dispatch({ type: 'freeGuess', correct })}
          onReportWord={(problem) => dispatch({ type: 'reportWord', problem })}
          onEndRound={() => dispatch({ type: 'endRound' })}
          onExit={askExit}
        />
      );
      break;

    case 'roundEnd':
      screen = (
        <RoundEndScreen
          round={round!}
          scores={state.scores}
          onSetWinner={(winner) => dispatch({ type: 'setWinner', winner })}
          onResetScores={() => dispatch({ type: 'resetScores' })}
          onReportWord={(problem) => dispatch({ type: 'reportWord', problem })}
          onAgain={startRound}
          onNewGame={() => dispatch({ type: 'openSetup' })}
        />
      );
      break;
  }

  // מפתח לכל מסך, כדי שאנימציית הכניסה תרוץ בכל מעבר
  const screenKey = `${phase}-${round?.revealIndex ?? ''}-${round?.word ?? ''}`;

  return (
    <>
      <Fragment key={screenKey}>{screen}</Fragment>
      {confirmExit && inRound && (
        <ConfirmDialog
          message={he.exit.message}
          confirmLabel={he.exit.confirm}
          cancelLabel={he.exit.cancel}
          onConfirm={() => {
            setConfirmExit(false);
            dispatch({ type: 'goHome' });
          }}
          onCancel={() => setConfirmExit(false)}
        />
      )}
    </>
  );
}
