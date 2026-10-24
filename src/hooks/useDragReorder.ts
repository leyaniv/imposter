import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { movePlayer } from '../game/setup';

interface Drag {
  id: string;
  /** מיקום האצבע כשהשורה הייתה במקומה הנוכחי ברשימה */
  originY: number;
}

/**
 * שינוי סדר של רשימה בגרירה של ידית, או בחיצים למעלה ולמטה מהמקלדת.
 * onChange נקרא בכל החלפת מקום (כדי שהרשימה תזוז מתחת לאצבע).
 * onCommit, אם יש, נקרא פעם אחת כשהגרירה נגמרת והסדר השתנה.
 */
export function useDragReorder<T extends { id: string }>(
  items: T[],
  onChange: (items: T[]) => void,
  onCommit?: (items: T[]) => void,
) {
  const rows = useRef(new Map<string, HTMLElement>());
  const latest = useRef(items);
  const before = useRef(items);
  const drag = useRef<Drag | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    latest.current = items;
  }, [items]);

  /** המרחק בין שורה לשורה (גובה שורה + רווח) */
  const rowStep = (a: string, b: string) => {
    const first = rows.current.get(a);
    const second = rows.current.get(b);
    return first && second ? Math.abs(second.offsetTop - first.offsetTop) : 0;
  };

  const onPointerDown = (e: PointerEvent<HTMLElement>, id: string) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id, originY: e.clientY };
    before.current = latest.current;
    setDragId(id);
    setOffset(0);
  };

  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    const current = drag.current;
    if (!current) return;
    const start = latest.current;
    let list = start;
    let index = list.findIndex((item) => item.id === current.id);
    let dy = e.clientY - current.originY;
    // כל השורות באותו גובה, אז מספיק למדוד מרחק בין שתי שורות פעם אחת
    const neighbor = list[index + 1] ?? list[index - 1];
    const step = neighbor ? rowStep(current.id, neighbor.id) : 0;
    if (!step) return;

    // עברו חצי שורה: מחליפים מקום עם השכן, והשורה ממשיכה לעקוב אחרי האצבע מהמקום החדש
    while (index < list.length - 1 && dy > step / 2) {
      list = movePlayer(list, index, index + 1);
      index++;
      current.originY += step;
      dy -= step;
    }
    while (index > 0 && dy < -step / 2) {
      list = movePlayer(list, index, index - 1);
      index--;
      current.originY -= step;
      dy += step;
    }
    if (list !== start) {
      latest.current = list;
      onChange(list);
    }
    setOffset(dy);
  };

  const endDrag = () => {
    if (drag.current && latest.current !== before.current) onCommit?.(latest.current);
    drag.current = null;
    setDragId(null);
    setOffset(0);
  };

  const onHandleKey = (e: KeyboardEvent<HTMLElement>, index: number) => {
    const to = e.key === 'ArrowUp' ? index - 1 : e.key === 'ArrowDown' ? index + 1 : -1;
    if (to < 0 || to >= items.length) return;
    e.preventDefault();
    const list = movePlayer(items, index, to);
    onChange(list);
    onCommit?.(list);
  };

  /** ref לשורה, כדי למדוד את הגובה שלה */
  const rowRef = (id: string) => (el: HTMLElement | null) => {
    if (el) rows.current.set(id, el);
    else rows.current.delete(id);
  };

  /** האירועים של ידית הגרירה בשורה */
  const handleProps = (id: string, index: number) => ({
    onPointerDown: (e: PointerEvent<HTMLElement>) => onPointerDown(e, id),
    onPointerMove,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => onHandleKey(e, index),
  });

  /** העיצוב של שורה: השורה שנגררת עוקבת אחרי האצבע */
  const rowProps = (id: string) =>
    id === dragId
      ? { className: 'dragging', style: { transform: `translateY(${offset}px)` } }
      : { className: undefined, style: undefined };

  return { rowRef, handleProps, rowProps, dragging: dragId !== null };
}
