import { describe, expect, it } from 'vitest';
import { MAX_PLAYERS } from '../src/game/setup';
import { PROTOCOL_VERSION, formatCode, isRoomCode, type ErrorCode } from '../src/online/protocol';
import {
  IDLE_TTL_MS,
  RESERVE_TTL_MS,
  act,
  cleanupAt,
  createRoom,
  join,
  parseMessage,
  rejoin,
  view,
  type Room,
} from '../worker/logic';

const NOW = 1_000_000;

/** טוקן באורך שהשרת מקבל */
const token = (name: string) => `t-${name}`.padEnd(16, '-');

/** חדר עם השחקנים האלה, לפי הסדר. הטוקן של כל שחקן הוא token(שם) */
function roomWith(...names: string[]): Room {
  let room = createRoom('482731', NOW);
  for (const name of names) {
    const result = join(room, name, PROTOCOL_VERSION, token(name), NOW);
    if ('error' in result) throw new Error(result.error);
    room = result.room;
  }
  return room;
}

function ok<T extends object>(result: T): Exclude<T, { error: ErrorCode }> {
  if ('error' in result) throw new Error(`unexpected error: ${String(result.error)}`);
  return result as Exclude<T, { error: ErrorCode }>;
}

describe('join', () => {
  it('makes the first player the host', () => {
    const room = roomWith('דנה', 'יוסי');
    expect(room.hostId).toBe('p1');
    expect(room.players.map((p) => p.name)).toEqual(['דנה', 'יוסי']);
  });

  it('trims the name and collapses spaces', () => {
    const room = roomWith('  דנה   כהן ');
    expect(room.players[0].name).toBe('דנה כהן');
  });

  it('rejects an empty or too long name', () => {
    const room = roomWith();
    expect(join(room, '   ', PROTOCOL_VERSION, 't', NOW)).toEqual({ error: 'name_required' });
    expect(join(room, 'א'.repeat(17), PROTOCOL_VERSION, 't', NOW)).toEqual({ error: 'name_required' });
  });

  it('rejects a name that is already taken, ignoring case and spaces', () => {
    const room = roomWith('Dana');
    expect(join(room, ' dana ', PROTOCOL_VERSION, 't', NOW)).toEqual({ error: 'name_taken' });
  });

  it(`allows at most ${MAX_PLAYERS} players`, () => {
    const room = roomWith(...Array.from({ length: MAX_PLAYERS }, (_, i) => `שחקן${i}`));
    expect(join(room, 'עוד אחד', PROTOCOL_VERSION, 't', NOW)).toEqual({ error: 'room_full' });
  });

  it('rejects another protocol version', () => {
    expect(join(roomWith(), 'דנה', PROTOCOL_VERSION + 1, 't', NOW)).toEqual({ error: 'outdated' });
  });

  it('returns the same player when the same token joins again', () => {
    const room = roomWith('דנה', 'יוסי');
    const again = ok(join(room, 'יוסי', PROTOCOL_VERSION, token('יוסי'), NOW + 5));
    expect(again.playerId).toBe('p2');
    expect(again.room).toBe(room);
  });

  it('never reuses a player id after someone leaves', () => {
    const left = ok(act(roomWith('דנה', 'יוסי'), 'p2', { type: 'room:leave' }, NOW)).room;
    const { playerId } = ok(join(left, 'רוני', PROTOCOL_VERSION, 't-r', NOW));
    expect(playerId).toBe('p3');
  });
});

describe('rejoin', () => {
  it('finds the player by token', () => {
    expect(rejoin(roomWith('דנה', 'יוסי'), token('יוסי'), PROTOCOL_VERSION)).toEqual({ playerId: 'p2' });
  });

  it('rejects an unknown token', () => {
    expect(rejoin(roomWith('דנה'), 'nope', PROTOCOL_VERSION)).toEqual({ error: 'bad_token' });
  });

  it('rejects another protocol version', () => {
    expect(rejoin(roomWith('דנה'), token('דנה'), 0)).toEqual({ error: 'outdated' });
  });
});

describe('leave and kick', () => {
  it('removes a player who leaves', () => {
    const result = ok(act(roomWith('דנה', 'יוסי'), 'p2', { type: 'room:leave' }, NOW));
    expect(result.room.players.map((p) => p.id)).toEqual(['p1']);
    expect(result.left).toEqual({ playerId: 'p2', reason: 'left' });
  });

  it('passes hosting to the next player in seating order when the host leaves', () => {
    const room = ok(act(roomWith('דנה', 'יוסי', 'רוני'), 'p1', { type: 'lobby:reorder', playerIds: ['p2', 'p1', 'p3'] }, NOW)).room;
    expect(ok(act(room, 'p1', { type: 'room:leave' }, NOW)).room.hostId).toBe('p3');
  });

  it('wraps around when the last seat was the host', () => {
    const room = ok(act(roomWith('דנה', 'יוסי'), 'p1', { type: 'lobby:reorder', playerIds: ['p2', 'p1'] }, NOW)).room;
    expect(ok(act(room, 'p1', { type: 'room:leave' }, NOW)).room.hostId).toBe('p2');
  });

  it('clears the host when the room becomes empty, so the next to join hosts', () => {
    const empty = ok(act(roomWith('דנה'), 'p1', { type: 'room:leave' }, NOW)).room;
    expect(empty.hostId).toBeNull();
    expect(ok(join(empty, 'יוסי', PROTOCOL_VERSION, 't', NOW)).room.hostId).toBe('p2');
  });

  it('lets only the host kick, and not themselves', () => {
    const room = roomWith('דנה', 'יוסי', 'רוני');
    expect(act(room, 'p2', { type: 'lobby:kick', playerId: 'p3' }, NOW)).toEqual({ error: 'not_host' });
    expect(act(room, 'p1', { type: 'lobby:kick', playerId: 'p1' }, NOW)).toEqual({ error: 'bad_message' });
    expect(act(room, 'p1', { type: 'lobby:kick', playerId: 'p9' }, NOW)).toEqual({ error: 'bad_message' });

    const result = ok(act(room, 'p1', { type: 'lobby:kick', playerId: 'p3' }, NOW));
    expect(result.room.players.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(result.left).toEqual({ playerId: 'p3', reason: 'kicked' });
  });

  it('forgets the token of a kicked player', () => {
    const room = ok(act(roomWith('דנה', 'יוסי'), 'p1', { type: 'lobby:kick', playerId: 'p2' }, NOW)).room;
    expect(rejoin(room, token('יוסי'), PROTOCOL_VERSION)).toEqual({ error: 'bad_token' });
  });
});

describe('reorder', () => {
  it('lets the host change the seating order', () => {
    const result = ok(act(roomWith('דנה', 'יוסי', 'רוני'), 'p1', { type: 'lobby:reorder', playerIds: ['p3', 'p1', 'p2'] }, NOW));
    expect(result.room.players.map((p) => p.name)).toEqual(['רוני', 'דנה', 'יוסי']);
  });

  it('rejects anyone but the host', () => {
    expect(act(roomWith('דנה', 'יוסי'), 'p2', { type: 'lobby:reorder', playerIds: ['p2', 'p1'] }, NOW)).toEqual({
      error: 'not_host',
    });
  });

  it('rejects a list that is not exactly the same players', () => {
    const room = roomWith('דנה', 'יוסי', 'רוני');
    for (const playerIds of [['p1', 'p2'], ['p1', 'p2', 'p2'], ['p1', 'p2', 'p9'], ['p1', 'p2', 'p3', 'p4']]) {
      expect(act(room, 'p1', { type: 'lobby:reorder', playerIds }, NOW)).toEqual({ error: 'bad_order' });
    }
  });
});

describe('act', () => {
  it('rejects a player who is not in the room', () => {
    expect(act(roomWith('דנה'), 'p7', { type: 'room:leave' }, NOW)).toEqual({ error: 'not_joined' });
  });

  it('updates the last activity time on every change', () => {
    const result = ok(act(roomWith('דנה', 'יוסי'), 'p2', { type: 'room:leave' }, NOW + 5));
    expect(result.room.lastActivity).toBe(NOW + 5);
  });
});

describe('view', () => {
  it('shows names, connection and who is looking, but never tokens', () => {
    const state = view(roomWith('דנה', 'יוסי'), 'p2', new Set(['p1']));
    expect(state).toEqual({
      code: '482731',
      hostId: 'p1',
      players: [
        { id: 'p1', name: 'דנה', connected: true },
        { id: 'p2', name: 'יוסי', connected: false },
      ],
      you: 'p2',
    });
    expect(JSON.stringify(state)).not.toContain('t-');
    expect(JSON.stringify(state)).not.toContain('token');
  });
});

describe('parseMessage', () => {
  it('accepts well-formed messages', () => {
    expect(parseMessage('{"type":"room:join","name":"דנה","token":"0123456789abcdef","version":1}')).toEqual({
      type: 'room:join',
      name: 'דנה',
      token: '0123456789abcdef',
      version: 1,
    });
    expect(parseMessage('{"type":"lobby:reorder","playerIds":["p2","p1"]}')).toEqual({
      type: 'lobby:reorder',
      playerIds: ['p2', 'p1'],
    });
  });

  it('drops unknown fields', () => {
    expect(parseMessage('{"type":"room:leave","hostId":"p9"}')).toEqual({ type: 'room:leave' });
  });

  it('rejects broken or unknown messages', () => {
    for (const raw of [
      'not json',
      'null',
      '"room:leave"',
      '{"type":"game:cheat"}',
      '{"type":"room:join","name":5,"token":"0123456789abcdef","version":1}',
      '{"type":"room:join","name":"דנה","version":1}',
      '{"type":"room:rejoin","token":"short","version":1}',
      '{"type":"room:rejoin","version":1}',
      '{"type":"lobby:kick"}',
      '{"type":"lobby:reorder","playerIds":"p1"}',
      `{"type":"room:join","name":"${'x'.repeat(500)}","token":"0123456789abcdef","version":1}`,
    ]) {
      expect(parseMessage(raw)).toBeNull();
    }
  });
});

describe('cleanupAt', () => {
  it('gives a reserved room a short time to get its first player', () => {
    expect(cleanupAt(createRoom('482731', NOW))).toBe(NOW + RESERVE_TTL_MS);
  });

  it('keeps a used room for two hours after the last change', () => {
    expect(cleanupAt(roomWith('דנה'))).toBe(NOW + IDLE_TTL_MS);
  });
});

describe('room codes', () => {
  it('formats and validates codes', () => {
    expect(formatCode('048213')).toBe('048 213');
    expect(isRoomCode('048213')).toBe(true);
    expect(isRoomCode('48213')).toBe(false);
    expect(isRoomCode('48213a')).toBe(false);
  });
});
