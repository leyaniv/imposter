import { getPreferences } from './preferences';

/** יש רטט במכשיר הזה (באייפון אין) */
export function canVibrate(): boolean {
  return typeof navigator !== 'undefined' && 'vibrate' in navigator;
}

/** רטט קצר, אם המכשיר תומך ואם לא כיבו אותו בהגדרות */
export function vibrate(pattern: number | number[]) {
  if (!getPreferences().vibration) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // לא קריטי
  }
}

/** פחות אנימציות: לפי ההגדרה במשחק, או לפי "הפחתת תנועה" בטלפון */
export function prefersReducedMotion(): boolean {
  if (getPreferences().reduceMotion) return true;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}
