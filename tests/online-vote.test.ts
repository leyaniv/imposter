import { describe, expect, it } from 'vitest';
import { CAUGHT_IMPOSTER_POINTS, CREW_POINTS, IMPOSTER_POINTS } from '../src/game/rules';
import { PROTOCOL_VERSION, type ClientMessage, type ErrorCode, type RoomSettings } from '../src/online/protocol';
import { act, createRoom, join, settleVote, view, type Room } from '../worker/logic';
import { seededRng } from './helpers';

const NOW = 1_000_000;
const NAMES = ['דנה', 'יוסי', 'רוני', 'מיכל', 'עומר', 'שירה', 'אבי', 'נועה'];

function ok<T extends object>(result: T): Exclude<T, { error: ErrorCode }> {
  if ('error' in result) throw new Error(`unexpected error: ${String(result.error)}`);
  return result as Exclude<T, { error: ErrorCode }>;
}

function send(room: Room, playerId: string, message: ClientMessage, connected?: ReadonlySet<string>): Room {
  return ok(act(room, playerId, message, NOW, { rng: seededRng(1), connected })).room;
}

function error(room: Room, playerId: string, message: ClientMessage) {
  const result = act(room, playerId, message, NOW, { rng: seededRng(1) });
  return 'error' in result ? result.error : null;
}

/** סבב בשלב הדיבור. p1 הוא המארח */
function playing(count: number, settings: Partial<RoomSettings> = {}, seed = 1): Room {
  let room = createRoom('482731', NOW, {
    categories: [],
    imposterCount: 1,
    imposterNeverStarts: false,
    showCategory: false,
    secretVote: false,
    ...settings,
  });
  for (const name of NAMES.slice(0, count)) {
    room = ok(join(room, name, PROTOCOL_VERSION, `token-${name}`.padEnd(16, '-'), NOW)).room;
  }
  room = ok(act(room, 'p1', { type: 'game:start' }, NOW, { rng: seededRng(seed) })).room;
  return send(room, 'p1', { type: 'reveal:skip' });
}

const imposters = (room: Room) => room.round!.imposterIds;
const crew = (room: Room) => room.round!.players.map((p) => p.id).filter((id) => !imposters(room).includes(id));

/** הצבעה שלמה: starter פותח על target, והשאר מצביעים לפי yesIds (מי שלא שם: נגד) */
function voteOut(room: Room, starter: string, target: string, yesIds: string[] = []): Room {
  let next = send(room, starter, { type: 'vote:start', targetId: target });
  for (const id of room.round!.players.map((p) => p.id)) {
    if (!next.vote || id === starter || id === target || next.round!.eliminatedIds.includes(id)) continue;
    next = send(next, id, { type: 'vote:cast', yes: yesIds.includes(id) });
  }
  return next;
}

/** כולם (חוץ מהנאשם) בעד */
function voteOutByAll(room: Room, target: string): Room {
  const active = room.round!.players.map((p) => p.id).filter((id) => id !== target && !room.round!.eliminatedIds.includes(id));
  return voteOut(room, active[0], target, active);
}

describe('opening a vote', () => {
  it('needs the talking phase', () => {
    const room = playing(4);
    const revealing = { ...room, phase: 'reveal' as const };
    expect(error(revealing, 'p1', { type: 'vote:start', targetId: 'p2' })).toBe('wrong_phase');
  });

  it('does not allow voting on yourself or on someone who is out', () => {
    const room = playing(4);
    expect(error(room, 'p1', { type: 'vote:start', targetId: 'p1' })).toBe('not_allowed');
    expect(error(room, 'p1', { type: 'vote:start', targetId: 'p9' })).toBe('not_allowed');
  });

  it('allows one vote at a time', () => {
    const room = send(playing(4), 'p1', { type: 'vote:start', targetId: 'p2' });
    expect(error(room, 'p3', { type: 'vote:start', targetId: 'p4' })).toBe('busy');
    expect(error(room, 'p3', { type: 'guess:start' })).toBe('busy');
  });

  it('counts the one who opened it as yes', () => {
    const room = send(playing(4), 'p1', { type: 'vote:start', targetId: 'p2' });
    expect(room.vote!.votes).toEqual({ p1: true });
  });
});

describe('casting votes', () => {
  it('does not let the accused vote', () => {
    const room = send(playing(4), 'p1', { type: 'vote:start', targetId: 'p2' });
    expect(error(room, 'p2', { type: 'vote:cast', yes: false })).toBe('not_allowed');
  });

  it('does not let the one who opened it change their vote', () => {
    const room = send(playing(4), 'p1', { type: 'vote:start', targetId: 'p2' });
    expect(error(room, 'p1', { type: 'vote:cast', yes: false })).toBe('not_allowed');
  });

  it('lets a voter change their mind until it closes', () => {
    let room = send(playing(5), 'p1', { type: 'vote:start', targetId: 'p2' });
    room = send(room, 'p3', { type: 'vote:cast', yes: true });
    room = send(room, 'p3', { type: 'vote:cast', yes: false });
    expect(room.vote!.votes.p3).toBe(false);
  });

  it('closes by itself once everyone voted', () => {
    let room = send(playing(4), 'p1', { type: 'vote:start', targetId: 'p2' });
    room = send(room, 'p3', { type: 'vote:cast', yes: false });
    expect(room.vote).toBeDefined();
    room = send(room, 'p4', { type: 'vote:cast', yes: false });
    expect(room.vote).toBeUndefined();
    expect(room.lastVote).toMatchObject({ targetId: 'p2', yes: 1, no: 2, eliminated: false });
  });
});

describe('majority', () => {
  it('needs more than half of the voters (5 players: 4 vote, 3 needed)', () => {
    const target = crew(playing(5)).find((id) => id !== 'p1')!;
    const others = playing(5).round!.players.map((p) => p.id).filter((id) => id !== target && id !== 'p1');

    const three = voteOut(playing(5), 'p1', target, others.slice(0, 2));
    expect(three.lastVote).toMatchObject({ yes: 3, no: 1, eliminated: true });
    expect(three.round!.eliminatedIds).toEqual([target]);

    const tie = voteOut(playing(5), 'p1', target, others.slice(0, 1));
    expect(tie.lastVote).toMatchObject({ yes: 2, no: 2, eliminated: false });
    expect(tie.round!.eliminatedIds).toEqual([]);
  });

  it('counts whoever did not vote as no when closed early', () => {
    let room = send(playing(5), 'p1', { type: 'vote:start', targetId: 'p2' });
    room = send(room, 'p3', { type: 'vote:cast', yes: true });
    expect(error(room, 'p4', { type: 'vote:close' })).toBe('not_allowed');
    room = send(room, 'p1', { type: 'vote:close' });
    expect(room.lastVote).toMatchObject({ yes: 2, no: 2, eliminated: false });
  });

  it('lets the host close a vote someone else opened', () => {
    const room = send(playing(4), 'p2', { type: 'vote:start', targetId: 'p3' });
    expect(send(room, 'p1', { type: 'vote:close' }).vote).toBeUndefined();
  });

  it('does not count disconnected players, and closes when they drop', () => {
    const everyone = new Set(['p1', 'p2', 'p3', 'p4', 'p5']);
    let room = send(playing(5), 'p1', { type: 'vote:start', targetId: 'p2' }, everyone);
    room = send(room, 'p3', { type: 'vote:cast', yes: true }, everyone);
    room = send(room, 'p4', { type: 'vote:cast', yes: true }, everyone);
    expect(room.vote).toBeDefined();

    // p5 התנתק: שלושה מצביעים, שלושה בעד
    const settled = settleVote(room, new Set(['p1', 'p2', 'p3', 'p4']));
    expect(settled.vote).toBeUndefined();
    expect(settled.lastVote).toMatchObject({ yes: 3, no: 0 });
  });

  it('lets only the one who opened it cancel', () => {
    const room = send(playing(4), 'p2', { type: 'vote:start', targetId: 'p3' });
    expect(error(room, 'p1', { type: 'vote:cancel' })).toBe('not_allowed');
    const cancelled = send(room, 'p2', { type: 'vote:cancel' });
    expect(cancelled.vote).toBeUndefined();
    expect(cancelled.lastVote).toBeUndefined();
  });
});

describe('after an elimination', () => {
  it('reveals a regular player, and anyone can continue', () => {
    const room = playing(5);
    const target = crew(room)[0];
    let out = voteOutByAll(room, target);
    expect(out.round!.revealedId).toBe(target);
    expect(error(out, 'p1', { type: 'vote:start', targetId: crew(room)[1] })).toBe('busy');

    out = send(out, crew(room)[1], { type: 'reveal:continue' });
    expect(out.round!.revealedId).toBeUndefined();
    expect(out.phase).toBe('play');
  });

  it('does not let an eliminated player vote or open a vote', () => {
    const room = playing(5);
    const [target, other] = crew(room);
    const out = send(voteOutByAll(room, target), other, { type: 'reveal:continue' });
    expect(error(out, target, { type: 'vote:start', targetId: other })).toBe('not_allowed');
    const voting = send(out, other, { type: 'vote:start', targetId: imposters(room)[0] });
    expect(error(voting, target, { type: 'vote:cast', yes: true })).toBe('not_allowed');
  });

  it('ends the round when the imposters are no longer outnumbered', () => {
    let room = playing(4);
    const [a, b] = crew(room);
    room = send(voteOutByAll(room, a), b, { type: 'reveal:continue' });
    room = voteOutByAll(room, b);
    expect(room.phase).toBe('roundEnd');
    expect(room.round!.winReason).toBe('outnumbered');
    expect(room.scores[imposters(room)[0]]).toBe(IMPOSTER_POINTS);
  });
});

describe('last guess', () => {
  it('lets the crew win when the guess is wrong', () => {
    let room = voteOutByAll(playing(4), imposters(playing(4))[0]);
    const imposter = imposters(room)[0];
    expect(room.round!.guessPending).toBe(true);
    expect(error(room, imposter, { type: 'guess:mark', correct: true })).toBe('not_allowed');

    room = send(room, crew(room)[0], { type: 'guess:mark', correct: false });
    expect(room.phase).toBe('roundEnd');
    expect(room.round!.winReason).toBe('allCaught');
    // כולם הצביעו בעד, ומי שפתח (השחקן הראשון שעדיין במשחק) מקבל 2. למתחזה אין נקודות על ניצחון השחקנים
    const [opener, ...others] = crew(room);
    expect(room.scores).toEqual({ [opener]: 2, ...Object.fromEntries(others.map((id) => [id, 1])) });
  });

  it('lets the imposter win when the guess is right', () => {
    let room = voteOutByAll(playing(4), imposters(playing(4))[0]);
    room = send(room, crew(room)[1], { type: 'guess:mark', correct: true });
    expect(room.round!.winReason).toBe('lastGuess');
    expect(room.scores[imposters(room)[0]]).toBe(CAUGHT_IMPOSTER_POINTS);
  });

  it('🔒 ignores marks from the other imposter, without telling them', () => {
    let room = playing(8, { imposterCount: 2 });
    const [first, second] = imposters(room);
    room = voteOutByAll(room, first);

    const result = act(room, second, { type: 'guess:mark', correct: true }, NOW);
    expect(result).toEqual({ room });

    // ניחוש שגוי, ונשאר עוד מתחזה: ממשיכים
    room = send(room, crew(room)[0], { type: 'guess:mark', correct: false });
    expect(room.phase).toBe('play');
    expect(room.round!.guessPending).toBeUndefined();
    expect(room.round!.revealedId).toBe(first);
    room = send(room, crew(room)[0], { type: 'reveal:continue' });
    expect(room.round!.revealedId).toBeUndefined();
  });
});

describe('free guess', () => {
  it('opens for everyone, and only the one who opened it can cancel', () => {
    const room = send(playing(4), 'p2', { type: 'guess:start' });
    expect(room.freeGuess).toEqual({ startedBy: 'p2' });
    expect(error(room, 'p1', { type: 'guess:cancel' })).toBe('not_allowed');
    expect(send(room, 'p2', { type: 'guess:cancel' }).freeGuess).toBeUndefined();
  });

  it('ends the round either way', () => {
    const base = send(playing(4), 'p2', { type: 'guess:start' });
    const marker = crew(base)[0];
    const right = send(base, marker, { type: 'guess:mark', correct: true });
    expect(right.round!.winReason).toBe('freeGuessRight');
    expect(right.scores).toEqual({ [imposters(base)[0]]: IMPOSTER_POINTS });

    const wrong = send(base, marker, { type: 'guess:mark', correct: false });
    expect(wrong.round!.winReason).toBe('freeGuessWrong');
    expect(wrong.freeGuess).toBeUndefined();
  });

  it('🔒 ignores the imposter marking their own guess', () => {
    const room = send(playing(4), 'p2', { type: 'guess:start' });
    const imposter = imposters(room)[0];
    expect(act(room, imposter, { type: 'guess:mark', correct: true }, NOW)).toEqual({ room });
  });
});

describe('scores', () => {
  it('gives no points when the host ends the round', () => {
    const room = send(playing(4), 'p1', { type: 'round:end' });
    expect(room.scores).toEqual({});
  });

  it('adds up across rounds, and only the host can reset', () => {
    let room = voteOutByAll(playing(4), imposters(playing(4))[0]);
    room = send(room, crew(room)[0], { type: 'guess:mark', correct: false });
    room = send(room, 'p1', { type: 'round:next' });
    room = send(room, 'p1', { type: 'reveal:skip' });
    room = send(room, 'p2', { type: 'guess:start' });
    room = send(room, crew(room)[0], { type: 'guess:mark', correct: false });
    const total = Object.values(room.scores).reduce((a, b) => a + b, 0);
    // סבב 1: שלושה שחקנים הצביעו נכון, ואחד מהם פתח (2+1+1). סבב 2: ניחוש חופשי שגוי, נקודה לכל אחד מהשלושה
    expect(total).toBe(4 + 3 * CREW_POINTS);

    expect(error(room, 'p2', { type: 'scores:reset' })).toBe('not_host');
    expect(send(room, 'p1', { type: 'scores:reset' }).scores).toEqual({});
  });
});

describe('leaving mid-round', () => {
  it('cancels the vote when the accused leaves', () => {
    const room = playing(5);
    const target = crew(room).find((id) => id !== 'p1')!;
    const voting = send(room, 'p1', { type: 'vote:start', targetId: target });
    const after = send(voting, target, { type: 'room:leave' });
    expect(after.vote).toBeUndefined();
    expect(after.round!.eliminatedIds).toContain(target);
  });

  it('counts a regular player who left as out, and checks for a winner', () => {
    const room = playing(3);
    const leaver = crew(room).find((id) => id !== 'p1') ?? crew(room)[0];
    const after = leaver === 'p1' ? send(room, 'p1', { type: 'room:leave' }) : send(room, 'p1', { type: 'lobby:kick', playerId: leaver });
    expect(after.phase).toBe('roundEnd');
    expect(after.round!.winReason).toBe('outnumbered');
  });

  it('waits for the last guess before checking for a winner', () => {
    let room = voteOutByAll(playing(4), imposters(playing(4))[0]);
    const leaver = crew(room).find((id) => id !== 'p1')!;
    room = send(room, 'p1', { type: 'lobby:kick', playerId: leaver });
    expect(room.phase).toBe('play');
    expect(room.round!.guessPending).toBe(true);
  });
});

describe('🔒 what each phone sees during votes and guesses', () => {
  it('hides votes in a secret vote until it closes', () => {
    let room = send(playing(5, { secretVote: true }), 'p1', { type: 'vote:start', targetId: 'p2' });
    room = send(room, 'p3', { type: 'vote:cast', yes: false });
    for (const id of ['p1', 'p2', 'p3', 'p4', 'p5']) {
      const vote = view(room, id, new Set())!.round!.vote!;
      expect(vote.votes).toBeUndefined();
      expect(vote.votedCount).toBe(2);
      expect(vote.myVote).toBe(id === 'p1' ? true : id === 'p3' ? false : undefined);
    }
    room = send(room, 'p1', { type: 'vote:close' });
    expect(view(room, 'p5', new Set()).round!.lastVote!.votes).toEqual({ p1: true, p3: false });
  });

  it('shows every vote right away in an open vote', () => {
    let room = send(playing(5), 'p1', { type: 'vote:start', targetId: 'p2' });
    room = send(room, 'p3', { type: 'vote:cast', yes: false });
    expect(view(room, 'p4', new Set()).round!.vote!.votes).toEqual({ p1: true, p3: false });
  });

  it('never exposes an imposter who was not caught', () => {
    for (let seed = 1; seed <= 20; seed++) {
      let room = playing(8, { imposterCount: 2 }, seed);
      const [first, second] = imposters(room);
      const states: Room[] = [room];
      room = voteOutByAll(room, crew(room)[0]);
      states.push(room);
      room = send(room, crew(room)[1], { type: 'reveal:continue' });
      room = voteOutByAll(room, first);
      states.push(room);
      room = send(room, crew(room)[1], { type: 'guess:mark', correct: false });
      states.push(room);

      for (const state of states) {
        for (const id of state.players.map((p) => p.id)) {
          const seen = view(state, id, new Set());
          const json = JSON.stringify(seen);
          expect(seen.round!.reveal).toBeUndefined();
          expect(seen.round!.caughtIds).not.toContain(second);
          expect(seen.round!.revealed?.playerId === second).toBe(false);
          expect(json).not.toContain('imposterIds');
          if (id !== second) expect(json).not.toContain(state.round!.hints[second]);
        }
      }
    }
  });
});

describe('scoring by votes', () => {
  /** 5 שחקנים: המתחזה, ו-a עד d שחקנים רגילים לפי סדר הישיבה */
  function cast() {
    const room = playing(5);
    const [a, b, c, d] = crew(room);
    return { room, imp: imposters(room)[0], a, b, c, d };
  }

  it('scores the example from the plan: +1 / -1 per vote, +2 / -1 for the one who opened it', () => {
    const { room: start, imp, a, b, c, d } = cast();
    // a פותח על b (שחקן רגיל). c והמתחזה בעד, d נגד: 3 מתוך 4, b מודח
    let room = voteOut(start, a, b, [c, imp]);
    expect(room.round!.eliminatedIds).toEqual([b]);
    // עוד אין מנצח: הנקודות לא נוספו
    expect(room.scores).toEqual({});
    expect(room.scoredVotes[0].ballots).toEqual(
      expect.arrayContaining([
        { playerId: a, yes: true, points: -1 },
        { playerId: c, yes: true, points: -1 },
        { playerId: d, yes: false, points: 1 },
        { playerId: imp, yes: true, points: 0 },
      ]),
    );

    room = send(room, d, { type: 'reveal:continue' });
    // d פותח על המתחזה, c בעד, a נגד: 2 מתוך 3
    room = voteOut(room, d, imp, [c]);
    room = send(room, c, { type: 'guess:mark', correct: false });
    expect(room.round!.winReason).toBe('allCaught');
    expect(room.scores).toEqual({ [a]: -2, [c]: 0, [d]: 3 });
  });

  it('gives a caught imposter who guessed right 2, on top of the vote points', () => {
    const { room: start, imp, a, b, c, d } = cast();
    let room = voteOut(start, a, imp, [b, c]);
    room = send(room, b, { type: 'guess:mark', correct: true });
    expect(room.round!.winReason).toBe('lastGuess');
    expect(room.scores).toEqual({ [imp]: CAUGHT_IMPOSTER_POINTS, [a]: 2, [b]: 1, [c]: 1, [d]: -1 });
  });

  it('gives no vote points to the imposter, even when they opened the vote', () => {
    const { room: start, imp, a, b, c, d } = cast();
    const room = voteOut(start, imp, a, [b, c]);
    expect(room.scoredVotes[0]).toMatchObject({ targetId: a, imposter: false, startedBy: imp });
    expect(room.scoredVotes[0].ballots).toEqual(
      expect.arrayContaining([
        { playerId: imp, yes: true, points: 0 },
        { playerId: b, yes: true, points: -1 },
        { playerId: d, yes: false, points: 1 },
      ]),
    );
  });

  it('counts whoever did not vote as no when the vote is closed by hand', () => {
    const { room: start, imp, a, b, c, d } = cast();
    let room = send(start, a, { type: 'vote:start', targetId: imp });
    room = send(room, b, { type: 'vote:cast', yes: true });
    room = send(room, c, { type: 'vote:cast', yes: true });
    room = send(room, a, { type: 'vote:close' });
    expect(room.round!.eliminatedIds).toEqual([imp]);
    expect(room.scoredVotes[0].ballots).toContainEqual({ playerId: d, yes: false, points: -1 });
  });

  it('gives nothing to a disconnected player who did not vote', () => {
    const { room: start, imp, a, b, c, d } = cast();
    const online = new Set([a, b, c, imp]);
    let room = send(start, a, { type: 'vote:start', targetId: imp }, online);
    room = send(room, b, { type: 'vote:cast', yes: true }, online);
    room = send(room, c, { type: 'vote:cast', yes: true }, online);
    expect(room.round!.eliminatedIds).toEqual([imp]);
    expect(room.scoredVotes[0].ballots.map((ballot) => ballot.playerId)).not.toContain(d);
  });

  it('scores nothing for a vote with no majority, or one that was cancelled', () => {
    const { room: start, imp, a, b } = cast();
    const failed = voteOut(start, a, imp, [b]);
    expect(failed.lastVote!.eliminated).toBe(false);
    expect(failed.scoredVotes).toEqual([]);

    const cancelled = send(send(start, a, { type: 'vote:start', targetId: imp }), a, { type: 'vote:cancel' });
    expect(cancelled.scoredVotes).toEqual([]);
  });

  it('gives every regular player 1 when the imposter guesses wrong without being caught, even who is out', () => {
    const { room: start, imp, a, b, c, d } = cast();
    let room = voteOut(start, a, b, [c, d]);
    room = send(room, a, { type: 'reveal:continue' });
    room = send(room, imp, { type: 'guess:start' });
    room = send(room, c, { type: 'guess:mark', correct: false });
    expect(room.round!.winReason).toBe('freeGuessWrong');
    // a פתח ו-c, d הצביעו בעד הדחה של b, שלא היה המתחזה
    expect(room.scores).toEqual({ [a]: 0, [b]: 1, [c]: 0, [d]: 0 });
  });

  it('gives 3 to the imposter who was not caught, and 2 to the one who was', () => {
    let room = playing(8, { imposterCount: 2 });
    const [first, second] = imposters(room);
    room = voteOutByAll(room, first);
    room = send(room, crew(room)[0], { type: 'guess:mark', correct: false });
    room = send(room, crew(room)[0], { type: 'reveal:continue' });
    room = send(room, second, { type: 'guess:start' });
    room = send(room, crew(room)[0], { type: 'guess:mark', correct: true });
    expect(room.round!.winReason).toBe('freeGuessRight');
    expect(room.scores[first]).toBe(CAUGHT_IMPOSTER_POINTS);
    expect(room.scores[second]).toBe(IMPOSTER_POINTS);
  });

  it('drops the vote points when the round is cancelled', () => {
    const { room: start, a, b, c, d } = cast();
    const voted = voteOut(start, a, b, [c, d]);
    const ended = send(voted, 'p1', { type: 'round:end' });
    expect(ended.scores).toEqual({});
    const reveal = view(ended, a, new Set()).round!.reveal!;
    expect(reveal.points).toEqual({});
    expect(reveal.scoring).toBeUndefined();

    const next = send(ended, 'p1', { type: 'round:next' });
    expect(next.scoredVotes).toEqual([]);
  });

  it('🔒 sends the vote points to no phone before the round ends, and to everyone after', () => {
    const { room: start, imp, a, b, c, d } = cast();
    let room = voteOut(start, a, b, [c, imp]);
    room = send(room, d, { type: 'reveal:continue' });
    for (const id of [imp, a, b, c, d]) {
      const json = JSON.stringify(view(room, id, new Set()));
      expect(json).not.toContain('ballots');
      expect(json).not.toContain('points');
    }

    room = voteOut(room, d, imp, [c]);
    room = send(room, c, { type: 'guess:mark', correct: false });
    const reveal = view(room, b, new Set()).round!.reveal!;
    expect(reveal.points).toEqual({ [a]: -2, [c]: 0, [d]: 3 });
    expect(reveal.scoring!.votes.map((vote) => vote.targetId)).toEqual([b, imp]);
    expect(reveal.scoring!.win).toEqual({});
  });
});
