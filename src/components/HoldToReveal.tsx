import { useEffect, useRef, useState, type ReactNode } from 'react';
import { he } from '../i18n/he';
import { vibrate } from '../ui/vibrate';

interface Props {
  /** התוכן הסודי, שמוצג רק כל עוד מחזיקים */
  children: ReactNode;
  onFirstReveal: () => void;
}

/**
 * לחיצה ארוכה מציגה, שחרור מסתיר.
 * מתנהג זהה למתחזה ולשחקן רגיל: אותו רטט, אותו גודל, אותו מסך מכוסה.
 */
export default function HoldToReveal({ children, onFirstReveal }: Props) {
  const [held, setHeld] = useState(false);
  const seen = useRef(false);

  const show = () => {
    setHeld(true);
    vibrate(30);
    if (!seen.current) {
      seen.current = true;
      onFirstReveal();
    }
  };
  const hide = () => setHeld(false);

  // אם הטלפון ננעל או שעוברים לאפליקציה אחרת באמצע, מסתירים
  useEffect(() => {
    const onHidden = () => document.visibilityState === 'hidden' && setHeld(false);
    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener('blur', hide);
    return () => {
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('blur', hide);
    };
  }, []);

  return (
    <div
      className={`hold-card${held ? ' held' : ''}`}
      role="button"
      tabIndex={0}
      aria-pressed={held}
      aria-label={he.reveal.holdHint}
      onPointerDown={(e) => {
        e.preventDefault();
        show();
      }}
      onPointerUp={hide}
      onPointerCancel={hide}
      onPointerLeave={hide}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
          e.preventDefault();
          show();
        }
      }}
      onKeyUp={hide}
      onBlur={hide}
    >
      {held ? (
        <div className="hold-content">{children}</div>
      ) : (
        <div className="hold-cover">
          <svg className="eye-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
          </svg>
          <p className="hold-title">{he.reveal.holdHint}</p>
          <p className="hold-sub">{he.reveal.releaseHint}</p>
        </div>
      )}
    </div>
  );
}
