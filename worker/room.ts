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
}

/** קוד סגירה של WebSocket אחרי שהשחקן יצא, הוצא, או שהחדר נמחק */
const CLOSE_LEFT = 4000;

/**
 * Durable Object אחד לכל חדר: מחזיק את מצב החדר ואת החיבורים של כל הטלפונים.
 * משתמש ב-WebSocket Hibernation API, כך שבין הודעות החדר "ישן" ולא עולה כסף, בלי לנתק את הטלפונים.
 * כל החוקים ב-logic.ts. כאן רק חיבורים, אחסון וניקוי.
 */
export class Room extends DurableObject<Env> {
  private room: RoomData | undefined;
  /** אפשר לקצר בפיתוח, בשביל בדיקת העשן: wrangler dev --var HOST_AWAY_MS:3000 */
  private readonly hostAwayMs: number;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.hostAwayMs = Number((env as { HOST_AWAY_MS?: string }).HOST_AWAY_MS) || HOST_AWAY_MS;
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
    server.serializeAttachment({ playerId: null } satisfies Attachment);
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
  private async disconnected(ws: WebSocket) {
    if (this.room) {
      const connected = this.connectedIds(ws);
      // בהצבעה מנותקים לא נספרים. ואם זה המארח, מתחילים לספור את הזמן עד שהאירוח עובר
      const next = trackHost(settleVote(this.room, connected), connected, Date.now());
      if (next !== this.room) await this.save(next);
    }
    this.broadcast(ws);
  }

  /** התעוררות מתוזמנת: העברת אירוח ממארח שנעלם, או מחיקת חדר שלא היה בו שינוי שעתיים */
  async alarm() {
    if (!this.room) return;
    const now = Date.now();
    const handedOver = hostTimeout(this.room, this.connectedIds(), now, this.hostAwayMs);
    if (handedOver !== this.room) {
      await this.save(handedOver);
      this.broadcast();
    }

    if (now >= cleanupAt(this.room)) return this.closeRoom('closed');
    // אם הזמן של המארח עבר ואין למי להעביר, מחכים שמישהו יתחבר (admit בודק שוב) ולא מתעוררים בלולאה
    const next = nextAlarm(this.room, this.hostAwayMs);
    await this.ctx.storage.setAlarm(next > now ? next : cleanupAt(this.room));
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
    ws.serializeAttachment({ playerId } satisfies Attachment);

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
    send(ws, { type: 'state', state: view(this.room!, playerId, this.connectedIds()) });
  }

  private disconnect(playerId: string, reason: LeftReason) {
    for (const ws of this.sockets(playerId)) {
      send(ws, { type: 'left', reason });
      ws.serializeAttachment({ playerId: null } satisfies Attachment);
      ws.close(CLOSE_LEFT, reason);
    }
  }

  /** שולח לכל טלפון את המצב שהוא רשאי לראות. closing: חיבור שנסגר עכשיו ועוד מופיע ברשימה */
  private broadcast(closing?: WebSocket) {
    if (!this.room) return;
    const connected = this.connectedIds(closing);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === closing) continue;
      const { playerId } = ws.deserializeAttachment() as Attachment;
      if (playerId) send(ws, { type: 'state', state: view(this.room, playerId, connected) });
    }
  }

  private connectedIds(closing?: WebSocket): Set<string> {
    const ids = new Set<string>();
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === closing || ws.readyState !== WebSocket.OPEN) continue;
      const { playerId } = ws.deserializeAttachment() as Attachment;
      if (playerId) ids.add(playerId);
    }
    return ids;
  }

  private sockets(playerId: string): WebSocket[] {
    return this.ctx.getWebSockets().filter((ws) => (ws.deserializeAttachment() as Attachment).playerId === playerId);
  }

  /**
   * כל המצב נשמר כמפתח אחד (שורה אחת ב-SQLite).
   * התזכורת נקבעת רק אם אין אחת, או אם צריך להתעורר מוקדם יותר (מארח שנעלם), כדי לא לכתוב פעמיים בכל שינוי.
   * alarm() דוחה אותה לפי הצורך.
   */
  private async save(room: RoomData) {
    this.room = room;
    await this.ctx.storage.put('room', room);
    const wanted = nextAlarm(room, this.hostAwayMs);
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
