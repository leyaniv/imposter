import { useState } from 'react';
import { he } from '../i18n/he';

export type GameMode = 'local' | 'online';

interface Props {
  mode: GameMode;
  onChange: (mode: GameMode) => void;
}

/** בחירה בין "טלפון משותף" (local) ל"טלפון לכל שחקן" (online), עם הסבר שנפתח בלחיצה על סימן השאלה */
export default function ModeToggle({ mode, onChange }: Props) {
  const [help, setHelp] = useState(false);

  return (
    <div className="field">
      <div className="mode-row">
        <div className="segmented mode-toggle" role="radiogroup" aria-label={he.newGame.modeLabel}>
          {(['local', 'online'] as const).map((option) => (
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
        <button
          className="icon-btn help-btn"
          aria-label={he.newGame.help}
          aria-expanded={help}
          onClick={() => setHelp(!help)}
        >
          ?
        </button>
      </div>
      {help && (
        <div className="notice mode-help" role="note">
          <p>{he.newGame.helpLocal}</p>
          <p>{he.newGame.helpOnline}</p>
        </div>
      )}
    </div>
  );
}
