import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../src/game/reducer';
import { chooseStarter, createPlayers, createRound, maxImposters } from '../src/game/setup';
import type { Settings } from '../src/game/types';
import { seededRng, testBank } from './helpers';

const settings = (overrides: Partial<Settings> = {}): Settings => ({ ...defaultSettings, ...overrides });

describe('createPlayers', () => {
  it('keeps seating order and trims names, leaving missing names empty', () => {
    const players = createPlayers(settings({ playerCount: 3, names: [' דנה ', ''] }));
    expect(players).toEqual([
      { id: 'p1', name: 'דנה' },
      { id: 'p2', name: '' },
      { id: 'p3', name: '' },
    ]);
  });
});

describe('maxImposters', () => {
  it('allows two imposters only from 7 players', () => {
    expect(maxImposters(6)).toBe(1);
    expect(maxImposters(7)).toBe(2);
  });
});

describe('chooseStarter', () => {
  const players = createPlayers(settings({ playerCount: 4 }));

  it('never picks an imposter when imposterNeverStarts is on', () => {
    for (let seed = 0; seed < 200; seed++) {
      const index = chooseStarter(players, ['p2'], true, seededRng(seed));
      expect(players[index].id).not.toBe('p2');
    }
  });

  it('can pick anyone, including the imposter, when the option is off', () => {
    const picked = new Set<number>();
    for (let seed = 0; seed < 200; seed++) picked.add(chooseStarter(players, ['p2'], false, seededRng(seed)));
    expect(picked).toEqual(new Set([0, 1, 2, 3]));
  });
});

describe('createRound', () => {
  it('picks one imposter with a hint from the chosen word', () => {
    const { round } = createRound(settings({ playerCount: 5 }), testBank, [], seededRng(1));
    expect(round.players).toHaveLength(5);
    expect(round.imposterIds).toHaveLength(1);
    const entry = testBank.find((e) => e.word === round.word)!;
    expect(entry.hints).toContain(round.hints[round.imposterIds[0]]);
    expect(round.revealIndex).toBe(0);
  });

  it('freezes the show-category setting into the round', () => {
    expect(createRound(settings({ showCategory: true }), testBank, [], seededRng(1)).round.showCategory).toBe(true);
    expect(createRound(settings(), testBank, [], seededRng(1)).round.showCategory).toBe(false);
  });

  it('gives two imposters different hints', () => {
    const { round } = createRound(settings({ playerCount: 8, imposterCount: 2 }), testBank, [], seededRng(3));
    expect(round.imposterIds).toHaveLength(2);
    const [a, b] = round.imposterIds;
    expect(round.hints[a]).not.toBe(round.hints[b]);
  });

  it('caps imposters at one below 7 players', () => {
    const { round } = createRound(settings({ playerCount: 5, imposterCount: 2 }), testBank, [], seededRng(3));
    expect(round.imposterIds).toHaveLength(1);
  });

  it('spreads the imposter role across all players', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 200; seed++) {
      seen.add(createRound(settings({ playerCount: 4 }), testBank, [], seededRng(seed)).round.imposterIds[0]);
    }
    expect(seen).toEqual(new Set(['p1', 'p2', 'p3', 'p4']));
  });
});
