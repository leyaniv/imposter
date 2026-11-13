import { describe, expect, it } from 'vitest';
import { PROTOCOL_VERSION, type ClientMessage, type ErrorCode } from '../src/online/protocol';
import { act, createRoom, join, parseMessage, view, type Room } from '../worker/logic';
import { seededRng } from './helpers';

const NOW = 1_000_000;
const NAMES = ['דנה', 'יוסי', 'רוני', 'מיכל', 'עומר', 'שירה'];

function ok<T extends object>(result: T): Exclude<T, { error: ErrorCode }> {
  if ('error' in result) throw new Error(`unexpected error: ${String(result.error)}`);
  return result as Exclude<T, { error: ErrorCode }>;
}

function send(room: Room, playerId: string, message: ClientMessage): Room {
  return ok(act(room, playerId, message, NOW, { rng: seededRng(1) })).room;
}

function error(room: Room, playerId: string, message: ClientMessage) {
  const result = act(room, playerId, message, NOW, { rng: seededRng(1) });
  return 'error' in result ? result.error : null;
}

/** סבב בשלב הדיבור. p1 הוא המארח, ומי שמתחיל תמיד לא המתחזה */
function playing(count: number): Room {
  let room = createRoom('482731', NOW, {
    categories: [],
    imposterCount: 1,
    imposterNeverStarts: true,
    showCategory: false,
    secretVote: false,
  });
  for (const name of NAMES.slice(0, count)) {
    room = ok(join(room, name, PROTOCOL_VERSION, `token-${name}`.padEnd(16, '-'), NOW)).room;
  }
  room = ok(act(room, 'p1', { type: 'game:start' }, NOW, { rng: seededRng(1) })).room;
  return send(room, 'p1', { type: 'reveal:skip' });
}

const turn = (room: Room) => view(room, 'p1', new Set(room.players.map((p) => p.id))).round!.turn;
const seat = (room: Room, offset: number) => {
  const { players, startIndex } = room.round!;
  return players[(startIndex + offset) % players.length].id;
};
const crew = (room: Room) => room.round!.players.map((p) => p.id).filter((id) => !room.round!.imposterIds.includes(id));
/** מי שמחזיק את התור מקדם אותו */
const pass = (room: Room) => send(room, turn(room).playerId, { type: 'turn:next', turn: turn(room).number });

/** כולם חוץ מהנאשם מדיחים אותו, ולוחצים "ממשיכים" */
function voteOut(room: Room, target: string): Room {
  const voters = room.round!.players.map((p) => p.id).filter((id) => id !== target && !room.round!.eliminatedIds.includes(id));
  let next = send(room, voters[0], { type: 'vote:start', targetId: target });
  for (const id of voters.slice(1)) next = send(next, id, { type: 'vote:cast', yes: true });
  return send(next, 'p1', { type: 'reveal:continue' });
}

describe('the current turn', () => {
  it('starts with whoever was drawn', () => {
    const room = playing(4);
    expect(turn(room)).toEqual({ playerId: seat(room, 0), number: 0 });
  });

  it('moves clockwise when the speaker passes it on', () => {
    const room = pass(playing(4));
    expect(turn(room)).toEqual({ playerId: seat(room, 1), number: 1 });
  });

  it('can be moved by the host on someone else’s turn', () => {
    let room = playing(4);
    while (turn(room).playerId === 'p1') room = pass(room);
    const next = send(room, 'p1', { type: 'turn:next', turn: turn(room).number });
    expect(turn(next).number).toBe(turn(room).number + 1);
  });

  it('cannot be moved by anyone else', () => {
    let room = playing(4);
    while (turn(room).playerId === 'p2' || turn(room).playerId === 'p1') room = pass(room);
    expect(error(room, 'p2', { type: 'turn:next', turn: turn(room).number })).toBe('not_allowed');
  });

  it('moves once when the speaker and the host press together', () => {
    let room = playing(4);
    while (turn(room).playerId === 'p1') room = pass(room);
    const seen = turn(room).number;
    room = send(room, turn(room).playerId, { type: 'turn:next', turn: seen });
    room = send(room, 'p1', { type: 'turn:next', turn: seen });
    expect(turn(room).number).toBe(seen + 1);
  });

  it('goes around back to whoever started', () => {
    let room = playing(4);
    for (let i = 0; i < 4; i++) room = pass(room);
    expect(turn(room)).toEqual({ playerId: seat(room, 0), number: 4 });
  });

  it('waits while a vote is open, and stays put when the vote fails', () => {
    let room = pass(playing(4));
    const before = turn(room);
    const target = crew(room).find((id) => id !== 'p1')!;
    const opener = room.round!.players.map((p) => p.id).find((id) => id !== target)!;
    room = send(room, opener, { type: 'vote:start', targetId: target });
    expect(error(room, 'p1', { type: 'turn:next', turn: before.number })).toBe('busy');
    for (const id of room.round!.players.map((p) => p.id)) {
      if (room.vote && id !== target && id !== opener) room = send(room, id, { type: 'vote:cast', yes: false });
    }
    expect(room.lastVote?.eliminated).toBe(false);
    expect(turn(room)).toEqual(before);
  });

  it('clears the failed vote once the turn moves', () => {
    let room = playing(4);
    const target = crew(room).find((id) => id !== 'p1')!;
    room = send(room, 'p1', { type: 'vote:start', targetId: target });
    room = send(room, 'p1', { type: 'vote:close' });
    expect(room.lastVote?.eliminated).toBe(false);
    room = pass(room);
    expect(room.lastVote).toBeUndefined();
  });

  it('skips players who are out', () => {
    let room = playing(5);
    const out = crew(room).find((id) => id !== seat(room, 0))!;
    room = voteOut(room, out);
    const order = [0, 1, 2, 3, 4].map((i) => seat(room, i)).filter((id) => id !== out);
    const visited = [turn(room).playerId];
    for (let i = 0; i < 3; i++) {
      room = pass(room);
      visited.push(turn(room).playerId);
    }
    expect(visited).toEqual(order);
  });

  it('moves on when the speaker is voted out', () => {
    let room = playing(5);
    while (!crew(room).includes(turn(room).playerId) || turn(room).playerId === seat(room, 0)) room = pass(room);
    const before = turn(room);
    const index = room.round!.players.findIndex((p) => p.id === before.playerId);
    room = voteOut(room, before.playerId);
    const next = room.round!.players[(index + 1) % 5].id;
    expect(turn(room)).toEqual({ playerId: next, number: before.number + 1 });
  });

  it('skips the seat of a starter who is out', () => {
    let room = playing(5);
    room = voteOut(room, seat(room, 0));
    expect(turn(room).playerId).toBe(seat(room, 1));
    for (let i = 0; i < 3; i++) room = pass(room);
    expect(turn(room).playerId).toBe(seat(room, 4));
    room = pass(room);
    expect(turn(room).playerId).toBe(seat(room, 1));
  });

  it('parses the message', () => {
    expect(parseMessage('{"type":"turn:next","turn":3}')).toEqual({ type: 'turn:next', turn: 3 });
    expect(parseMessage('{"type":"turn:next"}')).toBeNull();
    expect(parseMessage('{"type":"turn:next","turn":-1}')).toBeNull();
    expect(parseMessage('{"type":"turn:next","turn":1.5}')).toBeNull();
  });
});
