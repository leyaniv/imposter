/**
 * צלילים קצרים במצב "כל אחד בטלפון שלו": כשנפתחת הצבעה ובחשיפה של מי שהודח.
 * נוצרים בקוד (Web Audio), בלי קבצי קול. כל טלפון יכול להשתיק לעצמו, וההגדרה נשמרת בו.
 */

const MUTE_KEY = 'imposter:muted';
let context: AudioContext | undefined;

export function isMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setMuted(muted: boolean) {
  try {
    if (muted) localStorage.setItem(MUTE_KEY, '1');
    else localStorage.removeItem(MUTE_KEY);
  } catch {
    // לא נשמר, אבל עובד עד הריענון
  }
}

function audio(): AudioContext | null {
  try {
    context ??= new AudioContext();
    if (context.state === 'suspended') void context.resume();
    return context;
  } catch {
    return null;
  }
}

/**
 * דפדפנים משמיעים צליל רק אחרי שהמשתמש נגע בדף, ובאייפון רק אם ה-AudioContext נוצר בזמן נגיעה.
 * נקרא בנגיעה הראשונה, כדי שהצליל הראשון (שמגיע מהשרת, בלי נגיעה) יישמע.
 */
export function unlockAudio() {
  audio();
}

/** צליל אחד שדועך */
function tone(ctx: AudioContext, frequency: number, start: number, duration: number, type: OscillatorType, volume: number) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, ctx.currentTime + start);
  gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + duration);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(ctx.currentTime + start);
  oscillator.stop(ctx.currentTime + start + duration + 0.05);
}

function play(notes: (ctx: AudioContext) => void) {
  if (isMuted()) return;
  const ctx = audio();
  if (!ctx) return;
  try {
    notes(ctx);
  } catch {
    // צליל לעולם לא שובר את המשחק
  }
}

/** נפתחה הצבעה: "דינג-דונג" קצר ועדין, כי הוא יוצא מכמה טלפונים יחד */
export function playVoteSound() {
  play((ctx) => {
    tone(ctx, 880, 0, 0.35, 'sine', 0.18);
    tone(ctx, 660, 0.18, 0.5, 'sine', 0.18);
  });
}

/** חשיפה של מי שהודח: שני צלילים נמוכים, דרמטיים */
export function playRevealSound() {
  play((ctx) => {
    tone(ctx, 196, 0, 0.3, 'triangle', 0.25);
    tone(ctx, 147, 0.25, 0.7, 'triangle', 0.25);
  });
}
