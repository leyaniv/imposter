/**
 * העדפות של הטלפון הזה: ערכת צבעים, צלילים, רטט, גודל טקסט ואנימציות.
 * נשמרות בטלפון בלבד, לא חלק ממצב המשחק ולא נשלחות לחדר.
 * index.html קורא את ערכת הצבעים וגודל הטקסט לפני שהמשחק נטען, כדי שלא יהבהב מסך כהה. שינוי כאן צריך להתאים גם שם.
 */

export type Theme = 'dark' | 'light' | 'system';
export type TextSize = 'normal' | 'large';

export interface Preferences {
  theme: Theme;
  sound: boolean;
  vibration: boolean;
  textSize: TextSize;
  /** פחות אנימציות, גם אם בטלפון לא הוגדר "הפחתת תנועה" */
  reduceMotion: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
  theme: 'dark',
  sound: true,
  vibration: true,
  textSize: 'normal',
  reduceMotion: false,
};

const KEY = 'imposter:preferences';
/** לפני מסך ההגדרות היה רק כפתור השתקה בחדר, וזה המפתח שלו */
const OLD_MUTE_KEY = 'imposter:muted';

const THEMES: Theme[] = ['dark', 'light', 'system'];
const TEXT_SIZES: TextSize[] = ['normal', 'large'];
const THEME_COLORS = { dark: '#13111c', light: '#f7f4fb' };

/** מה שנשמר, אחרי בדיקה. ערך חסר או שבור חוזר לברירת המחדל */
export function parsePreferences(saved: unknown, oldMuted = false): Preferences {
  const data = typeof saved === 'object' && saved !== null ? (saved as Record<string, unknown>) : {};
  const pick = <T>(value: unknown, allowed: readonly T[], fallback: T) => (allowed.includes(value as T) ? (value as T) : fallback);
  const flag = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback);
  return {
    theme: pick(data.theme, THEMES, DEFAULT_PREFERENCES.theme),
    sound: flag(data.sound, !oldMuted),
    vibration: flag(data.vibration, DEFAULT_PREFERENCES.vibration),
    textSize: pick(data.textSize, TEXT_SIZES, DEFAULT_PREFERENCES.textSize),
    reduceMotion: flag(data.reduceMotion, DEFAULT_PREFERENCES.reduceMotion),
  };
}

function load(): Preferences {
  try {
    const saved = localStorage.getItem(KEY);
    return parsePreferences(saved ? JSON.parse(saved) : null, localStorage.getItem(OLD_MUTE_KEY) === '1');
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

let current = load();
const listeners = new Set<() => void>();

export function getPreferences(): Preferences {
  return current;
}

export function setPreference<K extends keyof Preferences>(key: K, value: Preferences[K]) {
  current = { ...current, [key]: value };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
    localStorage.removeItem(OLD_MUTE_KEY);
  } catch {
    // לא נשמר, אבל עובד עד הריענון
  }
  applyPreferences();
  for (const listener of listeners) listener();
}

export function subscribePreferences(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const lightQuery = () => window.matchMedia?.('(prefers-color-scheme: light)');

/** "לפי הטלפון" הופך לכהה או בהיר */
function resolvedTheme(theme: Theme): 'dark' | 'light' {
  return theme === 'system' ? (lightQuery()?.matches ? 'light' : 'dark') : theme;
}

/** מחיל על הדף: ערכת צבעים, צבע שורת המצב, גודל טקסט ואנימציות (ראו global.css) */
export function applyPreferences() {
  const root = document.documentElement;
  const theme = resolvedTheme(current.theme);
  root.dataset.theme = theme;
  root.toggleAttribute('data-large-text', current.textSize === 'large');
  root.toggleAttribute('data-reduce-motion', current.reduceMotion);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
}

/** נקרא פעם אחת בפתיחה. "לפי הטלפון" מתעדכן גם כשהטלפון עובר בין כהה לבהיר */
export function initPreferences() {
  applyPreferences();
  lightQuery()?.addEventListener('change', () => current.theme === 'system' && applyPreferences());
}
