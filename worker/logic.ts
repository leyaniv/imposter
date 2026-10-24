/**
 * החוקים של חדר במצב "כל אחד בטלפון שלו": פונקציות טהורות, בלי Cloudflare ובלי דפדפן.
 * ה-Durable Object (room.ts) רק מחבר אותן ל-WebSocket ולאחסון, ולכן אפשר לבדוק את הכול עם vitest רגיל.
 */
import words from '../src/data/words.he.json';
import { cryptoRng, type Rng } from '../src/game/random';
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
} from '../src/online/protocol';

const bank: WordEntry[] = words;
const allCategories = listCategories(bank);

export interface StoredPlayer {
  id: string;
  name: string;
  /** סוד: רק הטלפון של השחקן מכיר אותו. לא נשלח לאף אחד אחר */
  token: string;
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
  /** מי מהסבב יצא מהחדר באמצע */
  leftIds: string[];
  /** הסבב נגמר כי מתחזה יצא מהחדר */
  imposterLeft: boolean;
}

/** כמה זמן חדר שאף אחד לא הצטרף אליו מחכה לראשון */
export const RESERVE_TTL_MS = 10 * 60 * 1000;
/** אחרי כמה זמן בלי שינוי חדר נמחק */
export const IDLE_TTL_MS = 2 * 60 * 60 * 1000;

/** כמו ברירת המחדל של הטלפון האחד */
export const DEFAULT_SETTINGS: RoomSettings = {
  categories: [],
  imposterCount: 1,
  imposterNeverStarts: true,
  showCategory: false,
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
  };
}

/** חדר שנשמר בגרסה קודמת (בלי הגדרות וסבבים) מקבל ערכי ברירת מחדל */
export function upgradeRoom(saved: Room): Room {
  return { ...createRoom(saved.code, saved.lastActivity), ...saved };
}

/** מה קרה בעקבות הודעה של שחקן שכבר בחדר */
export type ActionResult =
  | { room: Room; left?: { playerId: string; reason: 'left' | 'kicked' } }
  | { error: ErrorCode };

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

/** שחקן שעדיין משתתף בסבב הנוכחי */
function inRound(room: Room, playerId: string): boolean {
  return !!room.round?.players.some((player) => player.id === playerId) && !room.leftIds.includes(playerId);
}

/** כולם (מי שעוד בסבב) ראו את התפקיד: עוברים למשחק */
function afterSeen(room: Room): Room {
  if (room.phase !== 'reveal' || !room.round) return room;
  const waiting = room.round.players.some((player) => inRound(room, player.id) && !room.seenIds.includes(player.id));
  return waiting ? room : { ...room, phase: 'play' };
}

/**
 * מישהו יצא מהחדר באמצע סבב.
 * מתחזה: אי אפשר להמשיך בלעדיו, אז הסבב נגמר וכולם רואים את המילה.
 * שחקן רגיל: יוצא מהסבב, והסבב ממשיך.
 */
function leaveRound(room: Room, playerId: string): Room {
  if ((room.phase !== 'reveal' && room.phase !== 'play') || !inRound(room, playerId)) return room;
  const leftIds = [...room.leftIds, playerId];
  if (room.round!.imposterIds.includes(playerId)) return { ...room, leftIds, phase: 'roundEnd', imposterLeft: true };
  return afterSeen({ ...room, leftIds });
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
      lastActivity: now,
    },
  };
}

/** הודעה משחקן שכבר בחדר (לא join ולא rejoin) */
export function act(room: Room, playerId: string, message: ClientMessage, now: number, rng: Rng = cryptoRng): ActionResult {
  if (!room.players.some((player) => player.id === playerId)) return { error: 'not_joined' };
  const isHost = room.hostId === playerId;
  const hostOnly = message.type.startsWith('lobby:') || message.type.startsWith('round:') || message.type === 'game:start' || message.type === 'reveal:skip';
  if (hostOnly && !isHost) return { error: 'not_host' };

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
      return { room: { ...room, players: ids.map((id) => byId.get(id)!), lastActivity: now } };
    }

    case 'lobby:settings':
      if (room.phase !== 'lobby') return { error: 'wrong_phase' };
      return { room: { ...room, settings: cleanSettings(message.settings), lastActivity: now } };

    case 'game:start':
      if (room.phase !== 'lobby') return { error: 'wrong_phase' };
      return startRound(room, now, rng);

    case 'role:seen':
      if (room.phase !== 'reveal' || !inRound(room, playerId)) return { error: 'wrong_phase' };
      if (room.seenIds.includes(playerId)) return { room };
      return { room: afterSeen({ ...room, seenIds: [...room.seenIds, playerId], lastActivity: now }) };

    case 'reveal:skip':
      if (room.phase !== 'reveal') return { error: 'wrong_phase' };
      return { room: { ...room, phase: 'play', lastActivity: now } };

    case 'round:end':
      if (room.phase !== 'reveal' && room.phase !== 'play') return { error: 'wrong_phase' };
      return { room: { ...room, phase: 'roundEnd', lastActivity: now } };

    case 'round:next':
      if (room.phase !== 'roundEnd') return { error: 'wrong_phase' };
      return startRound(room, now, rng);

    case 'round:lobby':
      if (room.phase !== 'roundEnd') return { error: 'wrong_phase' };
      return {
        room: { ...room, phase: 'lobby', round: undefined, seenIds: [], leftIds: [], imposterLeft: false, lastActivity: now },
      };

    case 'room:join':
    case 'room:rejoin':
      return { error: 'bad_message' };
  }
}

/** 🔒 מה שהטלפון של playerId יודע על הסבב: רק התפקיד שלו, ואת השאר רק בסוף */
function roundView(room: Room, playerId: string): RoundState | undefined {
  const round = room.round;
  if (!round || room.phase === 'lobby') return undefined;
  const playing = inRound(room, playerId);
  const role: RoundState['role'] = !playing
    ? null
    : round.imposterIds.includes(playerId)
      ? { kind: 'imposter', hint: round.hints[playerId] }
      : { kind: 'crew', word: round.word };

  const state: RoundState = {
    number: room.roundNumber,
    players: round.players.map(({ id, name }) => ({ id, name })),
    starterId: round.players[round.startIndex].id,
    seenIds: room.seenIds,
    leftIds: room.leftIds,
    imposterCount: round.imposterIds.length,
    role,
  };
  if (playing && round.showCategory) state.category = round.category;
  if (room.phase === 'roundEnd') {
    state.reveal = {
      word: round.word,
      category: round.category,
      imposters: round.imposterIds.map((id) => ({ id, hint: round.hints[id] })),
      imposterLeft: room.imposterLeft,
    };
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
  };
  const round = roundView(room, playerId);
  if (round) state.round = round;
  return state;
}

type Fields = Record<string, unknown>;

/** הגדרות מהטלפון. null אם משהו לא בנוי נכון */
export function parseSettings(value: unknown): RoomSettings | null {
  if (typeof value !== 'object' || value === null) return null;
  const { categories, imposterCount, imposterNeverStarts, showCategory } = value as Fields;
  const validCategories =
    Array.isArray(categories) &&
    categories.length <= 100 &&
    categories.every((category) => typeof category === 'string' && category.length <= 100);
  if (!validCategories || (imposterCount !== 1 && imposterCount !== 2)) return null;
  if (typeof imposterNeverStarts !== 'boolean' || typeof showCategory !== 'boolean') return null;
  return { categories: categories as string[], imposterCount, imposterNeverStarts, showCategory };
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
