import { useEffect, useState } from 'react';

/** פחות מזה זה לא מקלדת, אלא שורת הכתובת של הדפדפן שנפתחת ונסגרת */
const MIN_KEYBOARD = 80;

/**
 * כמה מהתחתית של העמוד מכוסה (בפיקסלים), לפי החלק הנראה של המסך.
 * בטלפונים המקלדת בדרך כלל לא מקטינה את העמוד אלא מכסה את התחתית שלו,
 * ואז רק visualViewport יודע כמה באמת נראה.
 */
export function keyboardInset(innerHeight: number, visibleHeight: number, visibleTop: number): number {
  const covered = Math.round(innerHeight - visibleHeight - visibleTop);
  return covered >= MIN_KEYBOARD ? covered : 0;
}

/** גובה המקלדת כשהיא פתוחה, 0 כשהיא סגורה (או כשהדפדפן כבר מקטין את העמוד בעצמו) */
export function useKeyboardInset(enabled = true): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!enabled || !viewport) return;
    const update = () => setInset(keyboardInset(window.innerHeight, viewport.height, viewport.offsetTop));
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
      setInset(0);
    };
  }, [enabled]);

  return inset;
}
