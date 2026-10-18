import { reducer, type Action } from '../game/reducer';
import { isImposter } from '../game/rules';
import { ROUND_PHASES, type AppState } from '../game/types';
import { track, type EventData } from './posthog';

export interface AnalyticsEvent {
  name: string;
  data?: EventData;
}

/** איזה אירוע טלמטריה מתאים לפעולה במשחק (או null אם אין) */
export function actionEvent(state: AppState, action: Action): AnalyticsEvent | null {
  const { settings } = state;
  switch (action.type) {
    case 'openRules':
      return { name: 'rules_open' };

    case 'openScores':
      return { name: 'scores_open' };

    case 'openAbout':
      return { name: 'about_open' };

    case 'openChangelog':
      return { name: 'changelog_open' };

    case 'openSetup':
      return { name: 'setup_open', data: { from: state.phase } };

    case 'resetUsedWords':
      return { name: 'reset_used_words', data: { used: state.usedWords.length } };

    case 'startRound':
      return {
        name: 'round_start',
        data: {
          players: action.round.players.length,
          imposters: action.round.imposterIds.length,
          imposter_never_starts: settings.imposterNeverStarts,
          show_category: settings.showCategory,
          categories: settings.categories.length === 0 ? 'all' : [...settings.categories].sort().join(', '),
          category_count: settings.categories.length,
          named_players: settings.players.filter((player) => player.name.trim()).length,
          word_category: action.round.category,
          again: state.phase === 'roundEnd',
        },
      };

    case 'eliminate': {
      const { round } = state;
      if (state.phase !== 'start' || !round) return null;
      return {
        name: 'player_eliminated',
        data: {
          was_imposter: isImposter(round, action.playerId),
          players: round.players.length,
          eliminated: round.eliminatedIds.length + 1,
        },
      };
    }

    case 'lastGuess':
      if (state.phase !== 'start' || !state.round?.guessPending) return null;
      return { name: 'last_guess', data: { correct: action.correct } };

    case 'freeGuess':
      if (state.phase !== 'start' || !state.round || state.round.winner) return null;
      return { name: 'free_guess', data: { correct: action.correct } };

    case 'endRound':
      if (state.phase !== 'start' || !state.round) return null;
      return { name: 'round_end', data: { players: state.round.players.length } };

    case 'resetScores':
      return { name: 'scores_reset', data: { from: state.phase } };

    case 'reportWord': {
      const { round } = state;
      if (!ROUND_PHASES.includes(state.phase) || !round || round.wordReported) return null;
      // משוב על המילה, כדי לדעת אילו מילים ורמזים לתקן
      return {
        name: 'word_feedback',
        data: {
          kind: action.problem,
          during_round: state.phase !== 'roundEnd',
          word: round.word,
          word_category: round.category,
          hints: round.imposterIds.map((id) => round.hints[id]).join(', '),
          show_category: !!round.showCategory,
        },
      };
    }

    case 'goHome':
      if (!ROUND_PHASES.includes(state.phase) || state.phase === 'roundEnd') return null;
      return { name: 'round_exit', data: { phase: state.phase } };

    default:
      return null;
  }
}

/** מי ניצח ולמה, ברגע שזה נקבע (לבד או כשהשחקנים סימנו) */
export function resultEvent(before: AppState, after: AppState): AnalyticsEvent | null {
  const round = after.round;
  if (!round?.winner || before.round?.winner) return null;
  return {
    name: 'round_result',
    data: {
      winner: round.winner,
      reason: round.winReason ?? 'manual',
      players: round.players.length,
      imposters: round.imposterIds.length,
      eliminated: round.eliminatedIds.length,
      word: round.word,
      word_category: round.category,
    },
  };
}

let roundStartedAt: number | undefined;
let roundsThisVisit = 0;

/** שולח אירוע לפעולה, ומוסיף משך סבב ומספר סבב בביקור */
export function trackAction(state: AppState, action: Action) {
  sendActionEvent(state, action);
  const result = resultEvent(state, reducer(state, action));
  if (result) track(result.name, result.data);
}

function sendActionEvent(state: AppState, action: Action) {
  const event = actionEvent(state, action);
  if (!event) return;
  const data: EventData = { ...event.data };

  if (event.name === 'round_start') {
    roundStartedAt = Date.now();
    data.round_number = ++roundsThisVisit;
  } else if ((event.name === 'round_end' || event.name === 'round_exit') && roundStartedAt !== undefined) {
    data.round_sec = Math.round((Date.now() - roundStartedAt) / 1000);
    roundStartedAt = undefined;
  }

  track(event.name, data);
}

let visitsTracked = false;

/**
 * פתיחת האפליקציה, וזמן שהיא הייתה גלויה בכל פעם שעוברים ממנה.
 * PostHog מחשב משך ביקור לבד; app_hidden נותן גם את הזמן שהמשחק היה באמת על המסך.
 */
export function trackVisits(initial: AppState) {
  // StrictMode מריץ effects פעמיים בפיתוח
  if (visitsTracked) return;
  visitsTracked = true;
  const standalone = window.matchMedia('(display-mode: standalone)').matches;
  track('app_open', {
    display_mode: standalone ? 'standalone' : 'browser',
    resumed_phase: initial.phase,
  });

  let visibleSince = Date.now();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      track('app_hidden', {
        visible_sec: Math.round((Date.now() - visibleSince) / 1000),
        rounds: roundsThisVisit,
      });
    } else {
      visibleSince = Date.now();
    }
  });
}

/** לחיצה על קישור החוצה במסך "אודות" */
export function trackLink(target: 'github' | 'kofi' | 'issues') {
  track('about_link', { target });
}

export function trackShare(result: string) {
  track('share', { result });
}
