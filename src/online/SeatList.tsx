import { useEffect, useRef, useState } from 'react';
import DragHandle from '../components/DragHandle';
import { useDragReorder } from '../hooks/useDragReorder';
import { he } from '../i18n/he';
import type { PublicPlayer } from './protocol';

interface Props {
  /** לפי סדר הישיבה, כמו שהשרת שלח */
  players: PublicPlayer[];
  you: string;
  hostId: string | null;
  /** המארח יכול לגרור (ולא בזמן הצבעה או ניחוש) */
  canReorder: boolean;
  onReorder: (playerIds: string[]) => void;
  /** אצל המארח: כפתור ⋯ ליד כל שחקן אחר (העברת אירוח, הוצאה) */
  onMore?: (player: PublicPlayer) => void;
  /** סימון נוסף ליד שם, למשל "בסבב הבא" */
  note?: (player: PublicPlayer) => string | undefined;
}

/** השחקנים לפי סדר הישיבה, עם גרירה לשינוי הסדר. משותף ללובי ולתפריט המארח */
export default function SeatList({ players: serverOrder, you, hostId, canReorder, onReorder, onMore, note }: Props) {
  // בזמן גרירה הרשימה זזה מיד אצלנו, והשרת מקבל את הסדר החדש בסוף הגרירה
  const [localOrder, setLocalOrder] = useState<PublicPlayer[] | null>(null);
  const players = localOrder ?? serverOrder;
  const { rowRef, handleProps, rowProps, dragging } = useDragReorder(players, setLocalOrder, (list) =>
    onReorder(list.map((player) => player.id)),
  );

  // הגיע מצב חדש מהשרת (הסדר שנשלח, או שינוי של מישהו אחר): מציגים אותו. באמצע גרירה ממשיכים עם הסדר המקומי
  const draggingRef = useRef(dragging);
  draggingRef.current = dragging;
  useEffect(() => {
    if (!draggingRef.current) setLocalOrder(null);
  }, [serverOrder]);

  return (
    <ol className="name-list lobby-list">
      {players.map((player, i) => {
        const extra = note?.(player);
        return (
          <li key={player.id} ref={rowRef(player.id)} {...rowProps(player.id)}>
            {canReorder && <DragHandle label={he.setup.movePlayer(player.name)} {...handleProps(player.id, i)} />}
            <span className="name-index">{i + 1}</span>
            <span className={`lobby-name${player.connected ? '' : ' offline'}`}>{player.name}</span>
            {player.id === you && <span className="badge">{he.online.lobby.you}</span>}
            {player.id === hostId && <span className="badge badge-accent">{he.online.lobby.host}</span>}
            {!player.connected && <span className="badge badge-muted">{he.online.lobby.offline}</span>}
            {extra && <span className="badge badge-muted">{extra}</span>}
            {onMore && player.id !== you && (
              <button className="icon-btn" aria-label={he.online.host.more(player.name)} onClick={() => onMore(player)}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  {[6, 12, 18].map((x) => (
                    <circle key={x} cx={x} cy="12" r="1.8" fill="currentColor" />
                  ))}
                </svg>
              </button>
            )}
          </li>
        );
      })}
    </ol>
  );
}
