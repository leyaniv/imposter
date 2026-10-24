import { describe, expect, it } from 'vitest';
import { PROTOCOL_VERSION, type ClientMessage, type ErrorCode } from '../src/online/protocol';
import {
  HOST_AWAY_MS,
  act,
  cleanupAt,
  createRoom,
  hostTimeout,
  join,
  nextAlarm,
  parseMessage,
  trackHost,
  upgradeRoom,
  view,
  type Room,
} from '../worker/logic';
import { seededRng } from './helpers';

const NOW = 1_000_000;
const NAMES = ['דנה', 'יוסי', 'רוני', 'מיכל', 'עומר'];

function ok<T extends object>(result: T): Exclude<T, { error: ErrorCode }> {
  if ('error' in result) throw new Error(`unexpected error: ${String(result.error)}`);
  return result as Exclude<T, { error: ErrorCode }>;
}

function roomWith(count: number): Room {
  let room = createRoom('482731', NOW);
  for (const name of NAMES.slice(0, count)) {
    room = ok(join(room, name, PROTOCOL_VERSION, `token-${name}`.padEnd(16, '-'), NOW)).room;
  }
  return room;
}

function send(room: Room, playerId: string, message: ClientMessage, connected?: ReadonlySet<string>): Room {
  return ok(act(room, playerId, message, NOW, { rng: seededRng(1), connected })).room;
}

function error(room: Room, playerId: string, message: ClientMessage) {
  const result = act(room, playerId, message, NOW, { rng: seededRng(1) });
  return 'error' in result ? result.error : null;
}

/** סבב בשלב הדיבור, p1 מארח */
function playing(count: number, seed = 1): Room {
  const room = ok(act(roomWith(count), 'p1', { type: 'game:start' }, NOW, { rng: seededRng(seed) })).room;
  return send(room, 'p1', { type: 'reveal:skip' });
}

describe('handing over hosting', () => {
  it('lets only the host hand over, to someone else in the room', () => {
    const room = roomWith(3);
    expect(error(room, 'p2', { type: 'host:transfer', playerId: 'p3' })).toBe('not_host');
    expect(error(room, 'p1', { type: 'host:transfer', playerId: 'p1' })).toBe('bad_message');
    expect(error(room, 'p1', { type: 'host:transfer', playerId: 'p9' })).toBe('bad_message');
    expect(send(room, 'p1', { type: 'host:transfer', playerId: 'p3' }).hostId).toBe('p3');
  });

  it('works in the middle of a round, but not during a vote or a guess', () => {
    const room = playing(4);
    expect(send(room, 'p1', { type: 'host:transfer', playerId: 'p2' }).hostId).toBe('p2');

    const voting = send(room, 'p3', { type: 'vote:start', targetId: 'p4' });
    expect(error(voting, 'p1', { type: 'host:transfer', playerId: 'p2' })).toBe('busy');
    const guessing = send(room, 'p3', { type: 'guess:start' });
    expect(error(guessing, 'p1', { type: 'host:transfer', playerId: 'p2' })).toBe('busy');
  });
});

describe('the host leaving', () => {
  it('hands hosting to the player they chose', () => {
    expect(send(roomWith(4), 'p1', { type: 'room:leave', newHostId: 'p3' }).hostId).toBe('p3');
  });

  it('picks the next connected player when no one was chosen', () => {
    const connected = new Set(['p1', 'p3', 'p4']);
    expect(send(roomWith(4), 'p1', { type: 'room:leave' }, connected).hostId).toBe('p3');
  });

  it('ignores a choice that is not in the room', () => {
    expect(send(roomWith(3), 'p1', { type: 'room:leave', newHostId: 'p9' }).hostId).toBe('p2');
  });

  it('falls back to the next player when nobody is connected', () => {
    expect(send(roomWith(3), 'p1', { type: 'room:leave' }, new Set(['p1'])).hostId).toBe('p2');
  });

  it('only lets the host choose a replacement', () => {
    expect(send(roomWith(3), 'p2', { type: 'room:leave', newHostId: 'p3' }).hostId).toBe('p1');
  });
});

describe('a host who disappears', () => {
  const others = new Set(['p2', 'p3']);

  it('notes when the host disconnects, and forgets it when they come back', () => {
    const away = trackHost(roomWith(3), others, NOW);
    expect(away.hostAwaySince).toBe(NOW);
    expect(trackHost(away, others, NOW + 5).hostAwaySince).toBe(NOW);
    expect(trackHost(away, new Set(['p1', 'p2']), NOW + 5).hostAwaySince).toBeUndefined();
  });

  it(`hands hosting over after ${HOST_AWAY_MS / 60000} minutes`, () => {
    const away = trackHost(roomWith(3), others, NOW);
    expect(hostTimeout(away, others, NOW + HOST_AWAY_MS - 1).hostId).toBe('p1');
    const moved = hostTimeout(away, others, NOW + HOST_AWAY_MS);
    expect(moved.hostId).toBe('p2');
    expect(moved.hostAwaySince).toBeUndefined();
  });

  it('keeps the host when they came back in time', () => {
    const away = trackHost(roomWith(3), others, NOW);
    const back = hostTimeout(away, new Set(['p1', 'p2', 'p3']), NOW + HOST_AWAY_MS);
    expect(back.hostId).toBe('p1');
    expect(back.hostAwaySince).toBeUndefined();
  });

  it('waits when nobody else is connected either', () => {
    const away = trackHost(roomWith(3), new Set(), NOW);
    expect(hostTimeout(away, new Set(), NOW + HOST_AWAY_MS).hostId).toBe('p1');
  });

  it('wakes up for whichever comes first: the handover or the cleanup', () => {
    const room = roomWith(3);
    expect(nextAlarm(room)).toBe(cleanupAt(room));
    expect(nextAlarm(trackHost(room, others, NOW))).toBe(NOW + HOST_AWAY_MS);
  });

  it('clears the waiting time when hosting is handed over by hand', () => {
    const away = trackHost(roomWith(3), others, NOW);
    expect(send(away, 'p1', { type: 'host:transfer', playerId: 'p2' }).hostAwaySince).toBeUndefined();
  });
});

describe('changing seats mid-round', () => {
  it('reorders the round and keeps the same starter', () => {
    const room = playing(4);
    const round = room.round!;
    const starter = round.players[round.startIndex].id;

    const moved = send(room, 'p1', { type: 'lobby:reorder', playerIds: ['p4', 'p3', 'p2', 'p1'] });
    expect(moved.round!.players.map((p) => p.id)).toEqual(['p4', 'p3', 'p2', 'p1']);
    expect(moved.round!.players[moved.round!.startIndex].id).toBe(starter);
    expect(view(moved, 'p2', new Set()).round!.starterId).toBe(starter);
  });

  it('keeps a player who left in their seat, and leaves out a late joiner', () => {
    let room = playing(4);
    const imposter = room.round!.imposterIds[0];
    const leaver = ['p2', 'p3', 'p4'].find((id) => id !== imposter)!;
    room = send(room, 'p1', { type: 'lobby:kick', playerId: leaver });
    room = ok(join(room, 'עומר', PROTOCOL_VERSION, 'token-late-------', NOW)).room;

    const order = [...room.players.map((p) => p.id)].reverse();
    const moved = send(room, 'p1', { type: 'lobby:reorder', playerIds: order });
    const seats = moved.round!.players.map((p) => p.id);
    expect(seats).toHaveLength(4);
    expect(seats.indexOf(leaver)).toBe(['p1', 'p2', 'p3', 'p4'].indexOf(leaver));
    expect(seats).not.toContain('p5');
  });

  it('is blocked during a vote, a free guess or a last guess', () => {
    const room = playing(4);
    const order = { type: 'lobby:reorder' as const, playerIds: ['p2', 'p1', 'p3', 'p4'] };
    expect(error(send(room, 'p3', { type: 'vote:start', targetId: 'p4' }), 'p1', order)).toBe('busy');
    expect(error(send(room, 'p3', { type: 'guess:start' }), 'p1', order)).toBe('busy');
  });

  it('can remove a player mid-round', () => {
    const room = playing(5);
    const crew = room.round!.players.map((p) => p.id).find((id) => id !== 'p1' && !room.round!.imposterIds.includes(id))!;
    const after = send(room, 'p1', { type: 'lobby:kick', playerId: crew });
    expect(after.players.map((p) => p.id)).not.toContain(crew);
    expect(after.round!.eliminatedIds).toContain(crew);
  });
});

describe('messages and saved rooms', () => {
  it('parses the leave choice and the handover', () => {
    expect(parseMessage('{"type":"room:leave"}')).toEqual({ type: 'room:leave' });
    expect(parseMessage('{"type":"room:leave","newHostId":"p3"}')).toEqual({ type: 'room:leave', newHostId: 'p3' });
    expect(parseMessage('{"type":"host:transfer","playerId":"p2"}')).toEqual({ type: 'host:transfer', playerId: 'p2' });
    expect(parseMessage('{"type":"host:transfer"}')).toBeNull();
  });

  it('loads a room saved before hosting was tracked', () => {
    const { hostAwaySince, ...old } = roomWith(2);
    void hostAwaySince;
    expect(upgradeRoom(old as Room).hostAwaySince).toBeUndefined();
  });
});
