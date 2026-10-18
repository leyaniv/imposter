import { describe, expect, it } from 'vitest';
import { STATE_VERSION, rehydrate, serialize } from '../src/game/persistence';
import { initialState, reducer, startRoundAction } from '../src/game/reducer';
import { blankPlayers } from '../src/game/setup';
import type { AppState } from '../src/game/types';
import { seededRng, testBank } from './helpers';

const roundState = (): AppState => {
  const players = blankPlayers(3).map((p, i) => (i === 0 ? { ...p, name: 'דנה' } : p));
  const state = reducer(initialState, { type: 'updateSettings', settings: { players } });
  return reducer(state, startRoundAction(state, testBank, seededRng(1)));
};

const roundTrip = (state: AppState) => rehydrate(JSON.parse(JSON.stringify(serialize(state))));

describe('rehydrate', () => {
  it('restores a round in progress', () => {
    const state = roundTrip(roundState());
    expect(state.phase).toBe('pass');
    expect(state.round).toEqual(roundState().round);
    expect(state.settings.players.map((p) => p.name)).toEqual(['דנה', '', '']);
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
      state: { phase: 'setup', settings: { players: 'many', imposterNeverStarts: false } },
    });
    expect(state.phase).toBe('setup');
    expect(state.settings.players).toEqual(initialState.settings.players);
    expect(state.settings.imposterNeverStarts).toBe(false);
    // הגדרה שלא הייתה קיימת בגרסה ששמרה את המצב מקבלת ברירת מחדל
    expect(state.settings.showCategory).toBe(false);
  });

  it('keeps the show-category setting', () => {
    const state = rehydrate({ version: STATE_VERSION, state: { phase: 'home', settings: { showCategory: true } } });
    expect(state.settings.showCategory).toBe(true);
  });
});

describe('rehydrate from version 1', () => {
  const v1Settings = {
    playerCount: 5,
    names: ['דנה', '', 'יוסי'],
    categories: [],
    imposterCount: 1,
    imposterNeverStarts: true,
  };
  const v1Round = {
    players: [
      { id: 'p1', name: 'דנה' },
      { id: 'p2', name: '' },
      { id: 'p3', name: 'יוסי' },
    ],
    imposterIds: ['p2'],
    word: 'פיצה',
    category: 'אוכל',
    hints: { p2: 'משלוח' },
    revealIndex: 3,
    startIndex: 0,
    starterAnnounced: true,
  };

  it('keeps the saved names as a player list with ids in seating order', () => {
    const state = rehydrate({ version: 1, state: { phase: 'setup', settings: v1Settings, usedWords: ['סושי'] } });
    expect(state.phase).toBe('setup');
    expect(state.settings.players).toEqual([
      { id: 'p1', name: 'דנה' },
      { id: 'p2', name: '' },
      { id: 'p3', name: 'יוסי' },
      { id: 'p4', name: '' },
      { id: 'p5', name: '' },
    ]);
    expect(state.usedWords).toEqual(['סושי']);
    expect(state.scores).toEqual({});
  });

  it('keeps a round in progress, with nobody eliminated yet', () => {
    const state = rehydrate({ version: 1, state: { phase: 'start', settings: v1Settings, round: v1Round } });
    expect(state.phase).toBe('start');
    expect(state.round?.eliminatedIds).toEqual([]);
    expect(state.round?.winner).toBeUndefined();
  });
});

describe('rehydrate eliminations and scores', () => {
  it('restores who was eliminated, the winner and the scores', () => {
    let state: AppState = { ...roundState(), phase: 'start' };
    const crew = state.round!.players.find((p) => !state.round!.imposterIds.includes(p.id))!;
    state = reducer(state, { type: 'eliminate', playerId: crew.id });
    expect(state.round?.eliminatedIds).toEqual([crew.id]);
    const restored = roundTrip(state);
    expect(restored.round).toEqual(state.round);
    expect(restored.scores).toEqual(state.scores);
  });

  it('drops broken scores and eliminations', () => {
    const saved = serialize({ ...roundState(), phase: 'start' }) as { state: AppState };
    const state = rehydrate({
      ...saved,
      state: {
        ...saved.state,
        scores: { p1: 2, p2: 'lots' },
        round: { ...saved.state.round, eliminatedIds: ['nobody'], winner: 'aliens' },
      },
    });
    expect(state.scores).toEqual({ p1: 2 });
    expect(state.round?.eliminatedIds).toEqual([]);
    expect(state.round?.winner).toBeUndefined();
  });
});

describe('rehydrate the scores screen', () => {
  it('stays on the scores screen after a reload', () => {
    const state = roundTrip({ ...initialState, phase: 'scores', scores: { p1: 3 } });
    expect(state.phase).toBe('scores');
    expect(state.scores).toEqual({ p1: 3 });
  });
});
