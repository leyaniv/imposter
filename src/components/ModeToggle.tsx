import { he } from '../i18n/he';
import HelpRow from './HelpRow';

export type GameMode = 'local' | 'online';

interface Props {
  mode: GameMode;
  onChange: (mode: GameMode) => void;
}

/** בחירה בין "טלפון משותף" (local) ל"טלפון לכל שחקן" (online), עם הסבר שנפתח בלחיצה על סימן השאלה */
export default function ModeToggle({ mode, onChange }: Props) {
  return (
    <HelpRow
      label={he.newGame.help}
      help={
        <>
          <p>{he.newGame.helpOnline}</p>
          <p>{he.newGame.helpLocal}</p>
        </>
      }
    >
      <div className="segmented mode-toggle" role="radiogroup" aria-label={he.newGame.modeLabel}>
        {(['online', 'local'] as const).map((option) => (
          <button
            key={option}
            role="radio"
            aria-checked={mode === option}
            className={`segment${mode === option ? ' segment-on' : ''}`}
            onClick={() => onChange(option)}
          >
            {he.newGame[option]}
          </button>
        ))}
      </div>
    </HelpRow>
  );
}
