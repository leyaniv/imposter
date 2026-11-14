import { describe, expect, it } from 'vitest';
import { ROOM_IDLE_MS } from '../src/online/protocol';
import { latestRoom, parseRooms, type Session } from '../src/online/session';

const NOW = 10_000_000_000;
const room = (code: string, seenAt?: number, joined = true): Session => ({
  code,
  token: `token-${code}`,
  joined,
  ...(seenAt !== undefined && { seenAt }),
});

describe('saved rooms', () => {
  it('keeps several rooms by code', () => {
    const rooms = parseRooms({ '111111': room('111111', NOW - 1000), '222222': room('222222', NOW - 5000) }, null, NOW);
    expect(Object.keys(rooms).sort()).toEqual(['111111', '222222']);
  });

  it('forgets rooms the phone has not seen since the server would have deleted them', () => {
    const rooms = parseRooms({ old: room('111111', NOW - ROOM_IDLE_MS), recent: room('222222', NOW - 1000) }, null, NOW);
    expect(Object.keys(rooms)).toEqual(['222222']);
  });

  it('keeps a join that is still in progress', () => {
    expect(parseRooms({ a: room('333333', undefined, false) }, null, NOW)['333333'].joined).toBe(false);
  });

  it('brings over the single room saved by the previous version, without offering it on the home screen', () => {
    const rooms = parseRooms(null, room('444444'), NOW);
    expect(rooms['444444'].token).toBe('token-444444');
    expect(latestRoom(rooms, NOW)).toBeNull();
  });

  it('ignores broken data', () => {
    expect(parseRooms('garbage', 7, NOW)).toEqual({});
    expect(parseRooms({ a: { code: 1 }, b: null }, { token: 'x' }, NOW)).toEqual({});
  });

  it('offers the most recently seen room the phone joined', () => {
    const rooms = parseRooms(
      { a: room('111111', NOW - 9000), b: room('222222', NOW - 1000), c: room('333333', undefined, false) },
      null,
      NOW,
    );
    expect(latestRoom(rooms, NOW)?.code).toBe('222222');
    expect(latestRoom({}, NOW)).toBeNull();
    expect(latestRoom({ c: room('333333', undefined, false) }, NOW)).toBeNull();
  });
});
