import { describe, expect, it } from 'vitest';
import { actionEvent, resultEvent } from '../src/analytics/events';
import { initialState, reducer, startRoundAction } from '../src/game/reducer';
import { blankPlayers } from '../src/game/setup';
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
      settings: {
        players: blankPlayers(5).map((p, i) => ({ ...p, name: ['דנה', '', 'יוסי'][i] ?? '' })),
        categories: ['מקומות', 'אוכל'],
        showCategory: true,
      },
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
    expect(actionEvent(inSetup(), { type: 'updateSettings', settings: { players: blankPlayers(6) } })).toBeNull();
    expect(actionEvent(inSetup(), { type: 'confirmPlayer' })).toBeNull();
  });
});

describe('resultEvent', () => {
  function playing(): AppState {
    const setup = inSetup();
    return { ...reducer(setup, startRoundAction(setup, testBank, seededRng(5))), phase: 'start' };
  }

  it('reports the winner once, when it is decided', () => {
    const before = playing();
    const after = reducer(before, { type: 'freeGuess', correct: false });
    expect(resultEvent(before, after)).toEqual({
      name: 'round_result',
      data: {
        winner: 'crew',
        reason: 'freeGuessWrong',
        players: 4,
        imposters: 1,
        eliminated: 0,
        word: before.round!.word,
        word_category: before.round!.category,
      },
    });
    expect(resultEvent(after, after)).toBeNull();
  });

  it('says nothing while the game goes on', () => {
    const before = playing();
    const crew = before.round!.players.find((p) => !before.round!.imposterIds.includes(p.id))!;
    expect(resultEvent(before, reducer(before, { type: 'eliminate', playerId: crew.id }))).toBeNull();
  });

  it('reports who was eliminated', () => {
    const state = playing();
    const imposter = state.round!.imposterIds[0];
    expect(actionEvent(state, { type: 'eliminate', playerId: imposter })).toEqual({
      name: 'player_eliminated',
      data: { was_imposter: true, players: 4, eliminated: 1 },
    });
  });
});

describe('word_feedback', () => {
  function round(phase: AppState['phase']): AppState {
    const setup = inSetup();
    return { ...reducer(setup, startRoundAction(setup, testBank, seededRng(6))), phase };
  }

  it('reports a word problem during the round or at its end, once', () => {
    const playing = round('start');
    const event = actionEvent(playing, { type: 'reportWord', problem: 'unknown_word' });
    expect(event?.name).toBe('word_feedback');
    expect(event?.data).toMatchObject({ kind: 'unknown_word', during_round: true, word: playing.round!.word });

    const ended = round('roundEnd');
    expect(actionEvent(ended, { type: 'reportWord', problem: 'hint_too_strong' })?.data?.during_round).toBe(false);

    const reported = reducer(playing, { type: 'reportWord', problem: 'unknown_word' });
    expect(actionEvent(reported, { type: 'reportWord', problem: 'unknown_word' })).toBeNull();
  });
});
