import { useEffect, useRef, useState } from 'react';
import { track } from '../analytics/posthog';
import { RoomConnection, roomSocketUrl, type ConnectionStatus } from './connection';
import { PROTOCOL_VERSION, type ClientMessage, type ErrorCode, type RoomState } from './protocol';
import { clearSession, loadSession, saveSession, type Session } from './session';

/** למה הטלפון כבר לא בחדר */
export type RoomEnd =
  | { kind: 'left' | 'kicked' | 'closed' | 'hostClosed' }
  /** החדר נפתח בלשונית או בטלפון אחר עם אותו שחקן */
  | { kind: 'replaced' }
  | { kind: 'error'; code: ErrorCode };

/**
 * טוקן אקראי לשחקן. crypto.randomUUID קיים רק בדף מאובטח (HTTPS או localhost),
 * ובבדיקה מהטלפון מול המחשב בכתובת 192.168.x.x הוא חסר. getRandomValues קיים בכל מקום
 */
function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** שגיאות שאחריהן אין טעם להישאר מחוברים */
const FATAL: readonly ErrorCode[] = [
  'outdated',
  'room_not_found',
  'room_full',
  'name_required',
  'name_taken',
  'bad_token',
  'claim_rejected',
];

/**
 * השם שנבחר שייך לשחקן שלא מחובר: אולי זה המקום של הטלפון הזה, מדפדפן אחר.
 * approval: מישהו בחדר יצטרך לאשר. waiting: ביקשנו, ומחכים לאישור
 */
export interface SeatOffer {
  name: string;
  approval: boolean;
  waiting: boolean;
}

/**
 * החיבור לחדר: מצטרף (או חוזר עם הטוקן ששמור בטלפון), ומחזיר את המצב האחרון שהשרת שלח.
 * name משמש רק להצטרפות ראשונה. אחרי ריענון הטלפון חוזר עם הטוקן, גם בלי שם.
 */
export function useRoom(code: string, name: string) {
  const [state, setState] = useState<RoomState | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [end, setEnd] = useState<RoomEnd | null>(null);
  const [offer, setOffer] = useState<SeatOffer | null>(null);
  const connection = useRef<RoomConnection | null>(null);
  const claimRef = useRef<() => void>(() => {});

  useEffect(() => {
    // גם אם localStorage חסום, הטוקן נשמר בזיכרון לחיבורים מחדש
    let session: Session | null = loadSession(code);
    let finished = false;
    /** ביקשנו לחזור למקום. אם החיבור נפל בזמן ההמתנה, מבקשים שוב אחרי שהשרת מציע את המקום מחדש */
    let claiming = false;

    const finish = (result: RoomEnd) => {
      if (finished) return;
      finished = true;
      conn.stop();
      setEnd(result);
    };

    const conn = new RoomConnection(roomSocketUrl(code), {
      onOpen: () => {
        if (!session) {
          session = { code, token: newToken(), joined: false };
          saveSession(session);
        }
        conn.send(
          session.joined
            ? { type: 'room:rejoin', token: session.token, version: PROTOCOL_VERSION }
            : { type: 'room:join', name, token: session.token, version: PROTOCOL_VERSION },
        );
        // חיבור חדש נחשב גלוי. אם התחברנו מחדש כשהדף מוסתר, מעדכנים (השרת מטפל בהודעות לפי הסדר, אחרי ההצטרפות)
        if (document.hidden) conn.send({ type: 'presence', away: true });
      },
      onMessage: (message) => {
        switch (message.type) {
          case 'state':
            setState(message.state);
            break;
          case 'claimable':
            offered = message.name;
            setOffer({ name: message.name, approval: message.approval, waiting: claiming });
            if (claiming) claim(message.name);
            break;
          case 'claim:waiting':
            setOffer((current) => current && { ...current, waiting: true });
            break;
          case 'welcome':
            claiming = false;
            setOffer(null);
            if (session && !session.joined) {
              session = { ...session, joined: true };
              saveSession(session);
              track('room_joined');
            }
            break;
          case 'left':
            clearSession(code);
            finish({ kind: message.reason });
            break;
          case 'error':
            if (!FATAL.includes(message.code)) break;
            if (message.code !== 'outdated') clearSession(code);
            finish({ kind: 'error', code: message.code });
            break;
        }
      },
      onStatus: setStatus,
      onEnd: (reason) => finish({ kind: reason === 'replaced' ? 'replaced' : 'closed' }),
    });

    // כולם רואים מי לא במסך (לשונית אחרת, אפליקציה אחרת), כדי לדעת למי לקרוא
    /** "זה המקום שלי": עם הטוקן החדש של הטלפון הזה */
    const claim = (seatName: string) => {
      if (!session) return;
      claiming = true;
      conn.send({ type: 'room:claim', name: seatName, token: session.token, version: PROTOCOL_VERSION });
    };
    let offered = '';
    claimRef.current = () => offered && claim(offered);

    const onVisibility = () => conn.send({ type: 'presence', away: document.hidden });
    document.addEventListener('visibilitychange', onVisibility);

    connection.current = conn;
    conn.start();
    return () => {
      finished = true;
      document.removeEventListener('visibilitychange', onVisibility);
      conn.stop();
    };
  }, [code, name]);

  const send = (message: ClientMessage) => connection.current?.send(message);

  /** "זה המקום שלי" על המקום שהשרת הציע */
  const claimSeat = () => claimRef.current();

  return { state, status, end, send, offer, claimSeat };
}
