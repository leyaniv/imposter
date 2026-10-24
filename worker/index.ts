/**
 * ה-Worker של המשחק.
 * קבצי המשחק מוגשים ישירות מ-dist (וזה בחינם). רק בקשות ל-/api/ מגיעות לכאן (run_worker_first ב-wrangler.jsonc):
 *   POST /api/rooms            פתיחת חדר: מגריל קוד פנוי ומחזיר { code }
 *   GET  /api/rooms/<code>/ws  WebSocket לחדר, מנותב ל-Durable Object של הקוד
 */
import { CODE_LENGTH, PROTOCOL_VERSION, isRoomCode } from '../src/online/protocol';

export { Room } from './room';

/** כמה פעמים לנסות קוד אחר אם הקוד שהוגרל תפוס */
const CREATE_ATTEMPTS = 10;

export default {
  async fetch(request, env): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (pathname === '/api/rooms') {
      if (request.method !== 'POST') return error(405, 'method_not_allowed');
      return createRoom(request, env);
    }

    const match = /^\/api\/rooms\/([^/]+)\/ws$/.exec(pathname);
    if (match) {
      if (!isRoomCode(match[1])) return error(404, 'room_not_found');
      if (request.headers.get('Upgrade') !== 'websocket') return error(426, 'expected_websocket');
      return env.ROOMS.getByName(match[1]).fetch(request);
    }

    if (pathname.startsWith('/api/')) return error(404, 'not_found');
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;

async function createRoom(request: Request, env: Env): Promise<Response> {
  const body = await request.json<{ version?: unknown }>().catch(() => null);
  if (body?.version !== PROTOCOL_VERSION) return error(409, 'outdated');

  for (let attempt = 0; attempt < CREATE_ATTEMPTS; attempt++) {
    const code = randomCode();
    if (await env.ROOMS.getByName(code).reserve(code)) return Response.json({ code });
  }
  return error(503, 'no_free_code');
}

/** 6 ספרות, כולל אפס בהתחלה */
function randomCode(): string {
  const [n] = crypto.getRandomValues(new Uint32Array(1));
  return String(n % 10 ** CODE_LENGTH).padStart(CODE_LENGTH, '0');
}

function error(status: number, code: string): Response {
  return Response.json({ error: code }, { status, headers: { 'Cache-Control': 'no-store' } });
}
