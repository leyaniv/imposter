import type { Rng } from './random';
import { addPoints, declareWinner, dismissReveal, eliminate, freeGuess, resolveLastGuess, roundPoints } from './rules';
import { MAX_PLAYERS, MIN_PLAYERS, addPlayer, blankPlayers, createRound, maxImposters } from './setup';
import { ROUND_PHASES, type AppState, type Player, type Round, type Settings, type WordEntry, type WordProblem, type Winner } from './types';

export type Action =
  | { type: 'openSetup' }
  | { type: 'openRules' }
  | { type: 'openScores' }
  | { type: 'openAbout' }
  | { type: 'openChangelog' }
  | { type: 'goHome' }
  | { type: 'updateSettings'; settings: Partial<Settings> }
  | { type: 'resetUsedWords' }
  | { type: 'startRound'; round: Round; usedWords: string[] }
  | { type: 'confirmPlayer' }
  | { type: 'nextPlayer' }
  | { type: 'announceStarter' }
  | { type: 'eliminate'; playerId: string }
  | { type: 'lastGuess'; correct: boolean }
  | { type: 'dismissReveal' }
  | { type: 'freeGuess'; correct: boolean }
  | { type: 'endRound' }
  | { type: 'setWinner'; winner: Winner }
  | { type: 'reportWord'; problem: WordProblem }
  | { type: 'resetScores' };

export const defaultSettings: Settings = {
  players: blankPlayers(4),
  categories: [],
  imposterCount: 1,
  imposterNeverStarts: true,
  showCategory: false,
};

export const initialState: AppState = {
  phase: 'home',
  settings: defaultSettings,
  usedWords: [],
  scores: {},
};

/**
 * ההגרלה נעשית מחוץ ל-reducer כדי שהוא יישאר טהור.
 * הקומפוננטה קוראת לזה ושולחת את התוצאה ב-dispatch.
 */
export function startRoundAction(state: AppState, bank: readonly WordEntry[], rng: Rng): Action {
  const { round, usedWords } = createRound(state.settings, bank, state.usedWords, rng);
  return { type: 'startRound', round, usedWords };
}

/** בין MIN_PLAYERS ל-MAX_PLAYERS שחקנים */
function clampPlayers(players: readonly Player[]): Player[] {
  let result = players.slice(0, MAX_PLAYERS);
  while (result.length < MIN_PLAYERS) result = addPlayer(result);
  return result;
}

export function normalizeSettings(settings: Settings): Settings {
  const players = clampPlayers(settings.players);
  return {
    ...settings,
    players,
    imposterCount: Math.min(settings.imposterCount, maxImposters(players.length)) as 1 | 2,
  };
}

/** האם הוסיפו או הסירו שחקנים (שינוי סדר או שם לא נחשב) */
function sameRoster(a: readonly Player[], b: readonly Player[]): boolean {
  const ids = new Set(a.map((player) => player.id));
  return a.length === b.length && b.every((player) => ids.has(player.id));
}

/** מעדכן את הסבב, ומוסיף ניקוד ברגע שנקבע מי ניצח */
function updateRound(state: AppState, update: (round: Round) => Round): AppState {
  const round = update(state.round!);
  if (round === state.round) return state;
  const decided = !state.round!.winner && round.winner;
  return { ...state, round, scores: decided ? addPoints(state.scores, roundPoints(round)) : state.scores };
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'openSetup':
      return { ...state, phase: 'setup', round: undefined };

    case 'openRules':
      return { ...state, phase: 'rules', round: undefined };

    case 'openScores':
      return { ...state, phase: 'scores', round: undefined };

    case 'openAbout':
      return { ...state, phase: 'about', round: undefined };

    case 'openChangelog':
      return { ...state, phase: 'changelog', round: undefined };

    case 'goHome':
      return { ...state, phase: 'home', round: undefined };

    case 'updateSettings': {
      const settings = normalizeSettings({ ...state.settings, ...action.settings });
      // שחקנים אחרים = ערב חדש, ומתחילים את הניקוד מאפס
      const scores = sameRoster(state.settings.players, settings.players) ? state.scores : {};
      return { ...state, settings, scores };
    }

    case 'resetUsedWords':
      return { ...state, usedWords: [] };

    case 'startRound':
      return { ...state, phase: 'pass', round: action.round, usedWords: action.usedWords };

    case 'confirmPlayer':
      if (state.phase !== 'pass' || !state.round) return state;
      return { ...state, phase: 'reveal' };

    case 'nextPlayer': {
      if (state.phase !== 'reveal' || !state.round) return state;
      const revealIndex = state.round.revealIndex + 1;
      const done = revealIndex >= state.round.players.length;
      return { ...state, phase: done ? 'start' : 'pass', round: { ...state.round, revealIndex } };
    }

    case 'announceStarter':
      if (state.phase !== 'start' || !state.round) return state;
      return { ...state, round: { ...state.round, starterAnnounced: true } };

    case 'eliminate':
      if (state.phase !== 'start' || !state.round) return state;
      return updateRound(state, (round) => eliminate(round, action.playerId));

    case 'lastGuess':
      if (state.phase !== 'start' || !state.round) return state;
      return updateRound(state, (round) => resolveLastGuess(round, action.correct));

    case 'dismissReveal':
      if (state.phase !== 'start' || !state.round) return state;
      return updateRound(state, dismissReveal);

    case 'freeGuess': {
      if (state.phase !== 'start' || !state.round) return state;
      const next = updateRound(state, (round) => freeGuess(round, action.correct));
      return next === state ? state : { ...next, phase: 'roundEnd' };
    }

    case 'endRound':
      if (state.phase !== 'start' || !state.round) return state;
      return { ...state, phase: 'roundEnd' };

    case 'setWinner':
      if (state.phase !== 'roundEnd' || !state.round) return state;
      return updateRound(state, (round) => declareWinner(round, action.winner));

    case 'reportWord':
      if (!ROUND_PHASES.includes(state.phase) || !state.round || state.round.wordReported) return state;
      return { ...state, round: { ...state.round, wordReported: true } };

    case 'resetScores':
      return { ...state, scores: {} };
  }
}
