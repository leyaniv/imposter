import { useEffect, useId, useRef, useState } from 'react';

interface Props {
  /** לקורא מסך, למשל "הסבר על צלילים" */
  label: string;
  text: string;
}

/**
 * סימן שאלה קטן שפותח הסבר בבועה. בטלפון אין ריחוף, אז נפתח ונסגר בלחיצה.
 * נסגר בלחיצה במקום אחר או ב-Escape (ורק הבועה נסגרת, לא החלון שהיא בתוכו).
 */
export default function HelpTip({ label, text }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    // בשלב ה-capture, כדי לקדים את ה-Escape של החלון
    window.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  return (
    <span className="help-tip" ref={ref}>
      <button
        type="button"
        className="help-tip-btn"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen(!open)}
      >
        ?
      </button>
      {open && (
        <span id={id} role="tooltip" className="help-tip-bubble">
          {text}
        </span>
      )}
    </span>
  );
}
