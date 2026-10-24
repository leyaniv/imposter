/**
 * החוקים של חדר במצב "כל אחד בטלפון שלו": פונקציות טהורות, בלי Cloudflare ובלי דפדפן.
 * ה-Durable Object (room.ts) רק מחבר אותן ל-WebSocket ולאחסון, ולכן אפשר לבדוק את הכול עם vitest רגיל.
 * חוקי ההדחה, הניחוש, הניצחון והניקוד הם אותם חוקים של הטלפון האחד (src/game/rules.ts).
 */
import words from '../src/data/words.he.json';
import { cryptoRng, type Rng } from '../src/game/random';
import {
  addPoints,
  checkWinner,
  dismissReveal,
  eliminate,
  freeGuess,
  isImposter,
  resolveLastGuess,
  roundPoints,
} from '../src/game/rules';
import { MAX_PLAYERS, MIN_PLAYERS, createRound } from '../src/game/setup';
import type { Round, WordEntry } from '../src/game/types';
import { listCategories } from '../src/game/words';
import {
  MAX_NAME_LENGTH,
  MAX_TOKEN_LENGTH,
  MIN_TOKEN_LENGTH,
  PROTOCOL_VERSION,
  type ClientMessage,
  type ErrorCode,
  type RoomPhase,
  type RoomSettings,
  type RoomState,
  type RoundState,
  type VoteResult,
  type WinReason,
} from '../src/online/protocol';

const bank: WordEntry[] = words;
const allCategories = listCategories(bank);

export interface StoredPlayer {
  id: string;
  name: string;
  /** סוד: רק הטלפון של השחקן מכיר אותו. לא נשלח לאף אחד אחר */
  token: string;
}

/** הצבעה פתוחה, כפי שהיא נשמרת. view מחליט מי רואה מה */
export interface StoredVote {
  id: number;
  targetId: string;
  startedBy: string;
  /** 🔒 בהצבעה חשאית לא נשלח לאף אחד עד שההצבעה נסגרת */
  votes: Record<string, boolean>;
}

/** כל מצב החדר. נשמר כמפתח אחד אחרי כל שינוי */
export interface Room {
  code: string;
  /** null כשהחדר ריק: מי שמצטרף ראשון הוא המארח */
  hostId: string | null;
  /** לפי סדר הישיבה, עם כיוון השעון */
  players: StoredPlayer[];
  /** מזהה השחקן הבא (p1, p2...). לא חוזר על עצמו גם אחרי שמישהו יצא */
  nextId: number;
  /** השינוי האחרון. חדר בלי שינוי שעתיים נמחק */
  lastActivity: number;
  settings: RoomSettings;
  /** מילים שכבר יצאו בחדר הזה */
  usedWords: string[];
  phase: RoomPhase;
  /** 🔒 הסבב, כולל המילה, המתחזים והרמזים. view מחליט מי רואה מה */
  round?: Round;
  /** כמה סבבים התחילו בחדר */
  roundNumber: number;
  /** מי בסבב כבר ראה את התפקיד שלו */
  seenIds: string[];
  /** מי מהסבב יצא מהחדר באמצע (הם גם ב-round.eliminatedIds) */
  leftIds: string[];
  /** הסבב נגמר כי מתחזה יצא מהחדר */
  imposterLeft: boolean;
  vote?: StoredVote;
  /** כמה הצבעות נפתחו בחדר */
  voteNumber: number;
  lastVote?: VoteResult;
  freeGuess?: { startedBy: string };
  /** ניקוד מצטבר: playerId -> נקודות */
  scores: Record<string, number>;
}

/** כמה זמן חדר שאף אחד לא הצטרף אליו מחכה לראשון */
export const RESERVE_TTL_MS = 10 * 60 * 1000;
/** אחרי כמה זמן בלי שינוי חדר נמחק */
export const IDLE_TTL_MS = 2 * 60 * 60 * 1000;

/** כמו ברירת המחדל של הטלפון האחד, והצבעה גלויה */
export const DEFAULT_SETTINGS: RoomSettings = {
  categories: [],
  imposterCount: 1,
  imposterNeverStarts: true,
  showCategory: false,
  secretVote: false,
};

export function createRoom(code: string, now: number, settings: RoomSettings = DEFAULT_SETTINGS): Room {
  return {
    code,
    hostId: null,
    players: [],
    nextId: 1,
    lastActivity: now,
    settings: cleanSettings(settings),
    usedWords: [],
    phase: 'lobby',
    roundNumber: 0,
    seenIds: [],
    leftIds: [],
    imposterLeft: false,
    voteNumber: 0,
    scores: {},
  };
}

/** חדר שנשמר בגרסה קודמת מקבל ערכי ברירת מחדל לשדות החדשים */
export function upgradeRoom(saved: Room): Room {
  const fresh = createRoom(saved.code, saved.lastActivity);
  return { ...fresh, ...saved, settings: { ...fresh.settings, ...saved.settings } };
}

/** מה קרה בעקבות הודעה של שחקן שכבר בחדר */
export type ActionResult =
  | { room: Room; left?: { playerId: string; reason: 'left' | 'kicked' } }
  | { error: ErrorCode };

export interface ActOptions {
  rng?: Rng;
  /** מי מחובר עכשיו. מי שמנותק לא נספר בהצבעה. ברירת מחדל: כולם */
  connected?: ReadonlySet<string>;
}

function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function cleanName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

/** רק קטגוריות שקיימות במאגר. אם לא נשארה אף אחת, כל הקטגוריות */
function cleanSettings(settings: RoomSettings): RoomSettings {
  const categories = [...new Set(settings.categories.filter((category) => allCategories.includes(category)))];
  return {
    categories: categories.length === allCategories.length ? [] : categories,
    imposterCount: settings.imposterCount === 2 ? 2 : 1,
    imposterNeverStarts: settings.imposterNeverStarts,
    showCategory: settings.showCategory,
    secretVote: settings.secretVote,
  };
}

/**
 * שחקן חדש. הטוקן נוצר בטלפון.
 * אם כבר יש שחקן עם הטוקן הזה, ההצטרפות הקודמת הצליחה והתשובה פשוט לא הגיעה: מחזירים אותו בלי לשנות כלום.
 * מי שמצטרף באמצע סבב משתתף מהסבב הבא.
 */
export function join(
  room: Room,
  name: string,
  version: number,
  token: string,
  now: number,
): { room: Room; playerId: string } | { error: ErrorCode } {
  if (version !== PROTOCOL_VERSION) return { error: 'outdated' };
  const existing = room.players.find((player) => player.token === token);
  if (existing) return { room, playerId: existing.id };

  const clean = cleanName(name);
  if (!clean || clean.length > MAX_NAME_LENGTH) return { error: 'name_required' };
  if (room.players.length >= MAX_PLAYERS) return { error: 'room_full' };
  if (room.players.some((player) => sameName(player.name, clean))) return { error: 'name_taken' };

  const playerId = `p${room.nextId}`;
  return {
    playerId,
    room: {
      ...room,
      hostId: room.hostId ?? playerId,
      players: [...room.players, { id: playerId, name: clean, token }],
      nextId: room.nextId + 1,
      lastActivity: now,
    },
  };
}

/** חזרה אחרי ריענון או ניתוק. לא משנה את החדר */
export function rejoin(room: Room, token: string, version: number): { playerId: string } | { error: ErrorCode } {
  if (version !== PROTOCOL_VERSION) return { error: 'outdated' };
  const player = room.players.find((p) => p.token === token);
  return player ? { playerId: player.id } : { error: 'bad_token' };
}

/** שחקן שהתחיל את הסבב ולא יצא מהחדר (גם אם הודח, הוא עדיין יודע את המילה) */
function inRound(room: Room, playerId: string): boolean {
  return !!room.round?.players.some((player) => player.id === playerId) && !room.leftIds.includes(playerId);
}

/** שחקן שעדיין במשחק: לא הודח ולא יצא */
function active(room: Room, playerId: string): boolean {
  return inRound(room, playerId) && !room.round!.eliminatedIds.includes(playerId);
}

/** כולם (מי שעוד בסבב) ראו את התפקיד: עוברים למשחק */
function afterSeen(room: Room): Room {
  if (room.phase !== 'reveal' || !room.round) return room;
  const waiting = room.round.players.some((player) => inRound(room, player.id) && !room.seenIds.includes(player.id));
  return waiting ? room : { ...room, phase: 'play' };
}

/** הסבב השתנה. אם נקבע מנצח: סוף הסבב, וניקוד לכל מי שניצח (כמו updateRound בטלפון האחד) */
function withRound(room: Room, round: Round): Room {
  if (round === room.round) return room;
  if (!round.winner || room.round?.winner) return { ...room, round };
  return {
    ...room,
    round,
    phase: 'roundEnd',
    vote: undefined,
    freeGuess: undefined,
    scores: addPoints(room.scores, roundPoints(round)),
  };
}

/**
 * מישהו יצא מהחדר באמצע סבב.
 * מתחזה: אי אפשר להמשיך בלעדיו, אז הסבב נגמר בלי ניקוד וכולם רואים את המילה.
 * שחקן רגיל: נחשב כמודח בלי חשיפה, ובודקים אם המשחק נגמר.
 */
function leaveRound(room: Room, playerId: string): Room {
  if ((room.phase !== 'reveal' && room.phase !== 'play') || !inRound(room, playerId)) return room;
  const round = room.round!;
  const leftIds = [...room.leftIds, playerId];
  if (isImposter(round, playerId)) {
    return { ...room, leftIds, phase: 'roundEnd', imposterLeft: true, vote: undefined, freeGuess: undefined };
  }

  const vote = room.vote && room.vote.targetId !== playerId ? room.vote : undefined;
  const eliminatedIds = round.eliminatedIds.includes(playerId) ? round.eliminatedIds : [...round.eliminatedIds, playerId];
  const without: Round = { ...round, eliminatedIds };
  const next = afterSeen({ ...room, leftIds, vote });
  // באמצע ניחוש אחרון לא בודקים ניצחון: הוא ייבדק אחרי הניחוש, כמו בטלפון האחד
  return withRound(next, round.guessPending ? without : checkWinner(without));
}

function remove(room: Room, playerId: string, now: number): Room {
  const index = room.players.findIndex((player) => player.id === playerId);
  const players = room.players.filter((player) => player.id !== playerId);
  let hostId = room.hostId;
  // המארח יצא: האירוח עובר לשחקן הבא בסדר הישיבה
  if (hostId === playerId) hostId = players.length > 0 ? players[index % players.length].id : null;
  return leaveRound({ ...room, players, hostId, lastActivity: now }, playerId);
}

/** סבב חדש עם כל השחקנים בחדר, לפי סדר הישיבה וההגדרות */
function startRound(room: Room, now: number, rng: Rng): ActionResult {
  if (room.players.length < MIN_PLAYERS) return { error: 'not_enough_players' };
  const { round, usedWords } = createRound(
    { ...room.settings, players: room.players.map(({ id, name }) => ({ id, name })) },
    bank,
    room.usedWords,
    rng,
  );
  return {
    room: {
      ...room,
      phase: 'reveal',
      round,
      usedWords,
      roundNumber: room.roundNumber + 1,
      seenIds: [],
      leftIds: [],
      imposterLeft: false,
      vote: undefined,
      lastVote: undefined,
      freeGuess: undefined,
      lastActivity: now,
    },
  };
}

/** מי רשאי להצביע עכשיו: כל מי שבמשחק חוץ מהנאשם. מי שמנותק לא נספר, אלא אם כבר הצביע */
export function voterIds(room: Room, connected: ReadonlySet<string>): string[] {
  const vote = room.vote;
  if (!vote || !room.round) return [];
  return room.round.players
    .map((player) => player.id)
    .filter((id) => id !== vote.targetId && active(room, id) && (connected.has(id) || id in vote.votes));
}

/**
 * סוגר את ההצבעה כשכל המצביעים הצביעו, או מיד אם force (סגירה ידנית: מי שלא הצביע נספר נגד).
 * רוב = יותר ממחצית המצביעים. בתיקו הנאשם נשאר.
 * נקרא אחרי כל קול, וגם כשמישהו מתנתק (אולי עכשיו כל המחוברים כבר הצביעו).
 */
export function settleVote(room: Room, connected: ReadonlySet<string>, force = false): Room {
  const vote = room.vote;
  if (!vote || !room.round) return room;
  const voters = voterIds(room, connected);
  if (!force && !voters.every((id) => id in vote.votes)) return room;

  const votes = Object.fromEntries(voters.filter((id) => id in vote.votes).map((id) => [id, vote.votes[id]]));
  const yes = voters.filter((id) => vote.votes[id] === true).length;
  const eliminated = voters.length > 0 && yes > voters.length / 2;
  const lastVote: VoteResult = { id: vote.id, targetId: vote.targetId, yes, no: voters.length - yes, votes, eliminated };
  const closed: Room = { ...room, vote: undefined, lastVote };
  return eliminated ? withRound(closed, eliminate(room.round, vote.targetId)) : closed;
}

/** אפשר לפתוח הצבעה או ניחוש: שלב הדיבור, בלי הצבעה, ניחוש או חשיפה פתוחים */
function idle(room: Room): boolean {
  return room.phase === 'play' && !room.vote && !room.freeGuess && !room.round?.revealedId && !room.round?.winner;
}

/** הודעה משחקן שכבר בחדר (לא join ולא rejoin) */
export function act(room: Room, playerId: string, message: ClientMessage, now: number, options: ActOptions = {}): ActionResult {
  if (!room.players.some((player) => player.id === playerId)) return { error: 'not_joined' };
  const rng = options.rng ?? cryptoRng;
  const connected = options.connected ?? new Set(room.players.map((player) => player.id));
  const isHost = room.hostId === playerId;
  const hostOnly =
    message.type.startsWith('lobby:') ||
    message.type.startsWith('round:') ||
    message.type === 'game:start' ||
    message.type === 'reveal:skip' ||
    message.type === 'scores:reset';
  if (hostOnly && !isHost) return { error: 'not_host' };
  const touch = (next: Room): ActionResult => ({ room: next === room ? room : { ...next, lastActivity: now } });

  switch (message.type) {
    case 'room:leave':
      return { room: remove(room, playerId, now), left: { playerId, reason: 'left' } };

    case 'lobby:kick': {
      if (message.playerId === playerId || !room.players.some((p) => p.id === message.playerId)) {
        return { error: 'bad_message' };
      }
      return { room: remove(room, message.playerId, now), left: { playerId: message.playerId, reason: 'kicked' } };
    }

    case 'lobby:reorder': {
      const ids = message.playerIds;
      const sameSet =
        ids.length === room.players.length &&
        new Set(ids).size === ids.length &&
        room.players.every((player) => ids.includes(player.id));
      if (!sameSet) return { error: 'bad_order' };
      const byId = new Map(room.players.map((player) => [player.id, player]));
      return touch({ ...room, players: ids.map((id) => byId.get(id)!) });
    }

    case 'lobby:settings':
      if (room.phase !== 'lobby') return { error: 'wrong_phase' };
      return touch({ ...room, settings: cleanSettings(message.settings) });

    case 'scores:reset':
      return touch({ ...room, scores: {} });

    case 'game:start':
      if (room.phase !== 'lobby') return { error: 'wrong_phase' };
      return startRound(room, now, rng);

    case 'role:seen':
      if (room.phase !== 'reveal' || !inRound(room, playerId)) return { error: 'wrong_phase' };
      if (room.seenIds.includes(playerId)) return { room };
      return touch(afterSeen({ ...room, seenIds: [...room.seenIds, playerId] }));

    case 'reveal:skip':
      if (room.phase !== 'reveal') return { error: 'wrong_phase' };
      return touch({ ...room, phase: 'play' });

    case 'vote:start': {
      if (!idle(room)) return { error: room.phase === 'play' ? 'busy' : 'wrong_phase' };
      const { targetId } = message;
      if (!active(room, playerId) || !active(room, targetId) || targetId === playerId) return { error: 'not_allowed' };
      const vote: StoredVote = { id: room.voteNumber + 1, targetId, startedBy: playerId, votes: { [playerId]: true } };
      return touch(settleVote({ ...room, vote, voteNumber: vote.id, lastVote: undefined }, connected));
    }

    case 'vote:cast': {
      const vote = room.vote;
      if (!vote) return { error: 'wrong_phase' };
      if (!active(room, playerId) || playerId === vote.targetId) return { error: 'not_allowed' };
      const next = { ...room, vote: { ...vote, votes: { ...vote.votes, [playerId]: message.yes } } };
      return touch(settleVote(next, connected));
    }

    case 'vote:cancel':
      if (!room.vote) return { error: 'wrong_phase' };
      if (room.vote.startedBy !== playerId) return { error: 'not_allowed' };
      return touch({ ...room, vote: undefined });

    case 'vote:close':
      if (!room.vote) return { error: 'wrong_phase' };
      if (room.vote.startedBy !== playerId && !isHost) return { error: 'not_allowed' };
      return touch(settleVote(room, connected, true));

    case 'reveal:continue':
      if (room.phase !== 'play' || !room.round) return { error: 'wrong_phase' };
      return touch(withRound(room, dismissReveal(room.round)));

    case 'guess:start':
      if (!idle(room)) return { error: room.phase === 'play' ? 'busy' : 'wrong_phase' };
      if (!active(room, playerId)) return { error: 'not_allowed' };
      return touch({ ...room, freeGuess: { startedBy: playerId }, lastVote: undefined });

    case 'guess:cancel':
      if (!room.freeGuess) return { error: 'wrong_phase' };
      if (room.freeGuess.startedBy !== playerId) return { error: 'not_allowed' };
      return touch({ ...room, freeGuess: undefined });

    case 'guess:mark': {
      const round = room.round;
      if (room.phase !== 'play' || !round || (!round.guessPending && !room.freeGuess)) return { error: 'wrong_phase' };
      if (!inRound(room, playerId) || (round.guessPending && playerId === round.revealedId)) return { error: 'not_allowed' };
      // 🔒 מתחזה לא יודע את המילה, אז הסימון שלו לא נספר. בלי שגיאה, כדי שהמסך שלו יתנהג כמו אצל כולם
      if (isImposter(round, playerId)) return { room };
      const next = round.guessPending ? resolveLastGuess(round, message.correct) : freeGuess(round, message.correct);
      return touch(withRound({ ...room, freeGuess: undefined }, next));
    }

    case 'round:end':
      if (room.phase !== 'reveal' && room.phase !== 'play') return { error: 'wrong_phase' };
      return touch({ ...room, phase: 'roundEnd', vote: undefined, freeGuess: undefined });

    case 'round:next':
      if (room.phase !== 'roundEnd') return { error: 'wrong_phase' };
      return startRound(room, now, rng);

    case 'round:lobby':
      if (room.phase !== 'roundEnd') return { error: 'wrong_phase' };
      return touch({
        ...room,
        phase: 'lobby',
        round: undefined,
        seenIds: [],
        leftIds: [],
        imposterLeft: false,
        lastVote: undefined,
      });

    case 'room:join':
    case 'room:rejoin':
      return { error: 'bad_message' };
  }
}

/** 🔒 מה שהטלפון של playerId יודע על הסבב: רק התפקיד שלו, הצבעות לפי ההגדרה, ואת השאר רק בסוף */
function roundView(room: Room, playerId: string, connected: ReadonlySet<string>): RoundState | undefined {
  const round = room.round;
  if (!round || room.phase === 'lobby') return undefined;
  const playing = inRound(room, playerId);
  const role: RoundState['role'] = !playing
    ? null
    : isImposter(round, playerId)
      ? { kind: 'imposter', hint: round.hints[playerId] }
      : { kind: 'crew', word: round.word };

  const state: RoundState = {
    number: room.roundNumber,
    players: round.players.map(({ id, name }) => ({ id, name })),
    starterId: round.players[round.startIndex].id,
    seenIds: room.seenIds,
    leftIds: room.leftIds,
    eliminatedIds: round.eliminatedIds,
    // מתחזה שהודח נחשף לכולם בהדחה. מתחזה שיצא מבטל את הסבב, ולכן אף פעם לא כאן לפני הסוף
    caughtIds: round.eliminatedIds.filter((id) => isImposter(round, id) && !room.leftIds.includes(id)),
    guessPending: !!round.guessPending,
    imposterCount: round.imposterIds.length,
    role,
  };
  if (round.revealedId) state.revealed = { playerId: round.revealedId, imposter: isImposter(round, round.revealedId) };
  if (room.vote) {
    const { id, targetId, startedBy, votes } = room.vote;
    const voters = voterIds(room, connected);
    state.vote = { id, targetId, startedBy, voterIds: voters, votedCount: voters.filter((v) => v in votes).length };
    if (!room.settings.secretVote) state.vote.votes = votes;
    if (playerId in votes) state.vote.myVote = votes[playerId];
  }
  if (room.lastVote) state.lastVote = room.lastVote;
  if (room.freeGuess) state.freeGuess = room.freeGuess;
  if (playing && round.showCategory) state.category = round.category;
  if (room.phase === 'roundEnd') {
    state.reveal = {
      word: round.word,
      category: round.category,
      imposters: round.imposterIds.map((id) => ({ id, hint: round.hints[id] })),
      imposterLeft: room.imposterLeft,
      points: roundPoints(round),
    };
    if (round.winner) {
      state.reveal.winner = round.winner;
      state.reveal.winReason = round.winReason as WinReason;
    }
  }
  return state;
}

/** מה שהטלפון של playerId רואה. בלי טוקנים, ובלי סודות של הסבב לפני הסוף */
export function view(room: Room, playerId: string, connectedIds: ReadonlySet<string>): RoomState {
  const state: RoomState = {
    code: room.code,
    hostId: room.hostId,
    players: room.players.map(({ id, name }) => ({ id, name, connected: connectedIds.has(id) })),
    you: playerId,
    phase: room.phase,
    settings: room.settings,
    scores: room.scores,
  };
  const round = roundView(room, playerId, connectedIds);
  if (round) state.round = round;
  return state;
}

type Fields = Record<string, unknown>;

/** הגדרות מהטלפון. null אם משהו לא בנוי נכון */
export function parseSettings(value: unknown): RoomSettings | null {
  if (typeof value !== 'object' || value === null) return null;
  const { categories, imposterCount, imposterNeverStarts, showCategory, secretVote } = value as Fields;
  const validCategories =
    Array.isArray(categories) &&
    categories.length <= 100 &&
    categories.every((category) => typeof category === 'string' && category.length <= 100);
  if (!validCategories || (imposterCount !== 1 && imposterCount !== 2)) return null;
  if (typeof imposterNeverStarts !== 'boolean' || typeof showCategory !== 'boolean') return null;
  return {
    categories: categories as string[],
    imposterCount,
    imposterNeverStarts,
    showCategory,
    secretVote: secretVote === true,
  };
}

/** הודעות בלי שדות: הסוג מספיק */
const BARE: readonly ClientMessage['type'][] = [
  'room:leave',
  'game:start',
  'role:seen',
  'reveal:skip',
  'round:end',
  'round:next',
  'round:lobby',
  'vote:cancel',
  'vote:close',
  'reveal:continue',
  'guess:start',
  'guess:cancel',
  'scores:reset',
];

/** בודק שהודעה מהטלפון בנויה נכון. כל דבר אחר נדחה */
export function parseMessage(raw: string): ClientMessage | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null) return null;
  const msg = data as Fields;
  const isString = (value: unknown, max = 200): value is string => typeof value === 'string' && value.length <= max;
  const isToken = (value: unknown): value is string =>
    isString(value, MAX_TOKEN_LENGTH) && value.length >= MIN_TOKEN_LENGTH;

  if (BARE.includes(msg.type as ClientMessage['type'])) return { type: msg.type } as ClientMessage;

  switch (msg.type) {
    case 'room:join':
      return isString(msg.name) && isToken(msg.token) && typeof msg.version === 'number'
        ? { type: 'room:join', name: msg.name, token: msg.token, version: msg.version }
        : null;
    case 'room:rejoin':
      return isToken(msg.token) && typeof msg.version === 'number'
        ? { type: 'room:rejoin', token: msg.token, version: msg.version }
        : null;
    case 'lobby:kick':
      return isString(msg.playerId) ? { type: 'lobby:kick', playerId: msg.playerId } : null;
    case 'lobby:reorder':
      return Array.isArray(msg.playerIds) && msg.playerIds.length <= MAX_PLAYERS && msg.playerIds.every((id) => isString(id))
        ? { type: 'lobby:reorder', playerIds: msg.playerIds }
        : null;
    case 'lobby:settings': {
      const settings = parseSettings(msg.settings);
      return settings ? { type: 'lobby:settings', settings } : null;
    }
    case 'vote:start':
      return isString(msg.targetId) ? { type: 'vote:start', targetId: msg.targetId } : null;
    case 'vote:cast':
      return typeof msg.yes === 'boolean' ? { type: 'vote:cast', yes: msg.yes } : null;
    case 'guess:mark':
      return typeof msg.correct === 'boolean' ? { type: 'guess:mark', correct: msg.correct } : null;
    default:
      return null;
  }
}

/** מתי לבדוק אם למחוק את החדר */
export function cleanupAt(room: Room): number {
  return room.players.length === 0 && room.hostId === null && room.nextId === 1
    ? room.lastActivity + RESERVE_TTL_MS
    : room.lastActivity + IDLE_TTL_MS;
}
