import { useEffect, useRef } from 'react';
import { track } from '../analytics/posthog';
import { usePreferences } from '../hooks/usePreferences';
import { he } from '../i18n/he';
import { setPreference, type Preferences, type TextSize, type Theme } from '../ui/preferences';
import { canVibrate } from '../ui/vibrate';
import HelpTip from './HelpTip';

const THEMES: Theme[] = ['dark', 'light', 'system'];
const TEXT_SIZES: TextSize[] = ['normal', 'large'];

function change<K extends keyof Preferences>(key: K, value: Preferences[K]) {
  setPreference(key, value);
  track('setting_change', { setting: key, value });
}

/** חלון ההגדרות של הטלפון הזה. נפתח מעל המסך, ולא נוגע במשחק עצמו */
export default function SettingsSheet({ onClose }: { onClose: () => void }) {
  const prefs = usePreferences();
  const doneRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    doneRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div
        className="dialog settings-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="settings-head">
          <h2 id="settings-title" className="heading">
            {he.settings.title}
          </h2>
          <p className="muted">{he.settings.thisPhone}</p>
        </div>

        <div className="setting-row">
          <label className="setting-label" htmlFor="settings-theme">
            {he.settings.theme}
          </label>
          <span className="select-wrap">
            <select
              id="settings-theme"
              className="select"
              value={prefs.theme}
              onChange={(e) => change('theme', e.target.value as Theme)}
            >
              {THEMES.map((theme) => (
                <option key={theme} value={theme}>
                  {he.settings.themes[theme]}
                </option>
              ))}
            </select>
            <svg className="select-arrow" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>

        <div className="setting-row">
          <span className="setting-label" id="settings-text-size">
            {he.settings.textSize}
          </span>
          <div className="segmented" role="radiogroup" aria-labelledby="settings-text-size">
            {TEXT_SIZES.map((size) => (
              <button
                key={size}
                role="radio"
                aria-checked={prefs.textSize === size}
                className={`segment${prefs.textSize === size ? ' segment-on' : ''}`}
                onClick={() => change('textSize', size)}
              >
                {he.settings.textSizes[size]}
              </button>
            ))}
          </div>
        </div>

        <div className="toggle-row">
          {/* סימן השאלה מחוץ ל-label, כדי שלחיצה עליו לא תסמן את התיבה */}
          <div className="toggle">
            <label className="toggle-label">
              <input type="checkbox" checked={prefs.sound} onChange={(e) => change('sound', e.target.checked)} />
              <span>{he.settings.sound}</span>
            </label>
            <HelpTip label={he.settings.helpLabel(he.settings.sound)} text={he.settings.soundHelp} />
          </div>
          {/* באייפון אין רטט, אז אין מה לכבות */}
          {canVibrate() && (
            <label className="toggle">
              <input type="checkbox" checked={prefs.vibration} onChange={(e) => change('vibration', e.target.checked)} />
              <span>{he.settings.vibration}</span>
            </label>
          )}
        </div>

        <div className="toggle">
          <label className="toggle-label">
            <input type="checkbox" checked={prefs.reduceMotion} onChange={(e) => change('reduceMotion', e.target.checked)} />
            <span>{he.settings.reduceMotion}</span>
          </label>
          <HelpTip label={he.settings.helpLabel(he.settings.reduceMotion)} text={he.settings.reduceMotionHelp} />
        </div>

        <button ref={doneRef} className="btn btn-primary" onClick={onClose}>
          {he.settings.done}
        </button>
      </div>
    </div>
  );
}
