import { useState, type ReactNode } from 'react';

interface Props {
  /** לקורא מסך, למשל "הסבר על הצבעה חשאית" */
  label: string;
  /** ההסבר שנפתח מתחת לשורה */
  help: ReactNode;
  /** הבורר או המתג. מקבל את כל הרוחב שנשאר */
  children: ReactNode;
}

/** בורר או מתג עם סימן שאלה בצד, שפותח הסבר בכרטיס מתחת לשורה. אותו דבר בכל מסך "משחק חדש" */
export default function HelpRow({ label, help, children }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="field">
      <div className="help-row">
        {children}
        <button type="button" className="icon-btn help-btn" aria-label={label} aria-expanded={open} onClick={() => setOpen(!open)}>
          ?
        </button>
      </div>
      {open && (
        <div className="notice help-card" role="note">
          {help}
        </div>
      )}
    </div>
  );
}
