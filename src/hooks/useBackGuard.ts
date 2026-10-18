import { useEffect, useRef } from 'react';

const GUARD = { imposterGuard: true };

function isGuardEntry(state: unknown): boolean {
  return typeof state === 'object' && state !== null && 'imposterGuard' in state;
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

    const onPopState = () => {
      history.pushState(GUARD, '');
      onBackRef.current();
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [active]);
}
