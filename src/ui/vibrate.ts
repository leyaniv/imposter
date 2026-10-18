/** רטט קצר, אם המכשיר תומך (באייפון אין תמיכה, ואז פשוט לא קורה כלום) */
export function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // לא קריטי
  }
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}
