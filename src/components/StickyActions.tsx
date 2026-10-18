import type { ReactNode } from 'react';
import { useContentBelow } from '../hooks/useContentBelow';

/** כפתורים שנשארים בתחתית המסך כשגוללים, עם הפרדה ברורה כשיש תוכן מתחתם */
export default function StickyActions({ children }: { children: ReactNode }) {
  const contentBelow = useContentBelow();
  return <div className={`screen-actions sticky-actions${contentBelow ? ' raised' : ''}`}>{children}</div>;
}
