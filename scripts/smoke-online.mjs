// בדיקת עשן לשרת של מצב "כל אחד בטלפון שלו": שלושה "טלפונים" פותחים חדר, מצטרפים, משחקים סבב, מתנתקים וחוזרים.
// מריצים מול wrangler dev:  npm run dev:worker  ואז  node scripts/smoke-online.mjs [http://localhost:5182]
// העברת האירוח ממארח שנעלם, וסגירה של חיבור שהפסיק לשלוח ping, נבדקות רק כש-wrangler dev רץ עם זמנים קצרים,
// והבדיקה מקבלת אותם:
//   wrangler dev --port 5182 --var HOST_AWAY_MS:3000 --var STALE_MS:4000
//   HOST_AWAY_MS=3000 STALE_MS=4000 node scripts/smoke-online.mjs
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const BASE = process.argv[2] ?? 'http://localhost:5182';
const VERSION = 9;
const HOST_AWAY_MS = Number(process.env.HOST_AWAY_MS) || 0;
const STALE_MS = Number(process.env.STALE_MS) || 0;

/**
 * טלפון אחד: WebSocket שאוסף את ההודעות.
 * כשהשרת סוגר חיבורים שקטים אחרי זמן קצר, הטלפון שולח ping כמו טלפון אמיתי, אלא אם silent
 */
async function phone(code, { silent = false } = {}) {
  const ws = new WebSocket(`${BASE.replace(/^http/, 'ws')}/api/rooms/${code}/ws`);
  const messages = [];
  const waiters = [];
  ws.addEventListener('message', (event) => {
    if (event.data === 'pong') return messages.push({ type: 'pong' });
    messages.push(JSON.parse(event.data));
    for (const waiter of waiters.splice(0)) waiter();
  });
  const closed = new Promise((resolve) => ws.addEventListener('close', (event) => resolve(event)));
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  if (STALE_MS && !silent) {
    const pinger = setInterval(() => ws.readyState === WebSocket.OPEN && ws.send('ping'), STALE_MS / 4);
    closed.then(() => clearInterval(pinger));
  }

  /** מחכה להודעה שמתאימה, כולל כאלה שכבר הגיעו */
  async function next(match, timeout = 3000) {
    const deadline = Date.now() + timeout;
    for (;;) {
      const index = messages.findIndex(match);
      if (index >= 0) return messages.splice(index, 1)[0];
      if (Date.now() > deadline) throw new Error(`timeout. got: ${JSON.stringify(messages)}`);
      await new Promise((resolve) => {
        waiters.push(resolve);
        setTimeout(resolve, 100);
      });
    }
  }
  /** המצב האחרון שהגיע אחרי ש-match מתקיים עליו */
  const stateWhere = (check, timeout) => next((m) => m.type === 'state' && check(m.state), timeout).then((m) => m.state);
  const send = (message) => ws.send(typeof message === 'string' ? message : JSON.stringify(message));
  return { ws, next, stateWhere, send, closed, close: () => ws.close() };
}

async function main() {
  // פתיחת חדר
  const old = await fetch(`${BASE}/api/rooms`, { method: 'POST', body: JSON.stringify({ version: 0 }) });
  assert.equal(old.status, 409, 'old version is rejected');
  const created = await fetch(`${BASE}/api/rooms`, { method: 'POST', body: JSON.stringify({ version: VERSION }) });
  assert.equal(created.status, 200);
  const { code } = await created.json();
  assert.match(code, /^\d{6}$/);
  console.log('room', code);

  // חדר שלא קיים
  const ghost = await phone(code === '000000' ? '000001' : '000000');
  ghost.send({ type: 'room:join', name: 'רוח', token: randomUUID(), version: VERSION });
  assert.equal((await ghost.next((m) => m.type === 'error')).code, 'room_not_found');
  assert.equal((await ghost.closed).code, 4000);

  // שלושה שחקנים מצטרפים. הראשון הוא המארח
  const tokens = { dana: randomUUID(), yossi: randomUUID(), roni: randomUUID() };
  let dana = await phone(code);
  dana.send({ type: 'room:join', name: 'דנה', token: tokens.dana, version: VERSION });
  await dana.next((m) => m.type === 'welcome');
  const first = await dana.stateWhere((s) => s.players.length === 1);
  assert.equal(first.hostId, first.you);

  const yossi = await phone(code);
  yossi.send({ type: 'room:join', name: 'יוסי', token: tokens.yossi, version: VERSION });
  await yossi.next((m) => m.type === 'welcome');

  const taken = await phone(code);
  taken.send({ type: 'room:join', name: ' דנה ', token: randomUUID(), version: VERSION });
  assert.equal((await taken.next((m) => m.type === 'error')).code, 'name_taken');
  taken.close();

  const roni = await phone(code);
  roni.send({ type: 'room:join', name: 'רוני', token: tokens.roni, version: VERSION });
  await roni.next((m) => m.type === 'welcome');

  const lobby = await dana.stateWhere((s) => s.players.length === 3 && s.players.every((p) => p.connected));
  assert.deepEqual(lobby.players.map((p) => p.name), ['דנה', 'יוסי', 'רוני']);
  assert.ok(!JSON.stringify(lobby).includes(tokens.yossi), 'no tokens in state');
  console.log('3 players in lobby');

  // ping/pong אוטומטי
  yossi.send('ping');
  await yossi.next((m) => m.type === 'pong');

  // רק המארח משנה סדר
  yossi.send({ type: 'lobby:reorder', playerIds: ['p3', 'p2', 'p1'] });
  assert.equal((await yossi.next((m) => m.type === 'error')).code, 'not_host');
  dana.send({ type: 'lobby:reorder', playerIds: ['p3', 'p1', 'p2'] });
  await roni.stateWhere((s) => s.players.map((p) => p.name).join() === 'רוני,דנה,יוסי');
  console.log('reorder ok');

  // יוסי מתנתק ומסומן כמנותק, ואז חוזר עם הטוקן
  yossi.close();
  await dana.stateWhere((s) => s.players.find((p) => p.name === 'יוסי')?.connected === false);
  let yossi2 = await phone(code);
  yossi2.send({ type: 'room:rejoin', token: tokens.yossi, version: VERSION });
  const back = await yossi2.stateWhere(() => true);
  assert.equal(back.players.find((p) => p.id === back.you).name, 'יוסי');
  await dana.stateWhere((s) => s.players.every((p) => p.connected));
  console.log('rejoin ok');

  // יוסי עובר ללשונית אחרת: כולם רואים שהוא לא במסך, ואז שחזר
  yossi2.send({ type: 'presence', away: true });
  await dana.stateWhere((s) => s.players.find((p) => p.name === 'יוסי')?.away === true);
  yossi2.send({ type: 'presence', away: false });
  await dana.stateWhere((s) => s.players.every((p) => p.connected && !p.away));
  console.log('presence ok');

  // המארחת סוגרת את הדפדפן ונכנסת מדפדפן אחר (בלי הטוקן): חוזרת למקום שלה, ועדיין מארחת
  dana.close();
  await roni.stateWhere((s) => s.players.find((p) => p.name === 'דנה')?.connected === false);
  const danaToken = randomUUID();
  const dana2 = await phone(code);
  dana2.send({ type: 'room:join', name: 'דנה', token: danaToken, version: VERSION });
  const offer = await dana2.next((m) => m.type === 'claimable');
  assert.deepEqual(offer, { type: 'claimable', name: 'דנה', approval: false }, 'lobby + disconnected: no approval');
  dana2.send({ type: 'room:claim', name: 'דנה', token: danaToken, version: VERSION });
  await dana2.next((m) => m.type === 'welcome');
  const reclaimed = await dana2.stateWhere(() => true);
  assert.equal(reclaimed.you, 'p1');
  assert.equal(reclaimed.hostId, 'p1', 'still the host');
  assert.equal(reclaimed.players.length, 3, 'no extra seat');
  const oldDana = await phone(code);
  oldDana.send({ type: 'room:rejoin', token: tokens.dana, version: VERSION });
  assert.equal((await oldDana.next((m) => m.type === 'error')).code, 'bad_token', 'the old token is gone');
  oldDana.close();
  dana = dana2;
  console.log('claim a disconnected seat ok');

  // הדף של יוסי מוסתר (אולי הדפדפן נסגר והחיבור עוד לא נפל): צריך אישור. רוני דוחה
  yossi2.send({ type: 'presence', away: true });
  await dana.stateWhere((s) => s.players.find((p) => p.name === 'יוסי')?.away === true);
  const yossiToken = randomUUID();
  const fake = await phone(code);
  fake.send({ type: 'room:join', name: 'יוסי', token: randomUUID(), version: VERSION });
  assert.equal((await fake.next((m) => m.type === 'claimable')).approval, true);
  fake.send({ type: 'room:claim', name: 'יוסי', token: randomUUID(), version: VERSION });
  await fake.next((m) => m.type === 'claim:waiting');
  const asked = await roni.stateWhere((s) => s.claims?.length === 1);
  assert.equal(asked.claims[0].playerId, 'p2');
  await yossi2.stateWhere((s) => s.players.find((p) => p.id === s.you).away === true);
  roni.send({ type: 'claim:answer', claimId: asked.claims[0].id, approve: false });
  assert.equal((await fake.next((m) => m.type === 'error')).code, 'claim_rejected');
  await fake.closed;
  await dana.stateWhere((s) => !s.claims);
  assert.equal(yossi2.ws.readyState, WebSocket.OPEN, 'the real yossi is still in');

  // והפעם דנה מאשרת: הטלפון החדש לוקח את המקום, והישן מוחלף
  const yossi3 = await phone(code);
  yossi3.send({ type: 'room:join', name: 'יוסי', token: yossiToken, version: VERSION });
  await yossi3.next((m) => m.type === 'claimable');
  yossi3.send({ type: 'room:claim', name: 'יוסי', token: yossiToken, version: VERSION });
  await yossi3.next((m) => m.type === 'claim:waiting');
  const askedAgain = await dana.stateWhere((s) => s.claims?.length === 1 && s.claims[0].id !== asked.claims[0].id);
  dana.send({ type: 'claim:answer', claimId: askedAgain.claims[0].id, approve: true });
  await yossi3.next((m) => m.type === 'welcome');
  assert.equal((await yossi3.stateWhere(() => true)).you, 'p2');
  assert.equal((await yossi2.closed).reason, 'replaced');
  await roni.stateWhere((s) => !s.claims && s.players.every((p) => p.connected && !p.away));
  yossi2 = yossi3;
  console.log('claim with approval ok');

  // סבב: כל טלפון מקבל רק את התפקיד שלו. מתחזה אחד, ולכל השאר אותה מילה
  yossi2.send({ type: 'game:start' });
  assert.equal((await yossi2.next((m) => m.type === 'error')).code, 'not_host');
  dana.send({ type: 'game:start' });
  const phones = { dana, yossi: yossi2, roni };
  const roles = [];
  for (const p of Object.values(phones)) {
    const s = await p.stateWhere((s) => s.phase === 'reveal');
    assert.equal(s.round.reveal, undefined, 'nothing is revealed before the end');
    assert.ok(!JSON.stringify(s).includes('imposterIds'));
    roles.push(s.round.role);
  }
  assert.equal(roles.filter((r) => r.kind === 'imposter').length, 1);
  const words = new Set(roles.filter((r) => r.kind === 'crew').map((r) => r.word));
  assert.equal(words.size, 1);
  for (const p of Object.values(phones)) p.send({ type: 'role:seen' });
  await roni.stateWhere((s) => s.phase === 'play');
  dana.send({ type: 'round:end' });
  const end = await roni.stateWhere((s) => s.phase === 'roundEnd');
  assert.ok(words.has(end.round.reveal.word));
  assert.equal(end.round.reveal.imposters.length, 1);
  dana.send({ type: 'round:lobby' });
  await yossi2.stateWhere((s) => s.phase === 'lobby' && !s.round);
  console.log('round ok');

  // סבב עד ניצחון, עם שחקנית רביעית: הדחה של שחקן רגיל, הדחה של המתחזה, ניחוש אחרון שגוי, ניקוד
  const michal = await phone(code);
  michal.send({ type: 'room:join', name: 'מיכל', token: randomUUID(), version: VERSION });
  await michal.next((m) => m.type === 'welcome');
  dana.send({ type: 'game:start' });
  const four = [dana, yossi2, roni, michal];
  const seats = [];
  for (const p of four) {
    const s = await p.stateWhere((s) => s.phase === 'reveal' && s.round?.number === 2);
    seats.push({ p, id: s.you, role: s.round.role });
  }
  for (const { p } of seats) p.send({ type: 'role:seen' });
  // כל טלפון מחכה למצב "play" של הסבב הזה, ולא למצב שנשאר בתור מהסבב הקודם
  const plays = [];
  for (const { p } of seats) plays.push(await p.stateWhere((s) => s.phase === 'play' && s.round?.number === 2));

  // שינוי סדר באמצע סבב: המעגל מתעדכן, ומי שהתחיל נשאר אותו שחקן
  const before = plays[0];
  const reversed = before.players.map((pl) => pl.id).reverse();
  dana.send({ type: 'lobby:reorder', playerIds: reversed });
  const reordered = await michal.stateWhere((s) => s.round?.players.map((pl) => pl.id).join() === reversed.join());
  assert.equal(reordered.round.starterId, before.round.starterId);
  console.log('mid-round reorder ok');
  const imposter = seats.find((s) => s.role.kind === 'imposter');
  const crewSeats = seats.filter((s) => s.role.kind === 'crew');

  // שחקן רגיל מודח: כולם בעד
  const [opener, victim, third] = crewSeats;
  opener.p.send({ type: 'vote:start', targetId: victim.id });
  await victim.p.stateWhere((s) => s.round?.vote?.targetId === victim.id);
  for (const s of [third, imposter]) s.p.send({ type: 'vote:cast', yes: true });
  const out = await opener.p.stateWhere((s) => s.round?.revealed?.playerId === victim.id);
  assert.equal(out.round.revealed.imposter, false);
  assert.equal(out.round.lastVote.eliminated, true);
  third.p.send({ type: 'reveal:continue' });
  await opener.p.stateWhere((s) => s.round?.lastVote && !s.round.revealed);

  // המתחזה מודח, מנחש, ושחקן רגיל מסמן "שגוי"
  opener.p.send({ type: 'vote:start', targetId: imposter.id });
  await third.p.stateWhere((s) => s.round?.vote?.targetId === imposter.id);
  third.p.send({ type: 'vote:cast', yes: true });
  const caught = await third.p.stateWhere((s) => s.round?.guessPending);
  assert.equal(caught.round.revealed.imposter, true);
  victim.p.send({ type: 'guess:mark', correct: false });
  const won = await imposter.p.stateWhere((s) => s.phase === 'roundEnd' && s.round?.number === 2);
  assert.equal(won.round.reveal.winner, 'crew');
  assert.equal(won.round.reveal.winReason, 'allCaught');
  // ניקוד לפי ההצבעות: opener פתח על victim בטעות (-1) ואחר כך על המתחזה בצדק (+2). third בעד בשתיהן (-1, +1)
  assert.equal(won.scores[opener.id], 1, 'opener: -1 then +2');
  assert.equal(won.scores[third.id], 0, 'third: -1 then +1');
  assert.equal(won.scores[victim.id] ?? 0, 0);
  assert.equal(won.scores[imposter.id] ?? 0, 0);
  assert.equal(won.round.reveal.scoring.votes.length, 2);
  dana.send({ type: 'round:lobby' });
  michal.send({ type: 'room:leave' });
  await dana.stateWhere((s) => s.phase === 'lobby' && s.players.length === 3);
  console.log('vote, last guess and scores ok');

  // join חוזר עם אותו טוקן (התשובה הקודמת לא הגיעה) לא יוצר שחקן כפול
  const roni2 = await phone(code);
  roni2.send({ type: 'room:join', name: 'רוני', token: tokens.roni, version: VERSION });
  await roni2.next((m) => m.type === 'welcome');
  assert.equal((await roni.closed).reason, 'replaced', 'the older connection of the same player is replaced');
  assert.equal((await roni2.stateWhere(() => true)).players.length, 3);
  console.log('idempotent join ok');

  // המארח מוציא את רוני
  dana.send({ type: 'lobby:kick', playerId: 'p3' });
  assert.equal((await roni2.next((m) => m.type === 'left')).reason, 'kicked');
  assert.equal((await roni2.closed).code, 4000);
  await dana.stateWhere((s) => s.players.length === 2);
  const roni3 = await phone(code);
  roni3.send({ type: 'room:rejoin', token: tokens.roni, version: VERSION });
  assert.equal((await roni3.next((m) => m.type === 'error')).code, 'bad_token');
  roni3.close();
  console.log('kick ok');

  // העברת אירוח ידנית, ובחזרה
  dana.send({ type: 'host:transfer', playerId: 'p2' });
  await yossi2.stateWhere((s) => s.hostId === 'p2');
  yossi2.send({ type: 'host:transfer', playerId: 'p1' });
  await dana.stateWhere((s) => s.hostId === 'p1');
  console.log('host transfer ok');

  // המארח יוצא, והאירוח עובר ליוסי
  dana.send({ type: 'room:leave' });
  assert.equal((await dana.next((m) => m.type === 'left')).reason, 'left');
  const after = await yossi2.stateWhere((s) => s.players.length === 1);
  assert.equal(after.hostId, after.you);
  console.log('host leaves ok');

  if (STALE_MS) {
    // טלפון שהחיבור שלו מת בשקט (לא שולח ping ולא סוגר): השרת סוגר אותו ומסמן אותו כמנותק
    const quiet = await phone(code, { silent: true });
    quiet.send({ type: 'room:join', name: 'שקט', token: randomUUID(), version: VERSION });
    const { you: quietId } = await quiet.stateWhere((s) => s.players.length === 2);
    await yossi2.stateWhere((s) => s.players.find((p) => p.id === quietId)?.connected === true);
    await yossi2.stateWhere((s) => s.players.find((p) => p.id === quietId)?.connected === false, STALE_MS * 2 + 5000);
    assert.equal((await quiet.closed).code, 4001);
    // מי ששולח ping נשאר מחובר
    assert.equal(yossi2.ws.readyState, WebSocket.OPEN);
    yossi2.send({ type: 'lobby:kick', playerId: quietId });
    await yossi2.stateWhere((s) => s.players.length === 1);
    console.log('stale connection ok');
  } else {
    console.log('(stale connection skipped: run wrangler dev with --var STALE_MS:4000 and set STALE_MS=4000)');
  }

  // המארח (יוסי) נעלם בלי לצאת: כולם רואים ספירה לאחור, ולמי האירוח יעבור
  const omer = await phone(code);
  omer.send({ type: 'room:join', name: 'עומר', token: randomUUID(), version: VERSION });
  const joined = await omer.stateWhere((s) => s.players.length === 2);
  yossi2.close();
  const counting = await omer.stateWhere((s) => !!s.hostGone);
  assert.equal(counting.hostGone.nextHostId, joined.you);
  assert.ok(counting.hostGone.takeoverIn > 0, 'no takeover right away');

  if (HOST_AWAY_MS) {
    // אחרי זמן קצר אפשר לקחת את האירוח בלי לחכות לסוף הספירה
    await new Promise((resolve) => setTimeout(resolve, counting.hostGone.takeoverIn + 100));
    omer.send({ type: 'host:takeover' });
    await omer.stateWhere((s) => s.hostId === s.you && !s.hostGone);
    console.log('host takeover ok');

    // ובלי שאף אחד לוחץ: אחרי הזמן הקצוב האירוח עובר לשחקן המחובר
    const noa = await phone(code);
    noa.send({ type: 'room:join', name: 'נועה', token: randomUUID(), version: VERSION });
    const noaJoined = await noa.stateWhere((s) => s.players.length === 3);
    omer.close();
    const moved = await noa.stateWhere((s) => s.hostId === noaJoined.you, HOST_AWAY_MS + 5000);
    assert.equal(moved.hostGone, undefined);
    noa.close();
    console.log('host timeout ok');
  } else {
    assert.ok(counting.hostGone.handoverIn > 60_000);
    omer.send({ type: 'host:takeover' });
    assert.equal((await omer.next((m) => m.type === 'error')).code, 'not_allowed');
    omer.close();
    console.log('host countdown ok');
    console.log('(host takeover and timeout skipped: run wrangler dev with --var HOST_AWAY_MS:3000 and set HOST_AWAY_MS=3000)');
  }
  console.log('\nall good');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
