import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { trackAction, trackVisits } from './analytics/events';
import ConfirmDialog from './components/ConfirmDialog';
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
import HomeScreen from './screens/HomeScreen';
import PassScreen from './screens/PassScreen';
import RevealScreen, { roundRole } from './screens/RevealScreen';
import RoundEndScreen from './screens/RoundEndScreen';
import RulesScreen from './screens/RulesScreen';
import AboutScreen from './screens/AboutScreen';
import ChangelogScreen from './screens/ChangelogScreen';
import ScoresScreen from './screens/ScoresScreen';
import SetupScreen from './screens/SetupScreen';
import StartScreen from './screens/StartScreen';
import { displayName } from './ui/names';

const bank: WordEntry[] = words;
const allCategories = listCategories(bank);

export default function App() {
  const [state, dispatchGame] = usePersistentReducer();
  const dispatch = (action: Action) => {
    trackAction(state, action);
    dispatchGame(action);
  };
  const [confirmExit, setConfirmExit] = useState(false);
  const { phase, round } = state;
  const inRound = ROUND_PHASES.includes(phase);

  // רק בפתיחה
  useEffect(() => trackVisits(state), []);

  useWakeLock(phase === 'pass' || phase === 'reveal' || phase === 'start');

  useBackGuard(phase !== 'home', () => {
    if (inRound) setConfirmExit(true);
    else if (phase === 'changelog') dispatch({ type: 'openAbout' });
    else dispatch({ type: 'goHome' });
  });

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [phase, round?.revealIndex]);

  const startRound = () => dispatch(startRoundAction(state, bank, cryptoRng));
  const askExit = () => setConfirmExit(true);

  let screen: ReactNode;
  switch (phase) {
    case 'home':
      screen = (
        <HomeScreen
          showScores={hasScores(state.settings.players, state.scores)}
          onNewGame={() => dispatch({ type: 'openSetup' })}
          onOnline={() => location.assign('./?online')}
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
        <SetupScreen
          settings={state.settings}
          allCategories={allCategories}
          freshWords={countFreshWords(bank, state.settings.categories, state.usedWords)}
          usedWords={state.usedWords.length}
          onChange={(settings) => dispatch({ type: 'updateSettings', settings })}
          onResetUsedWords={() => dispatch({ type: 'resetUsedWords' })}
          onBack={() => dispatch({ type: 'goHome' })}
          onStart={startRound}
        />
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
