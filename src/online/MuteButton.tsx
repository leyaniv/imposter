import { useState } from 'react';
import { he } from '../i18n/he';
import { isMuted, setMuted } from '../ui/sound';

/** השתקה של הצלילים בטלפון הזה בלבד */
export default function MuteButton() {
  const [muted, setMutedState] = useState(isMuted);
  const toggle = () => {
    setMuted(!muted);
    setMutedState(!muted);
  };

  return (
    <button className="icon-btn" aria-label={muted ? he.online.sound.unmute : he.online.sound.mute} aria-pressed={muted} onClick={toggle}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
        {muted ? (
          <path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        ) : (
          <path d="M16 8.5a5 5 0 010 7M18.5 6a8.5 8.5 0 010 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        )}
      </svg>
    </button>
  );
}
