import { useEffect, useRef } from 'react';

interface Props {
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** צבע כפתור האישור. ברירת מחדל אדום, לפעולה שקשה לבטל. ירוק לאישור של "נכון" */
  tone?: 'danger' | 'success';
}

export default function ConfirmDialog({ message, confirmLabel, cancelLabel, onConfirm, onCancel, tone = 'danger' }: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <div className="dialog" role="alertdialog" aria-modal="true" aria-label={message} onClick={(e) => e.stopPropagation()}>
        <p className="dialog-text">{message}</p>
        <button className={`btn btn-${tone}`} onClick={onConfirm}>
          {confirmLabel}
        </button>
        <button ref={cancelRef} className="btn btn-ghost" onClick={onCancel}>
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}
