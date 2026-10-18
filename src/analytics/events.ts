import type { Action } from '../game/reducer';
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
          named_players: settings.names.slice(0, settings.playerCount).filter((n) => n.trim()).length,
          word_category: action.round.category,
          again: state.phase === 'roundEnd',
        },
      };

    case 'endRound':
      if (state.phase !== 'start' || !state.round) return null;
      return { name: 'round_end', data: { players: state.round.players.length } };

    case 'goHome':
      if (!ROUND_PHASES.includes(state.phase) || state.phase === 'roundEnd') return null;
      return { name: 'round_exit', data: { phase: state.phase } };

    default:
      return null;
  }
}

let roundStartedAt: number | undefined;
let roundsThisVisit = 0;

/** שולח אירוע לפעולה, ומוסיף משך סבב ומספר סבב בביקור */
export function trackAction(state: AppState, action: Action) {
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
