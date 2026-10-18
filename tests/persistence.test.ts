import { describe, expect, it } from 'vitest';
import { STATE_VERSION, rehydrate, serialize } from '../src/game/persistence';
import { initialState, reducer, startRoundAction } from '../src/game/reducer';
import type { AppState } from '../src/game/types';
import { seededRng, testBank } from './helpers';

const roundState = (): AppState => {
  const state = reducer(initialState, { type: 'updateSettings', settings: { playerCount: 3, names: ['דנה'] } });
  return reducer(state, startRoundAction(state, testBank, seededRng(1)));
};

const roundTrip = (state: AppState) => rehydrate(JSON.parse(JSON.stringify(serialize(state))));

describe('rehydrate', () => {
  it('restores a round in progress', () => {
    const state = roundTrip(roundState());
    expect(state.phase).toBe('pass');
    expect(state.round).toEqual(roundState().round);
    expect(state.settings.names).toEqual(['דנה']);
  });

  it('goes back to the pass screen instead of showing a role after a reload', () => {
    const revealing = reducer(roundState(), { type: 'confirmPlayer' });
    expect(revealing.phase).toBe('reveal');
    expect(roundTrip(revealing).phase).toBe('pass');
  });

  it('falls back to the initial state for missing, old or broken data', () => {
    expect(rehydrate(null)).toEqual(initialState);
    expect(rehydrate({ version: STATE_VERSION + 1, state: roundState() })).toEqual(initialState);
    expect(rehydrate('garbage')).toEqual(initialState);
  });

  it('drops a broken round and returns home', () => {
    const saved = serialize(roundState()) as { state: AppState };
    const broken = { ...saved, state: { ...saved.state, round: { ...saved.state.round, players: 'x' } } };
    const state = rehydrate(broken);
    expect(state.phase).toBe('home');
    expect(state.round).toBeUndefined();
  });

  it('repairs bad settings field by field', () => {
    const state = rehydrate({
      version: STATE_VERSION,
      state: { phase: 'setup', settings: { playerCount: 'many', names: ['א', 'ב'], imposterNeverStarts: false } },
    });
    expect(state.phase).toBe('setup');
    expect(state.settings.playerCount).toBe(initialState.settings.playerCount);
    expect(state.settings.names).toEqual(['א', 'ב']);
    expect(state.settings.imposterNeverStarts).toBe(false);
    // הגדרה שלא הייתה קיימת בגרסה ששמרה את המצב מקבלת ברירת מחדל
    expect(state.settings.showCategory).toBe(false);
  });

  it('keeps the show-category setting', () => {
    const state = rehydrate({ version: STATE_VERSION, state: { phase: 'home', settings: { showCategory: true } } });
    expect(state.settings.showCategory).toBe(true);
  });
});
