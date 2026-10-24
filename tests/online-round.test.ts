import { describe, expect, it } from 'vitest';
import { PROTOCOL_VERSION, type ClientMessage, type ErrorCode, type RoomState } from '../src/online/protocol';
import { act, createRoom, join, parseMessage, upgradeRoom, view, type Room } from '../worker/logic';
import { seededRng } from './helpers';

const NOW = 1_000_000;
const NAMES = ['דנה', 'יוסי', 'רוני', 'מיכל', 'עומר', 'שירה', 'אבי', 'נועה'];

function roomWith(count: number): Room {
  let room = createRoom('482731', NOW);
  for (const name of NAMES.slice(0, count)) {
    const result = join(room, name, PROTOCOL_VERSION, `token-${name}`.padEnd(16, '-'), NOW);
    if ('error' in result) throw new Error(result.error);
    room = result.room;
  }
  return room;
}

function ok<T extends object>(result: T): Exclude<T, { error: ErrorCode }> {
  if ('error' in result) throw new Error(`unexpected error: ${String(result.error)}`);
  return result as Exclude<T, { error: ErrorCode }>;
}

/** p1 הוא המארח */
function send(room: Room, playerId: string, message: ClientMessage, seed = 1): Room {
  return ok(act(room, playerId, message, NOW, seededRng(seed))).room;
}

function started(count: number, seed = 1): Room {
  return send(roomWith(count), 'p1', { type: 'game:start' }, seed);
}

/** כל הטקסטים במצב שנשלח לטלפון */
function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (typeof value === 'object' && value !== null) return Object.values(value).flatMap(strings);
  return [];
}

const allIn = (room: Room) => room.players.map((player) => player.id);

describe('settings', () => {
  it('lets only the host change them, and only in the lobby', () => {
    const room = roomWith(3);
    const settings = { categories: [], imposterCount: 2 as const, imposterNeverStarts: false, showCategory: true };
    expect(act(room, 'p2', { type: 'lobby:settings', settings }, NOW)).toEqual({ error: 'not_host' });
    expect(send(room, 'p1', { type: 'lobby:settings', settings }).settings).toEqual(settings);
    expect(act(started(3), 'p1', { type: 'lobby:settings', settings }, NOW)).toEqual({ error: 'wrong_phase' });
  });

  it('drops categories that are not in the word bank', () => {
    const settings = { categories: ['ספורט', 'לא קיים'], imposterCount: 1 as const, imposterNeverStarts: true, showCategory: false };
    expect(send(roomWith(3), 'p1', { type: 'lobby:settings', settings }).settings.categories).toEqual(['ספורט']);
  });
});

describe('starting a round', () => {
  it('needs the host and at least 3 players', () => {
    expect(act(roomWith(3), 'p2', { type: 'game:start' }, NOW)).toEqual({ error: 'not_host' });
    expect(act(roomWith(2), 'p1', { type: 'game:start' }, NOW)).toEqual({ error: 'not_enough_players' });
  });

  it('puts everyone in the room into the round, in seating order', () => {
    const room = started(4);
    expect(room.phase).toBe('reveal');
    expect(room.round!.players.map((p) => p.id)).toEqual(['p1', 'p2', 'p3', 'p4']);
    expect(room.roundNumber).toBe(1);
  });

  it('uses two imposters only from 7 players', () => {
    const two = { categories: [], imposterCount: 2 as const, imposterNeverStarts: true, showCategory: false };
    const six = send(send(roomWith(6), 'p1', { type: 'lobby:settings', settings: two }), 'p1', { type: 'game:start' });
    const seven = send(send(roomWith(7), 'p1', { type: 'lobby:settings', settings: two }), 'p1', { type: 'game:start' });
    expect(six.round!.imposterIds).toHaveLength(1);
    expect(seven.round!.imposterIds).toHaveLength(2);
  });

  it('never lets an imposter start when the setting is on', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const round = started(3, seed).round!;
      expect(round.imposterIds).not.toContain(round.players[round.startIndex].id);
    }
  });

  it('does not repeat words between rounds', () => {
    let room = started(3);
    const words = [room.round!.word];
    for (let i = 2; i <= 10; i++) {
      room = send(send(room, 'p1', { type: 'round:end' }), 'p1', { type: 'round:next' }, i);
      words.push(room.round!.word);
    }
    expect(new Set(words).size).toBe(words.length);
  });
});

describe('reveal', () => {
  it('moves to play once everyone has seen their role', () => {
    let room = started(3);
    room = send(room, 'p1', { type: 'role:seen' });
    room = send(room, 'p2', { type: 'role:seen' });
    expect(room.phase).toBe('reveal');
    expect(send(room, 'p3', { type: 'role:seen' }).phase).toBe('play');
  });

  it('lets the host move on without waiting', () => {
    expect(act(started(3), 'p2', { type: 'reveal:skip' }, NOW)).toEqual({ error: 'not_host' });
    expect(send(started(3), 'p1', { type: 'reveal:skip' }).phase).toBe('play');
  });

  it('ignores seen from a player who joined in the middle', () => {
    const late = ok(join(started(3), 'מאוחר', PROTOCOL_VERSION, 'token-late-------', NOW));
    expect(act(late.room, late.playerId, { type: 'role:seen' }, NOW)).toEqual({ error: 'wrong_phase' });
  });
});

describe('joining and leaving mid-round', () => {
  it('lets a late player wait for the next round', () => {
    const late = ok(join(started(3), 'מאוחר', PROTOCOL_VERSION, 'token-late-------', NOW));
    const state = view(late.room, late.playerId, new Set());
    expect(state.round!.role).toBeNull();

    const next = send(send(late.room, 'p1', { type: 'round:end' }), 'p1', { type: 'round:next' });
    expect(next.round!.players.map((p) => p.id)).toContain(late.playerId);
  });

  it('keeps going when a regular player leaves', () => {
    let room = started(4, 3);
    const crew = room.round!.players.find((p) => !room.round!.imposterIds.includes(p.id) && p.id !== 'p1')!.id;
    for (const id of allIn(room).filter((id) => id !== crew)) room = send(room, id, { type: 'role:seen' });
    expect(room.phase).toBe('reveal');

    room = send(room, crew, { type: 'room:leave' });
    expect(room.leftIds).toEqual([crew]);
    // כל מי שנשאר כבר ראה
    expect(room.phase).toBe('play');
  });

  it('ends the round when an imposter leaves', () => {
    let room = started(4, 5);
    const imposter = room.round!.imposterIds[0];
    // המארח לא יכול להוציא את עצמו, אז אם הוא המתחזה הוא יוצא בעצמו
    room =
      imposter === 'p1'
        ? send(room, 'p1', { type: 'room:leave' })
        : send(room, 'p1', { type: 'lobby:kick', playerId: imposter });
    expect(room.phase).toBe('roundEnd');
    expect(room.imposterLeft).toBe(true);
  });
});

describe('ending a round', () => {
  it('lets only the host end the round, start the next one, or go back to the lobby', () => {
    const room = started(3);
    expect(act(room, 'p2', { type: 'round:end' }, NOW)).toEqual({ error: 'not_host' });
    const ended = send(room, 'p1', { type: 'round:end' });
    expect(ended.phase).toBe('roundEnd');
    expect(send(ended, 'p1', { type: 'round:next' }).roundNumber).toBe(2);

    const lobby = send(ended, 'p1', { type: 'round:lobby' });
    expect(lobby.phase).toBe('lobby');
    expect(lobby.round).toBeUndefined();
  });

  it('rejects round actions in the wrong phase', () => {
    expect(act(roomWith(3), 'p1', { type: 'round:end' }, NOW)).toEqual({ error: 'wrong_phase' });
    expect(act(started(3), 'p1', { type: 'round:next' }, NOW)).toEqual({ error: 'wrong_phase' });
    expect(act(started(3), 'p1', { type: 'game:start' }, NOW)).toEqual({ error: 'wrong_phase' });
  });
});

describe('🔒 what each phone sees', () => {
  /** כל ה-view בכל השלבים של סבב, לכמה הגרלות וגדלים */
  function* states(): Generator<{ room: Room; id: string; state: RoomState }> {
    for (const count of [3, 5, 8]) {
      for (let seed = 1; seed <= 15; seed++) {
        const twoImposters = { categories: [], imposterCount: 2 as const, imposterNeverStarts: false, showCategory: seed % 2 === 0 };
        let room = send(roomWith(count), 'p1', { type: 'lobby:settings', settings: twoImposters });
        room = send(room, 'p1', { type: 'game:start' }, seed);
        const phases = [room, send(room, 'p1', { type: 'reveal:skip' })];
        for (const r of phases) for (const id of allIn(r)) yield { room: r, id, state: view(r, id, new Set()) };
      }
    }
  }

  it('gives each player only their own role before the round ends', () => {
    for (const { room, id, state } of states()) {
      const round = room.round!;
      const texts = strings(state);
      const isImposter = round.imposterIds.includes(id);

      expect(state.round!.reveal).toBeUndefined();
      expect(JSON.stringify(state)).not.toContain('imposterIds');
      expect(JSON.stringify(state)).not.toContain('token');
      if (isImposter) {
        expect(state.round!.role).toEqual({ kind: 'imposter', hint: round.hints[id] });
        expect(texts).not.toContain(round.word);
        for (const other of round.imposterIds.filter((o) => o !== id)) {
          if (round.hints[other] !== round.hints[id]) expect(texts).not.toContain(round.hints[other]);
        }
      } else {
        expect(state.round!.role).toEqual({ kind: 'crew', word: round.word });
        for (const hint of Object.values(round.hints)) expect(texts).not.toContain(hint);
      }
    }
  });

  it('shows the category only when the setting is on', () => {
    for (const { room, state } of states()) {
      if (room.round!.showCategory) expect(state.round!.category).toBe(room.round!.category);
      else expect(state.round!.category).toBeUndefined();
    }
  });

  it('reveals the word and the imposters to everyone at the end', () => {
    const room = send(started(4), 'p1', { type: 'round:end' });
    for (const id of allIn(room)) {
      const reveal = view(room, id, new Set()).round!.reveal!;
      expect(reveal.word).toBe(room.round!.word);
      expect(reveal.imposters.map((i) => i.id)).toEqual(room.round!.imposterIds);
    }
  });
});

describe('older rooms and messages', () => {
  it('fills in defaults for a room saved before rounds existed', () => {
    const { settings, phase, usedWords, ...old } = roomWith(2);
    void settings;
    void phase;
    void usedWords;
    const room = upgradeRoom(old as Room);
    expect(room.phase).toBe('lobby');
    expect(room.settings.imposterCount).toBe(1);
    expect(room.players).toHaveLength(2);
  });

  it('parses the new messages', () => {
    expect(parseMessage('{"type":"game:start"}')).toEqual({ type: 'game:start' });
    expect(parseMessage('{"type":"role:seen","x":1}')).toEqual({ type: 'role:seen' });
    expect(
      parseMessage(
        '{"type":"lobby:settings","settings":{"categories":["ספורט"],"imposterCount":2,"imposterNeverStarts":true,"showCategory":false}}',
      ),
    ).toEqual({
      type: 'lobby:settings',
      settings: { categories: ['ספורט'], imposterCount: 2, imposterNeverStarts: true, showCategory: false },
    });
    expect(parseMessage('{"type":"lobby:settings","settings":{"categories":[],"imposterCount":3}}')).toBeNull();
  });
});
