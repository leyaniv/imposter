import { describe, expect, it } from 'vitest';
import { PROTOCOL_VERSION, type ErrorCode } from '../src/online/protocol';
import { act, claimSeat, claimableSeat, join, createRoom, parseMessage, rejoin, view, type Room } from '../worker/logic';
import { seededRng } from './helpers';

const NOW = 1_000_000;
const NAMES = ['דנה', 'יוסי', 'רוני'];
const token = (name: string) => `token-${name}`.padEnd(16, '-');
const NEW_TOKEN = 'another-browser-token';

function ok<T extends object>(result: T): Exclude<T, { error: ErrorCode }> {
  if ('error' in result) throw new Error(`unexpected error: ${String(result.error)}`);
  return result as Exclude<T, { error: ErrorCode }>;
}

/** דנה (p1) מארחת, יוסי (p2) ורוני (p3) */
function lobby(): Room {
  let room = createRoom('482731', NOW);
  for (const name of NAMES) room = ok(join(room, name, PROTOCOL_VERSION, token(name), NOW)).room;
  return room;
}

function playing(): Room {
  return ok(act(lobby(), 'p1', { type: 'game:start' }, NOW, { rng: seededRng(1) })).room;
}

const none = new Set<string>();

describe('coming back to your seat from another browser', () => {
  it('offers the seat of a disconnected player, matching the name loosely', () => {
    const connected = new Set(['p2', 'p3']);
    expect(claimableSeat(lobby(), '  דנה ', connected, none)).toEqual({ playerId: 'p1', name: 'דנה', approval: false });
  });

  it('does not offer a seat whose phone is connected and on screen', () => {
    expect(claimableSeat(lobby(), 'דנה', new Set(['p1', 'p2']), none)).toBeNull();
    expect(claimableSeat(lobby(), 'מישהו', new Set(['p2']), none)).toBeNull();
  });

  it('needs approval for a seat that is still connected but off screen (a browser that was just closed)', () => {
    const seat = claimableSeat(lobby(), 'דנה', new Set(['p1', 'p2']), new Set(['p1']));
    expect(seat).toEqual({ playerId: 'p1', name: 'דנה', approval: true });
  });

  it('needs approval in the middle of a round, so nobody can peek at someone else’s word', () => {
    for (const phase of ['reveal', 'play', 'roundEnd'] as const) {
      expect(claimableSeat({ ...playing(), phase }, 'יוסי', new Set(['p1']), none)?.approval).toBe(true);
    }
  });

  it('moves the seat to the new token: same id, still the host, the old token stops working', () => {
    const room = { ...lobby(), scores: { p1: 3 } };
    const claimed = claimSeat(room, 'p1', NEW_TOKEN, NOW + 5) as Room;
    expect(claimed.hostId).toBe('p1');
    expect(claimed.scores.p1).toBe(3);
    expect(claimed.players.map((player) => player.id)).toEqual(['p1', 'p2', 'p3']);
    expect(claimed.lastActivity).toBe(NOW + 5);
    expect(rejoin(claimed, NEW_TOKEN, PROTOCOL_VERSION)).toEqual({ playerId: 'p1' });
    expect(rejoin(claimed, token('דנה'), PROTOCOL_VERSION)).toEqual({ error: 'bad_token' });
  });

  it('keeps the role of the claimed seat in a round', () => {
    const room = playing();
    const claimed = claimSeat(room, 'p2', NEW_TOKEN, NOW) as Room;
    expect(view(claimed, 'p2', new Set(['p2'])).round?.role).toEqual(view(room, 'p2', new Set(['p2'])).round?.role);
  });

  it('refuses a token that already belongs to someone, or a seat that is gone', () => {
    expect(claimSeat(lobby(), 'p1', token('יוסי'), NOW)).toEqual({ error: 'bad_message' });
    expect(claimSeat(lobby(), 'p9', NEW_TOKEN, NOW)).toEqual({ error: 'bad_token' });
  });

  it('shows open claims to everyone except the player whose seat it is', () => {
    const claims = [{ id: 'c1', playerId: 'p1' }];
    const everyone = new Set(['p1', 'p2', 'p3']);
    expect(view(lobby(), 'p2', everyone, none, claims).claims).toEqual(claims);
    expect(view(lobby(), 'p1', everyone, none, claims).claims).toBeUndefined();
    expect(view(lobby(), 'p2', everyone).claims).toBeUndefined();
    // מקום שכבר לא בחדר
    expect(view(lobby(), 'p2', everyone, none, [{ id: 'c2', playerId: 'p9' }]).claims).toBeUndefined();
  });

  it('parses the new messages and keeps them out of act', () => {
    const claim = { type: 'room:claim', name: 'דנה', token: NEW_TOKEN, version: PROTOCOL_VERSION };
    expect(parseMessage(JSON.stringify(claim))).toEqual(claim);
    expect(parseMessage(JSON.stringify({ ...claim, token: 'short' }))).toBeNull();
    const answer = { type: 'claim:answer', claimId: 'c1', approve: true };
    expect(parseMessage(JSON.stringify(answer))).toEqual(answer);
    expect(parseMessage(JSON.stringify({ ...answer, approve: 'yes' }))).toBeNull();
    expect(act(lobby(), 'p2', { type: 'claim:answer', claimId: 'c1', approve: true }, NOW)).toEqual({ error: 'bad_message' });
  });
});
