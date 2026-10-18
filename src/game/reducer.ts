import type { Rng } from './random';
import { MAX_PLAYERS, MIN_PLAYERS, createRound, maxImposters } from './setup';
import type { AppState, Round, Settings, WordEntry } from './types';

export type Action =
  | { type: 'openSetup' }
  | { type: 'openRules' }
  | { type: 'goHome' }
  | { type: 'updateSettings'; settings: Partial<Settings> }
  | { type: 'resetUsedWords' }
  | { type: 'startRound'; round: Round; usedWords: string[] }
  | { type: 'confirmPlayer' }
  | { type: 'nextPlayer' }
  | { type: 'announceStarter' }
  | { type: 'endRound' };

export const defaultSettings: Settings = {
  playerCount: 4,
  names: [],
  categories: [],
  imposterCount: 1,
  imposterNeverStarts: true,
  showCategory: false,
};

export const initialState: AppState = {
  phase: 'home',
  settings: defaultSettings,
  usedWords: [],
};

/**
 * ההגרלה נעשית מחוץ ל-reducer כדי שהוא יישאר טהור.
 * הקומפוננטה קוראת לזה ושולחת את התוצאה ב-dispatch.
 */
export function startRoundAction(state: AppState, bank: readonly WordEntry[], rng: Rng): Action {
  const { round, usedWords } = createRound(state.settings, bank, state.usedWords, rng);
  return { type: 'startRound', round, usedWords };
}

export function normalizeSettings(settings: Settings): Settings {
  const playerCount = Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, Math.round(settings.playerCount)));
  return {
    ...settings,
    playerCount,
    imposterCount: Math.min(settings.imposterCount, maxImposters(playerCount)) as 1 | 2,
  };
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'openSetup':
      return { ...state, phase: 'setup', round: undefined };

    case 'openRules':
      return { ...state, phase: 'rules', round: undefined };

    case 'goHome':
      return { ...state, phase: 'home', round: undefined };

    case 'updateSettings':
      return { ...state, settings: normalizeSettings({ ...state.settings, ...action.settings }) };

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

    case 'endRound':
      if (state.phase !== 'start' || !state.round) return state;
      return { ...state, phase: 'roundEnd' };
  }
}
