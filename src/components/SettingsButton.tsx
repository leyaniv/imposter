import { he } from '../i18n/he';
import { useOpenSettings, type SettingsFrom } from './SettingsProvider';

/** גלגל שיניים שפותח את חלון ההגדרות. במסך הפתיחה עם המילה "הגדרות", בפס העליון של המשחק רק הסמל */
export default function SettingsButton({ from }: { from: SettingsFrom }) {
  const openSettings = useOpenSettings();
  if (!openSettings) return null;

  const icon = (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 2.8v3.4M12 17.8v3.4M2.8 12h3.4M17.8 12h3.4M5.5 5.5l2.4 2.4M16.1 16.1l2.4 2.4M5.5 18.5l2.4-2.4M16.1 7.9l2.4-2.4"
        stroke="currentColor"
        strokeWidth="3"
      />
      <circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="2" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );

  if (from === 'home') {
    return (
      <button className="btn btn-ghost btn-icon about-btn" onClick={() => openSettings(from)}>
        {icon}
        {he.settings.open}
      </button>
    );
  }
  return (
    <button className="icon-btn" aria-label={he.settings.open} onClick={() => openSettings(from)}>
      {icon}
    </button>
  );
}
