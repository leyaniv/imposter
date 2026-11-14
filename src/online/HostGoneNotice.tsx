import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { he } from '../i18n/he';
import type { RoomState } from './protocol';

/** החדר ו"אני אארח", לכל מסכי החדר בלי להעביר אותם דרך כל מסך */
export const HostGoneContext = createContext<{ state: RoomState; onTakeover: () => void } | null>(null);

/** "1:05" */
function formatTime(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * המארח לא מחובר: ספירה לאחור עד שהאירוח עובר, ולמי. אחרי זמן קצר כל אחד יכול ללחוץ "אני אארח" בלי לחכות.
 * השרת שולח כמה זמן נשאר, והספירה רצה לפי השעון של הטלפון מהרגע שהמצב הגיע
 */
export default function HostGoneNotice() {
  const room = useContext(HostGoneContext);
  const gone = room?.state.hostGone;
  const deadlines = useMemo(() => {
    const now = Date.now();
    return gone && { handover: now + gone.handoverIn, takeover: now + gone.takeoverIn };
  }, [gone]);
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    if (!deadlines) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [deadlines]);

  if (!room || !gone || !deadlines || room.state.hostId === room.state.you) return null;
  const { state, onTakeover } = room;
  const left = deadlines.handover - now;
  // המספרים בתוך משפט בעברית מבודדים כטקסט משמאל לימין, אחרת "1:05" מתהפך
  const time = `⁦${formatTime(Math.max(0, left))}⁩`;
  const next = state.players.find((player) => player.id === gone.nextHostId);
  const text = !next
    ? he.online.hostGone.waiting
    : left <= 0
      ? he.online.hostGone.soon
      : next.id === state.you
        ? he.online.hostGone.toYou(time)
        : he.online.hostGone.toPlayer(next.name, time);

  return (
    <div className="notice host-gone-notice" role="status">
      <p>
        {he.online.hostGone.title} {text}
      </p>
      {now >= deadlines.takeover && (
        <button className="btn btn-tinted" onClick={onTakeover}>
          {he.online.hostGone.takeover}
        </button>
      )}
    </div>
  );
}
