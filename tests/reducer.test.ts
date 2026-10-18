import { describe, expect, it } from 'vitest';
import { initialState, reducer, startRoundAction, type Action } from '../src/game/reducer';
import { blankPlayers } from '../src/game/setup';
import type { AppState } from '../src/game/types';
import { seededRng, testBank } from './helpers';

const run = (state: AppState, ...actions: Action[]) => actions.reduce(reducer, state);

describe('reducer', () => {
  it('goes through pass and reveal for every player, then to start and round end', () => {
    let state = run(
      initialState,
      { type: 'openSetup' },
      { type: 'updateSettings', settings: { players: blankPlayers(3) } },
    );
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
    let state = reducer(initialState, {
      type: 'updateSettings',
      settings: { players: blankPlayers(8), imposterCount: 2 },
    });
    expect(state.settings.imposterCount).toBe(2);
    state = reducer(state, { type: 'updateSettings', settings: { players: [{ id: 'p4', name: 'דנה' }] } });
    expect(state.settings.players.map((p) => p.id)).toEqual(['p4', 'p5', 'p6']);
    expect(state.settings.imposterCount).toBe(1);
    state = reducer(state, { type: 'updateSettings', settings: { players: blankPlayers(40) } });
    expect(state.settings.players).toHaveLength(12);
  });

  it('keeps the scores when players are renamed or reordered', () => {
    const players = blankPlayers(4);
    let state: AppState = { ...initialState, settings: { ...initialState.settings, players }, scores: { p1: 2, p4: 3 } };
    state = reducer(state, {
      type: 'updateSettings',
      settings: { players: [players[3], players[0], players[1], { ...players[2], name: 'דנה' }] },
    });
    expect(state.scores).toEqual({ p1: 2, p4: 3 });
    expect(reducer(state, { type: 'resetScores' }).scores).toEqual({});
  });

  it('resets the scores when a player is added or removed', () => {
    const players = blankPlayers(4);
    const state: AppState = { ...initialState, settings: { ...initialState.settings, players }, scores: { p1: 2 } };
    const removed = reducer(state, { type: 'updateSettings', settings: { players: players.slice(0, 3) } });
    expect(removed.scores).toEqual({});
    const added = reducer(state, { type: 'updateSettings', settings: { players: blankPlayers(5) } });
    expect(added.scores).toEqual({});
  });

  it('opens the scores screen from home', () => {
    expect(reducer(initialState, { type: 'openScores' }).phase).toBe('scores');
  });

  it('remembers a word report once per round', () => {
    let state = reducer(initialState, { type: 'openSetup' });
    state = reducer(state, startRoundAction(state, testBank, seededRng(1)));
    expect(reducer(initialState, { type: 'reportWord', problem: 'unknown_word' })).toBe(initialState);
    state = reducer(state, { type: 'reportWord', problem: 'unknown_word' });
    expect(state.round?.wordReported).toBe(true);
    expect(reducer(state, { type: 'reportWord', problem: 'hint_too_strong' })).toBe(state);
  });

  it('ignores actions that do not fit the current phase', () => {
    expect(reducer(initialState, { type: 'nextPlayer' })).toBe(initialState);
    expect(reducer(initialState, { type: 'endRound' })).toBe(initialState);
  });
});
