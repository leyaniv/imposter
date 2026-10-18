import { describe, expect, it } from 'vitest';
import { initialState, reducer } from '../src/game/reducer';
import {
  CREW_POINTS,
  IMPOSTER_POINTS,
  canEliminate,
  declareWinner,
  dismissReveal,
  eliminate,
  freeGuess,
  remaining,
  resolveLastGuess,
  roundPoints,
} from '../src/game/rules';
import { blankPlayers } from '../src/game/setup';
import type { AppState, Round } from '../src/game/types';

/** סבב עם n שחקנים (p1..pn) והמתחזים שנבחרו */
function makeRound(count: number, imposterIds: string[]): Round {
  return {
    players: blankPlayers(count),
    imposterIds,
    word: 'פיצה',
    category: 'אוכל',
    hints: Object.fromEntries(imposterIds.map((id) => [id, 'משלוח'])),
    revealIndex: count,
    startIndex: 0,
    starterAnnounced: true,
    eliminatedIds: [],
  };
}

describe('eliminate', () => {
  it('reveals a regular player and the game goes on', () => {
    const round = eliminate(makeRound(5, ['p1']), 'p2');
    expect(round.eliminatedIds).toEqual(['p2']);
    expect(round.revealedId).toBe('p2');
    expect(round.guessPending).toBeFalsy();
    expect(round.winner).toBeUndefined();
    expect(remaining(round)).toEqual({ imposters: 1, crew: 3 });
  });

  it('gives a caught imposter a last guess before deciding', () => {
    const round = eliminate(makeRound(5, ['p1']), 'p1');
    expect(round.guessPending).toBe(true);
    expect(round.winner).toBeUndefined();
  });

  it('the imposter wins when only one regular player is left', () => {
    let round = eliminate(makeRound(4, ['p1']), 'p2');
    expect(round.winner).toBeUndefined();
    round = eliminate(dismissReveal(round), 'p3');
    expect(round.winner).toBe('imposters');
    expect(round.winReason).toBe('outnumbered');
  });

  it('with three players, one wrong elimination ends the game', () => {
    const round = eliminate(makeRound(3, ['p1']), 'p2');
    expect(round.winner).toBe('imposters');
  });

  it('cannot eliminate twice, during a reveal, or after the game ended', () => {
    const revealed = eliminate(makeRound(5, ['p1']), 'p2');
    expect(canEliminate(revealed, 'p3')).toBe(false);
    expect(eliminate(revealed, 'p3')).toBe(revealed);

    const next = dismissReveal(revealed);
    expect(canEliminate(next, 'p2')).toBe(false);
    expect(canEliminate(next, 'p3')).toBe(true);
    expect(canEliminate(next, 'nobody')).toBe(false);

    const over = freeGuess(next, true);
    expect(canEliminate(over, 'p3')).toBe(false);
  });
});

describe('resolveLastGuess', () => {
  it('a correct last guess wins for the imposters', () => {
    const round = resolveLastGuess(eliminate(makeRound(5, ['p1']), 'p1'), true);
    expect(round.winner).toBe('imposters');
    expect(round.winReason).toBe('lastGuess');
    expect(round.guessPending).toBeFalsy();
  });

  it('a wrong last guess wins for the players when every imposter is caught', () => {
    const round = resolveLastGuess(eliminate(makeRound(5, ['p1']), 'p1'), false);
    expect(round.winner).toBe('crew');
    expect(round.winReason).toBe('allCaught');
  });

  it('with two imposters, the game goes on after the first is caught', () => {
    let round = resolveLastGuess(eliminate(makeRound(8, ['p1', 'p2']), 'p1'), false);
    expect(round.winner).toBeUndefined();
    expect(round.revealedId).toBe('p1');
    round = dismissReveal(round);
    expect(round.revealedId).toBeUndefined();

    round = resolveLastGuess(eliminate(round, 'p2'), false);
    expect(round.winner).toBe('crew');
  });

  it('two imposters win when they equal the regular players left', () => {
    // 7 שחקנים: 2 מתחזים ו-5 רגילים. אחרי 3 הדחות של רגילים נשארים 2 מול 2
    let round = makeRound(7, ['p1', 'p2']);
    for (const id of ['p3', 'p4']) round = dismissReveal(eliminate(round, id));
    expect(round.winner).toBeUndefined();
    round = eliminate(round, 'p5');
    expect(round.winner).toBe('imposters');
    expect(round.winReason).toBe('outnumbered');
  });

  it('does nothing when nobody is guessing', () => {
    const round = makeRound(5, ['p1']);
    expect(resolveLastGuess(round, true)).toBe(round);
  });
});

describe('dismissReveal', () => {
  it('cannot skip a pending last guess', () => {
    const round = eliminate(makeRound(5, ['p1']), 'p1');
    expect(dismissReveal(round)).toBe(round);
  });
});

describe('freeGuess', () => {
  it('a correct free guess wins for the imposters, a wrong one loses', () => {
    expect(freeGuess(makeRound(5, ['p1']), true)).toMatchObject({ winner: 'imposters', winReason: 'freeGuessRight' });
    expect(freeGuess(makeRound(5, ['p1']), false)).toMatchObject({ winner: 'crew', winReason: 'freeGuessWrong' });
  });

  it('is not possible during a last guess', () => {
    const round = eliminate(makeRound(5, ['p1']), 'p1');
    expect(freeGuess(round, true)).toBe(round);
  });
});

describe('declareWinner', () => {
  it('sets the winner only if the app did not decide already', () => {
    expect(declareWinner(makeRound(5, ['p1']), 'crew')).toMatchObject({ winner: 'crew', winReason: 'manual' });
    const decided = freeGuess(makeRound(5, ['p1']), true);
    expect(declareWinner(decided, 'crew')).toBe(decided);
  });
});

describe('roundPoints', () => {
  it('gives every regular player a point when the players win, including eliminated ones', () => {
    const round = declareWinner({ ...makeRound(4, ['p2']), eliminatedIds: ['p3'] }, 'crew');
    expect(roundPoints(round)).toEqual({ p1: CREW_POINTS, p3: CREW_POINTS, p4: CREW_POINTS });
  });

  it('gives every imposter more points when the imposters win', () => {
    const round = declareWinner(makeRound(8, ['p2', 'p5']), 'imposters');
    expect(roundPoints(round)).toEqual({ p2: IMPOSTER_POINTS, p5: IMPOSTER_POINTS });
  });

  it('gives nothing before there is a winner', () => {
    expect(roundPoints(makeRound(4, ['p1']))).toEqual({});
  });
});

describe('reducer: playing a round', () => {
  const playing = (round: Round, scores: Record<string, number> = {}): AppState => ({
    ...initialState,
    phase: 'start',
    round,
    scores,
  });

  it('adds the points once, when the winner is decided', () => {
    let state = playing(makeRound(4, ['p1']), { p1: 1, p2: 2 });
    state = reducer(state, { type: 'eliminate', playerId: 'p1' });
    expect(state.scores).toEqual({ p1: 1, p2: 2 });
    state = reducer(state, { type: 'lastGuess', correct: true });
    expect(state.scores).toEqual({ p1: 1 + IMPOSTER_POINTS, p2: 2 });
    state = reducer(state, { type: 'lastGuess', correct: true });
    expect(state.scores).toEqual({ p1: 1 + IMPOSTER_POINTS, p2: 2 });

    state = reducer(state, { type: 'endRound' });
    expect(state.phase).toBe('roundEnd');
    state = reducer(state, { type: 'setWinner', winner: 'crew' });
    expect(state.round?.winner).toBe('imposters');
    expect(state.scores).toEqual({ p1: 1 + IMPOSTER_POINTS, p2: 2 });
  });

  it('a free guess goes straight to the round end', () => {
    const state = reducer(playing(makeRound(4, ['p1'])), { type: 'freeGuess', correct: false });
    expect(state.phase).toBe('roundEnd');
    expect(state.round?.winner).toBe('crew');
    expect(state.scores).toEqual({ p2: 1, p3: 1, p4: 1 });
  });

  it('the players can mark the winner at the round end when the app does not know', () => {
    let state = reducer(playing(makeRound(4, ['p1'])), { type: 'endRound' });
    expect(state.round?.winner).toBeUndefined();
    state = reducer(state, { type: 'setWinner', winner: 'imposters' });
    expect(state.scores).toEqual({ p1: IMPOSTER_POINTS });
  });

  it('ignores game actions outside the round', () => {
    expect(reducer(initialState, { type: 'eliminate', playerId: 'p1' })).toBe(initialState);
    expect(reducer(initialState, { type: 'setWinner', winner: 'crew' })).toBe(initialState);
  });
});
