/**
 * החוקים של חדר במצב "כל אחד בטלפון שלו": פונקציות טהורות, בלי Cloudflare ובלי דפדפן.
 * ה-Durable Object (room.ts) רק מחבר אותן ל-WebSocket ולאחסון, ולכן אפשר לבדוק את הכול עם vitest רגיל.
 */
import { MAX_PLAYERS } from '../src/game/setup';
import {
  MAX_NAME_LENGTH,
  MAX_TOKEN_LENGTH,
  MIN_TOKEN_LENGTH,
  PROTOCOL_VERSION,
  type ClientMessage,
  type ErrorCode,
  type RoomState,
} from '../src/online/protocol';

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
}

/** כמה זמן חדר שאף אחד לא הצטרף אליו מחכה לראשון */
export const RESERVE_TTL_MS = 10 * 60 * 1000;
/** אחרי כמה זמן בלי שינוי חדר נמחק */
export const IDLE_TTL_MS = 2 * 60 * 60 * 1000;

export function createRoom(code: string, now: number): Room {
  return { code, hostId: null, players: [], nextId: 1, lastActivity: now };
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

/**
 * שחקן חדש. הטוקן נוצר בטלפון.
 * אם כבר יש שחקן עם הטוקן הזה, ההצטרפות הקודמת הצליחה והתשובה פשוט לא הגיעה: מחזירים אותו בלי לשנות כלום.
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

function remove(room: Room, playerId: string, now: number): Room {
  const index = room.players.findIndex((player) => player.id === playerId);
  const players = room.players.filter((player) => player.id !== playerId);
  let hostId = room.hostId;
  // המארח יצא: האירוח עובר לשחקן הבא בסדר הישיבה
  if (hostId === playerId) hostId = players.length > 0 ? players[index % players.length].id : null;
  return { ...room, players, hostId, lastActivity: now };
}

/** הודעה משחקן שכבר בחדר (לא join ולא rejoin) */
export function act(room: Room, playerId: string, message: ClientMessage, now: number): ActionResult {
  if (!room.players.some((player) => player.id === playerId)) return { error: 'not_joined' };
  const isHost = room.hostId === playerId;

  switch (message.type) {
    case 'room:leave':
      return { room: remove(room, playerId, now), left: { playerId, reason: 'left' } };

    case 'lobby:kick': {
      if (!isHost) return { error: 'not_host' };
      if (message.playerId === playerId || !room.players.some((p) => p.id === message.playerId)) {
        return { error: 'bad_message' };
      }
      return { room: remove(room, message.playerId, now), left: { playerId: message.playerId, reason: 'kicked' } };
    }

    case 'lobby:reorder': {
      if (!isHost) return { error: 'not_host' };
      const ids = message.playerIds;
      const sameSet =
        ids.length === room.players.length &&
        new Set(ids).size === ids.length &&
        room.players.every((player) => ids.includes(player.id));
      if (!sameSet) return { error: 'bad_order' };
      const byId = new Map(room.players.map((player) => [player.id, player]));
      return { room: { ...room, players: ids.map((id) => byId.get(id)!), lastActivity: now } };
    }

    case 'room:join':
    case 'room:rejoin':
      return { error: 'bad_message' };
  }
}

/** מה שהטלפון של playerId רואה. בלי טוקנים */
export function view(room: Room, playerId: string, connectedIds: ReadonlySet<string>): RoomState {
  return {
    code: room.code,
    hostId: room.hostId,
    players: room.players.map(({ id, name }) => ({ id, name, connected: connectedIds.has(id) })),
    you: playerId,
  };
}

/** בודק שהודעה מהטלפון בנויה נכון. כל דבר אחר נדחה */
export function parseMessage(raw: string): ClientMessage | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null) return null;
  const msg = data as Record<string, unknown>;
  const isString = (value: unknown, max = 200): value is string => typeof value === 'string' && value.length <= max;
  const isToken = (value: unknown): value is string =>
    isString(value, MAX_TOKEN_LENGTH) && value.length >= MIN_TOKEN_LENGTH;

  switch (msg.type) {
    case 'room:join':
      return isString(msg.name) && isToken(msg.token) && typeof msg.version === 'number'
        ? { type: 'room:join', name: msg.name, token: msg.token, version: msg.version }
        : null;
    case 'room:rejoin':
      return isToken(msg.token) && typeof msg.version === 'number'
        ? { type: 'room:rejoin', token: msg.token, version: msg.version }
        : null;
    case 'room:leave':
      return { type: 'room:leave' };
    case 'lobby:kick':
      return isString(msg.playerId) ? { type: 'lobby:kick', playerId: msg.playerId } : null;
    case 'lobby:reorder':
      return Array.isArray(msg.playerIds) && msg.playerIds.length <= MAX_PLAYERS && msg.playerIds.every((id) => isString(id))
        ? { type: 'lobby:reorder', playerIds: msg.playerIds }
        : null;
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
