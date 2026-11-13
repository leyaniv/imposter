import { DurableObject } from 'cloudflare:workers';
import type { ClientMessage, ErrorCode, LeftReason, RoomSettings, ServerMessage } from '../src/online/protocol';
import {
  HOST_AWAY_MS,
  act,
  cleanupAt,
  createRoom,
  hostTimeout,
  join,
  nextAlarm,
  parseMessage,
  rejoin,
  settleVote,
  trackHost,
  upgradeRoom,
  view,
  type Room as RoomData,
} from './logic';

/** מה שמוצמד לכל WebSocket. נשמר גם כשהחדר "ישן" */
interface Attachment {
  playerId: string | null;
  /** מתי החיבור נפתח. עד ה-ping הראשון, זה הסימן האחרון שהוא חי. חסר בחיבורים מלפני שהשדה נוסף */
  since?: number;
  /** הדף בטלפון מוסתר (לשונית אחרת, אפליקציה אחרת). חיבור חדש מתחיל כגלוי, והטלפון מעדכן */
  away?: boolean;
}

/** קוד סגירה של WebSocket אחרי שהשחקן יצא, הוצא, או שהחדר נמחק */
const CLOSE_LEFT = 4000;
/** קוד סגירה של חיבור שהפסיק לשלוח ping. הטלפון מתחבר מחדש אם הוא עדיין שם */
const CLOSE_STALE = 4001;
/**
 * חיבור שלא שלח ping כל כך הרבה זמן נחשב מת: טלפון שיצא מהרשת, או לשונית שהדפדפן הקפיא.
 * הטלפון שולח ping כל 25 שניות, אבל בלשונית ברקע Chrome מריץ טיימרים רק פעם בדקה, אז צריך מרווח
 */
const STALE_MS =2 * 60 * 1000;

/**
 * Durable Object אחד לכל חדר: מחזיק את מצב החדר ואת החיבורים של כל הטלפונים.
 * משתמש ב-WebSocket Hibernation API, כך שבין הודעות החדר "ישן" ולא עולה כסף, בלי לנתק את הטלפונים.
 * כל החוקים ב-logic.ts. כאן רק חיבורים, אחסון וניקוי.
 */
export class Room extends DurableObject<Env> {
  private room: RoomData | undefined;
  /** אפשר לקצר בפיתוח, בשביל בדיקת העשן: wrangler dev --var HOST_AWAY_MS:3000 */
  private readonly hostAwayMs: number;
  /** אפשר לקצר בפיתוח, בשביל בדיקת העשן: wrangler dev --var STALE_MS:4000 */
  private readonly staleMs: number;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    const vars = env as { HOST_AWAY_MS?: string; STALE_MS?: string };
    this.hostAwayMs = Number(vars.HOST_AWAY_MS) || HOST_AWAY_MS;
    this.staleMs = Number(vars.STALE_MS) || STALE_MS;
    // ping/pong בלי להעיר את החדר ובלי חיוב
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    ctx.blockConcurrencyWhile(async () => {
      const saved = await ctx.storage.get<RoomData>('room');
      this.room = saved && upgradeRoom(saved);
    });
  }

  /** נקרא מה-Worker כשפותחים חדר, עם ההגדרות האחרונות של המארח. false אם הקוד כבר תפוס */
  async reserve(code: string, settings: RoomSettings): Promise<boolean> {
    if (this.room) return false;
    await this.save(createRoom(code, Date.now(), settings));
    return true;
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected WebSocket', { status: 426 });
    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ playerId: null, since: Date.now() } satisfies Attachment);
    // התזכורת אולי רחוקה (ניקוי החדר בעוד שעתיים): מקדימים אותה לבדיקה של החיבור הזה
    if (this.room) await this.schedule(this.room);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    const message = typeof raw === 'string' ? parseMessage(raw) : null;
    if (!message) return send(ws, { type: 'error', code: 'bad_message' });

    if (!this.room) {
      send(ws, { type: 'error', code: 'room_not_found' });
      return ws.close(CLOSE_LEFT, 'room_not_found');
    }

    const { playerId } = ws.deserializeAttachment() as Attachment;
    if (message.type === 'room:join' || message.type === 'room:rejoin') {
      if (playerId) return send(ws, { type: 'error', code: 'bad_message' });
      return this.admit(ws, message);
    }
    if (!playerId) return send(ws, { type: 'error', code: 'not_joined' });
    if (message.type === 'presence') return this.setAway(ws, message.away);

    const result = act(this.room, playerId, message, Date.now(), { connected: this.connectedIds() });
    if ('error' in result) return this.reject(ws, playerId, result.error);
    if (result.close) return this.closeRoom('hostClosed');

    if (result.left) this.disconnect(result.left.playerId, result.left.reason);
    // האירוח אולי עבר למישהו מנותק (או ממנו): מתחילים או מפסיקים לספור את הזמן שלו
    await this.save(trackHost(result.room, this.connectedIds(), Date.now()));
    this.broadcast();
  }

  async webSocketClose(ws: WebSocket) {
    await this.disconnected(ws);
  }

  async webSocketError(ws: WebSocket) {
    await this.disconnected(ws);
  }

  /**
   * הטלפון התנתק (ננעל, ריענון וכו'). השחקן נשאר בחדר, ורק מסומן כמנותק.
   * בהצבעה פתוחה מנותקים לא נספרים, אז אולי עכשיו כל המחוברים כבר הצביעו
   */
  private async disconnected(ws?: WebSocket) {
    if (this.room) {
      const connected = this.connectedIds(ws);
      // בהצבעה מנותקים לא נספרים. ואם זה המארח, מתחילים לספור את הזמן עד שהאירוח עובר
      const next = trackHost(settleVote(this.room, connected), connected, Date.now());
      if (next !== this.room) await this.save(next);
    }
    this.broadcast(ws);
  }

  /** הטלפון דיווח שהדף הוסתר או חזר. נשמר רק על החיבור, בלי לכתוב לאחסון */
  private setAway(ws: WebSocket, away: boolean) {
    const attachment = ws.deserializeAttachment() as Attachment;
    if (!!attachment.away === away) return;
    ws.serializeAttachment({ ...attachment, away } satisfies Attachment);
    this.broadcast();
  }

  /**
   * התעוררות מתוזמנת: סגירת חיבורים שמתו בשקט, העברת אירוח ממארח שנעלם, או מחיקת חדר שלא היה בו שינוי שעתיים
   */
  async alarm() {
    if (!this.room) return;
    const now = Date.now();
    // חיבור שמת בלי לסגור לא מגיע ל-webSocketClose, אז מסמנים אותו כמנותק מכאן
    if (this.closeStale(now)) await this.disconnected();

    const handedOver = hostTimeout(this.room!, this.connectedIds(), now, this.hostAwayMs);
    if (handedOver !== this.room) {
      await this.save(handedOver);
      this.broadcast();
    }

    const room = this.room!;
    if (now >= cleanupAt(room)) return this.closeRoom('closed');
    // אם הזמן של המארח עבר ואין למי להעביר, מחכים שמישהו יתחבר (admit בודק שוב) ולא מתעוררים בלולאה
    const next = nextAlarm(room, this.hostAwayMs);
    await this.ctx.storage.setAlarm(Math.min(next > now ? next : cleanupAt(room), this.staleAt() ?? Infinity));
  }

  /** סוגר חיבורים שלא שלחו ping זמן רב. true אם נסגר מישהו */
  private closeStale(now: number): boolean {
    let closed = false;
    for (const ws of this.ctx.getWebSockets()) {
      if (ws.readyState !== WebSocket.OPEN || now < this.lastSeen(ws) + this.staleMs) continue;
      try {
        ws.close(CLOSE_STALE, 'stale');
      } catch {
        // כבר נסגר
      }
      closed = true;
    }
    return closed;
  }

  /** הסימן האחרון שהחיבור חי: ה-ping האחרון (השרת עונה עליו בלי להתעורר, אבל זוכר מתי), או הפתיחה */
  private lastSeen(ws: WebSocket): number {
    const pinged = this.ctx.getWebSocketAutoResponseTimestamp(ws)?.getTime() ?? 0;
    const { since } = ws.deserializeAttachment() as Attachment;
    return Math.max(pinged, since ?? 0);
  }

  /** מתי החיבור הפתוח הבא ייחשב מת אם לא ישלח ping. null אם אין חיבורים */
  private staleAt(): number | null {
    let earliest: number | null = null;
    for (const ws of this.ctx.getWebSockets()) {
      if (ws.readyState !== WebSocket.OPEN) continue;
      const at = this.lastSeen(ws) + this.staleMs;
      if (earliest === null || at < earliest) earliest = at;
    }
    return earliest;
  }

  private async admit(ws: WebSocket, message: Extract<ClientMessage, { type: 'room:join' | 'room:rejoin' }>) {
    const room = this.room!;
    let playerId: string;
    if (message.type === 'room:join') {
      const result = join(room, message.name, message.version, message.token, Date.now());
      if ('error' in result) return send(ws, { type: 'error', code: result.error });
      playerId = result.playerId;
      if (result.room !== room) await this.save(result.room);
      send(ws, { type: 'welcome' });
    } else {
      const result = rejoin(room, message.token, message.version);
      if ('error' in result) return send(ws, { type: 'error', code: result.error });
      playerId = result.playerId;
    }

    // אותו שחקן מחובר כבר מטלפון אחר (או מלשונית ישנה): החיבור החדש מחליף אותו
    for (const other of this.sockets(playerId)) other.close(CLOSE_LEFT, 'replaced');
    ws.serializeAttachment({ ...(ws.deserializeAttachment() as Attachment), playerId } satisfies Attachment);

    // המארח חזר, או שעכשיו יש למי להעביר אירוח ממארח שנעלם מזמן
    const connected = this.connectedIds();
    const next = hostTimeout(trackHost(this.room!, connected, Date.now()), connected, Date.now(), this.hostAwayMs);
    if (next !== this.room) await this.save(next);
    this.broadcast();
  }

  /** מנתק את כולם ומוחק את החדר: אחרי זמן בלי פעילות, או כשהמארח סגר אותו */
  private async closeRoom(reason: LeftReason) {
    for (const ws of this.ctx.getWebSockets()) {
      send(ws, { type: 'left', reason });
      ws.close(CLOSE_LEFT, reason);
    }
    this.room = undefined;
    await this.ctx.storage.deleteAll();
  }

  /** הפעולה נדחתה. שולחים שוב את המצב, כדי שהמסך לא יישאר עם שינוי שלא קרה (למשל סדר אחר) */
  private reject(ws: WebSocket, playerId: string, code: ErrorCode) {
    send(ws, { type: 'error', code });
    const away = this.connectedIds(undefined, true);
    send(ws, { type: 'state', state: view(this.room!, playerId, this.connectedIds(), away) });
  }

  private disconnect(playerId: string, reason: LeftReason) {
    for (const ws of this.sockets(playerId)) {
      send(ws, { type: 'left', reason });
      ws.serializeAttachment({ ...(ws.deserializeAttachment() as Attachment), playerId: null } satisfies Attachment);
      ws.close(CLOSE_LEFT, reason);
    }
  }

  /** שולח לכל טלפון את המצב שהוא רשאי לראות. closing: חיבור שנסגר עכשיו ועוד מופיע ברשימה */
  private broadcast(closing?: WebSocket) {
    if (!this.room) return;
    const connected = this.connectedIds(closing);
    const away = this.connectedIds(closing, true);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === closing) continue;
      const { playerId } = ws.deserializeAttachment() as Attachment;
      if (playerId) send(ws, { type: 'state', state: view(this.room, playerId, connected, away) });
    }
  }

  /** מי מחובר. onlyAway: רק מי שהדף שלו מוסתר */
  private connectedIds(closing?: WebSocket, onlyAway = false): Set<string> {
    const ids = new Set<string>();
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === closing || ws.readyState !== WebSocket.OPEN) continue;
      const { playerId, away } = ws.deserializeAttachment() as Attachment;
      if (playerId && (!onlyAway || away)) ids.add(playerId);
    }
    return ids;
  }

  private sockets(playerId: string): WebSocket[] {
    return this.ctx.getWebSockets().filter((ws) => (ws.deserializeAttachment() as Attachment).playerId === playerId);
  }

  /**
   * כל המצב נשמר כמפתח אחד (שורה אחת ב-SQLite).
   * התזכורת נקבעת רק אם אין אחת, או אם צריך להתעורר מוקדם יותר (מארח שנעלם, חיבור שאולי מת), כדי לא לכתוב פעמיים בכל שינוי.
   * alarm() דוחה אותה לפי הצורך.
   */
  private async save(room: RoomData) {
    this.room = room;
    await this.ctx.storage.put('room', room);
    await this.schedule(room);
  }

  /** מקדים את התזכורת אם צריך: ניקוי, מארח שנעלם, או החיבור הבא שאולי מת */
  private async schedule(room: RoomData) {
    const wanted = Math.min(nextAlarm(room, this.hostAwayMs), this.staleAt() ?? Infinity);
    const current = await this.ctx.storage.getAlarm();
    if (current === null || wanted < current) await this.ctx.storage.setAlarm(wanted);
  }
}

function send(ws: WebSocket, message: ServerMessage) {
  try {
    ws.send(JSON.stringify(message));
  } catch {
    // החיבור כבר נסגר
  }
}
