import { describe, expect, it } from 'vitest';
import { actionEvent } from '../src/analytics/events';
import { initialState, reducer, startRoundAction } from '../src/game/reducer';
import type { AppState } from '../src/game/types';
import { seededRng, testBank } from './helpers';

function inSetup(): AppState {
  return reducer(initialState, { type: 'openSetup' });
}

describe('actionEvent', () => {
  it('round_start מתאר את ההגדרות שנבחרו', () => {
    let state = inSetup();
    state = reducer(state, {
      type: 'updateSettings',
      settings: { playerCount: 5, names: ['דנה', '', 'יוסי'], categories: ['מקומות', 'אוכל'], showCategory: true },
    });
    const action = startRoundAction(state, testBank, seededRng(1));

    expect(actionEvent(state, action)).toEqual({
      name: 'round_start',
      data: {
        players: 5,
        imposters: 1,
        imposter_never_starts: true,
        show_category: true,
        categories: 'אוכל, מקומות',
        category_count: 2,
        named_players: 2,
        word_category: action.type === 'startRound' ? action.round.category : '',
        again: false,
      },
    });
  });

  it('בלי קטגוריות נבחרות = all', () => {
    const state = inSetup();
    const event = actionEvent(state, startRoundAction(state, testBank, seededRng(2)));
    expect(event?.data?.categories).toBe('all');
  });

  it('סבב נוסף מסומן כ-again', () => {
    const state: AppState = { ...inSetup(), phase: 'roundEnd' };
    expect(actionEvent(state, startRoundAction(state, testBank, seededRng(3)))?.data?.again).toBe(true);
  });

  it('יציאה באמצע סבב נספרת, חזרה מהמסך האחרון לא', () => {
    const setup = inSetup();
    const playing = reducer(setup, startRoundAction(setup, testBank, seededRng(4)));
    expect(actionEvent(playing, { type: 'goHome' })).toEqual({ name: 'round_exit', data: { phase: 'pass' } });
    expect(actionEvent({ ...playing, phase: 'roundEnd' }, { type: 'goHome' })).toBeNull();
    expect(actionEvent(setup, { type: 'goHome' })).toBeNull();
  });

  it('פעולות שלא מעניינות לא שולחות כלום', () => {
    expect(actionEvent(inSetup(), { type: 'updateSettings', settings: { playerCount: 6 } })).toBeNull();
    expect(actionEvent(inSetup(), { type: 'confirmPlayer' })).toBeNull();
  });
});
