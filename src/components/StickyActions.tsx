import type { ReactNode } from 'react';
import { useContentBelow } from '../hooks/useContentBelow';
import { useKeyboardInset } from '../hooks/useKeyboardInset';

interface Props {
  children: ReactNode;
  /** כשהמקלדת פתוחה, הפס עולה ויושב מעליה (למשל "הצטרפות" כשמקלידים קוד) */
  aboveKeyboard?: boolean;
}

/** כפתורים שנשארים בתחתית המסך כשגוללים, עם הפרדה ברורה כשיש תוכן מתחתם */
export default function StickyActions({ children, aboveKeyboard = false }: Props) {
  const contentBelow = useContentBelow();
  const keyboard = useKeyboardInset(aboveKeyboard);
  return (
    <div
      className={`screen-actions sticky-actions${contentBelow ? ' raised' : ''}${keyboard ? ' over-keyboard' : ''}`}
      style={keyboard ? { bottom: keyboard } : undefined}
    >
      {children}
    </div>
  );
}
