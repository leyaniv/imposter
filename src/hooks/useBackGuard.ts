import { useEffect, useRef } from 'react';

const GUARD = { imposterGuard: true };

function isGuardEntry(state: unknown): boolean {
  return typeof state === 'object' && state !== null && 'imposterGuard' in state;
}

/** כל מי שמחכה ל"חזרה" עכשיו. רק האחרון מקבל אותה, כך שחלון פתוח (למשל הגדרות) נסגר במקום שהמסך שמתחתיו יגיב */
const handlers: { current: () => void }[] = [];

function onPopState() {
  const top = handlers.at(-1);
  if (!top) return;
  history.pushState(GUARD, '');
  top.current();
}

/**
 * כפתור "חזרה" של הדפדפן/הטלפון לא עוזב את האפליקציה בזמן משחק.
 * במקום זה נקרא onBack, וההחלטה מה לעשות (לחזור מסך, לשאול) היא של מי שקורא.
 */
export function useBackGuard(active: boolean, onBack: () => void) {
  const onBackRef = useRef(onBack);

  useEffect(() => {
    onBackRef.current = onBack;
  });

  useEffect(() => {
    if (!active) return;
    if (!isGuardEntry(history.state)) history.pushState(GUARD, '');
    if (handlers.length === 0) window.addEventListener('popstate', onPopState);
    handlers.push(onBackRef);
    return () => {
      handlers.splice(handlers.indexOf(onBackRef), 1);
      if (handlers.length === 0) window.removeEventListener('popstate', onPopState);
    };
  }, [active]);
}
