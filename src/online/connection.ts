import { PROTOCOL_VERSION, type ClientMessage, type ServerMessage } from './protocol';

export type ConnectionStatus = 'connecting' | 'open' | 'reconnecting';

interface Handlers {
  /** החיבור נפתח (גם אחרי חיבור מחדש). כאן שולחים join או rejoin */
  onOpen: () => void;
  onMessage: (message: ServerMessage) => void;
  onStatus: (status: ConnectionStatus) => void;
  /** השרת סגר את החיבור בכוונה (למשל החדר נפתח בלשונית אחרת). לא מתחברים מחדש */
  onEnd: (reason: string) => void;
}

/** קוד הסגירה שהשרת שולח כשאין טעם להתחבר מחדש (worker/room.ts) */
const CLOSE_LEFT = 4000;

/** כל כמה זמן בודקים שהחיבור חי. השרת עונה pong בלי להתעורר (setWebSocketAutoResponse) */
const PING_EVERY_MS = 25_000;
/** בלי pong בזמן הזה, החיבור נחשב מת ומתחברים מחדש */
const PONG_TIMEOUT_MS = 8_000;
const MAX_RETRY_MS = 10_000;

export function roomSocketUrl(code: string): string {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${location.host}/api/rooms/${code}/ws`;
}

/**
 * WebSocket לחדר שמתחבר מחדש לבד: כשהחיבור נופל, כשהטלפון חוזר מהרקע, וכשהאינטרנט חוזר.
 * טלפונים מנתקים WebSocket כשהמסך ננעל, אז זה קורה הרבה.
 */
export class RoomConnection {
  private ws: WebSocket | null = null;
  private stopped = false;
  private attempt = 0;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private pingTimer: ReturnType<typeof setInterval> | undefined;
  private pongTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly url: string,
    private readonly handlers: Handlers,
  ) {}

  start() {
    document.addEventListener('visibilitychange', this.onWake);
    window.addEventListener('online', this.onWake);
    this.open();
  }

  stop() {
    this.stopped = true;
    document.removeEventListener('visibilitychange', this.onWake);
    window.removeEventListener('online', this.onWake);
    clearTimeout(this.retryTimer);
    this.clearPing();
    this.ws?.close();
    this.ws = null;
  }

  send(message: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(message));
  }

  private open() {
    if (this.stopped) return;
    clearTimeout(this.retryTimer);
    this.handlers.onStatus(this.attempt === 0 ? 'connecting' : 'reconnecting');

    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.onopen = () => {
      this.attempt = 0;
      this.handlers.onStatus('open');
      this.startPing();
      this.handlers.onOpen();
    };
    ws.onmessage = (event) => {
      if (event.data === 'pong') return clearTimeout(this.pongTimer);
      try {
        this.handlers.onMessage(JSON.parse(event.data as string) as ServerMessage);
      } catch {
        // הודעה שבורה: מתעלמים
      }
    };
    ws.onclose = (event) => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.clearPing();
      if (event.code === CLOSE_LEFT) {
        this.stop();
        this.handlers.onEnd(event.reason);
      } else {
        this.scheduleRetry();
      }
    };
  }

  private scheduleRetry() {
    if (this.stopped) return;
    this.handlers.onStatus('reconnecting');
    const delay = Math.min(MAX_RETRY_MS, 500 * 2 ** this.attempt);
    this.attempt++;
    this.retryTimer = setTimeout(() => this.open(), delay);
  }

  /** הטלפון חזר מהרקע או שהאינטרנט חזר: לא מחכים לניסיון הבא */
  private onWake = () => {
    if (this.stopped || document.visibilityState !== 'visible') return;
    if (!this.ws) {
      this.attempt = 0;
      this.open();
    } else if (this.ws.readyState === WebSocket.OPEN) {
      // אחרי רקע, החיבור עלול להיראות פתוח אבל להיות מת. בודקים מיד
      this.ping();
    }
  };

  private startPing() {
    this.clearPing();
    this.pingTimer = setInterval(() => this.ping(), PING_EVERY_MS);
  }

  private ping() {
    const ws = this.ws;
    if (ws?.readyState !== WebSocket.OPEN) return;
    ws.send('ping');
    clearTimeout(this.pongTimer);
    this.pongTimer = setTimeout(() => ws.close(), PONG_TIMEOUT_MS);
  }

  private clearPing() {
    clearInterval(this.pingTimer);
    clearTimeout(this.pongTimer);
  }
}

export type CreateRoomResult = { code: string } | { error: 'outdated' | 'network' };

/** פתיחת חדר: השרת מגריל קוד פנוי */
export async function createRoom(): Promise<CreateRoomResult> {
  try {
    const response = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version: PROTOCOL_VERSION }),
    });
    if (response.status === 409) return { error: 'outdated' };
    if (!response.ok) return { error: 'network' };
    const { code } = (await response.json()) as { code: string };
    return { code };
  } catch {
    return { error: 'network' };
  }
}
