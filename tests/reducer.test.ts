import { describe, expect, it } from 'vitest';
import { initialState, reducer, startRoundAction, type Action } from '../src/game/reducer';
import type { AppState } from '../src/game/types';
import { seededRng, testBank } from './helpers';

const run = (state: AppState, ...actions: Action[]) => actions.reduce(reducer, state);

describe('reducer', () => {
  it('goes through pass and reveal for every player, then to start and round end', () => {
    let state = run(initialState, { type: 'openSetup' }, { type: 'updateSettings', settings: { playerCount: 3 } });
    state = reducer(state, startRoundAction(state, testBank, seededRng(1)));
    expect(state.phase).toBe('pass');

    for (let i = 0; i < 3; i++) {
      expect(state.round!.revealIndex).toBe(i);
      state = reducer(state, { type: 'confirmPlayer' });
      expect(state.phase).toBe('reveal');
      state = reducer(state, { type: 'nextPlayer' });
    }
    expect(state.phase).toBe('start');

    state = reducer(state, { type: 'endRound' });
    expect(state.phase).toBe('roundEnd');
  });

  it('remembers used words between rounds', () => {
    let state = reducer(initialState, { type: 'openSetup' });
    state = reducer(state, startRoundAction(state, testBank, seededRng(1)));
    const first = state.round!.word;
    state = reducer(state, startRoundAction(state, testBank, seededRng(1)));
    expect(state.round!.word).not.toBe(first);
    expect(state.usedWords).toHaveLength(2);
  });

  it('resets the used words so they can come up again', () => {
    let state = reducer(initialState, { type: 'openSetup' });
    state = reducer(state, startRoundAction(state, testBank, seededRng(1)));
    state = reducer(state, { type: 'openSetup' });
    expect(state.usedWords).toHaveLength(1);
    state = reducer(state, { type: 'resetUsedWords' });
    expect(state.usedWords).toEqual([]);
    expect(state.phase).toBe('setup');
  });

  it('clamps the player count and the imposter count', () => {
    let state = reducer(initialState, { type: 'updateSettings', settings: { playerCount: 8, imposterCount: 2 } });
    expect(state.settings.imposterCount).toBe(2);
    state = reducer(state, { type: 'updateSettings', settings: { playerCount: 1 } });
    expect(state.settings.playerCount).toBe(3);
    expect(state.settings.imposterCount).toBe(1);
    state = reducer(state, { type: 'updateSettings', settings: { playerCount: 40 } });
    expect(state.settings.playerCount).toBe(12);
  });

  it('ignores actions that do not fit the current phase', () => {
    expect(reducer(initialState, { type: 'nextPlayer' })).toBe(initialState);
    expect(reducer(initialState, { type: 'endRound' })).toBe(initialState);
  });
});
