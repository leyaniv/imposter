import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { MAX_PLAYERS, MIN_PLAYERS, addPlayer, duplicateNames, movePlayer } from '../game/setup';
import type { Player } from '../game/types';
import { he } from '../i18n/he';
import { displayName } from '../ui/names';

interface Props {
  players: Player[];
  onChange: (players: Player[]) => void;
}

interface Drag {
  id: string;
  /** מיקום האצבע כשהשורה הייתה במקומה הנוכחי ברשימה */
  originY: number;
}

/**
 * רשימת השחקנים לפי סדר הישיבה: הוספה, הסרה, ושינוי הסדר בגרירה של הידית.
 * המזהה של כל שחקן נשאר קבוע, כך שהניקוד שלו לא הולך לאיבוד כשמשנים את הסדר.
 */
export default function PlayerList({ players, onChange }: Props) {
  const rows = useRef(new Map<string, HTMLLIElement>());
  const inputs = useRef(new Map<string, HTMLInputElement>());
  const latest = useRef(players);
  const drag = useRef<Drag | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const focusId = useRef<string | null>(null);

  useEffect(() => {
    latest.current = players;
    // שחקן שנוסף עכשיו: מתחילים להקליד את השם שלו מיד
    if (focusId.current) {
      inputs.current.get(focusId.current)?.focus();
      focusId.current = null;
    }
  }, [players]);

  const duplicates = duplicateNames(players);
  const isDuplicate = (name: string) => duplicates.some((d) => d.toLowerCase() === name.trim().toLowerCase());

  const setName = (id: string, name: string) =>
    onChange(players.map((player) => (player.id === id ? { ...player, name } : player)));

  const add = () => {
    const next = addPlayer(players);
    focusId.current = next[next.length - 1].id;
    onChange(next);
  };

  const remove = (id: string) => onChange(players.filter((player) => player.id !== id));

  /** המרחק בין שורה לשורה (גובה שורה + רווח) */
  const rowStep = (a: string, b: string) => {
    const first = rows.current.get(a);
    const second = rows.current.get(b);
    return first && second ? Math.abs(second.offsetTop - first.offsetTop) : 0;
  };

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>, id: string) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id, originY: e.clientY };
    setDragId(id);
    setOffset(0);
  };

  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    const current = drag.current;
    if (!current) return;
    const start = latest.current;
    let list = start;
    let index = list.findIndex((player) => player.id === current.id);
    let dy = e.clientY - current.originY;
    // כל השורות באותו גובה, אז מספיק למדוד מרחק בין שתי שורות פעם אחת
    const neighbor = list[index + 1] ?? list[index - 1];
    const step = neighbor ? rowStep(current.id, neighbor.id) : 0;
    if (!step) return;

    // עברו חצי שורה: מחליפים מקום עם השכן, והשורה ממשיכה לעקוב אחרי האצבע מהמקום החדש
    while (index < list.length - 1 && dy > step / 2) {
      list = movePlayer(list, index, index + 1);
      index++;
      current.originY += step;
      dy -= step;
    }
    while (index > 0 && dy < -step / 2) {
      list = movePlayer(list, index, index - 1);
      index--;
      current.originY -= step;
      dy += step;
    }
    if (list !== start) {
      latest.current = list;
      onChange(list);
    }
    setOffset(dy);
  };

  const endDrag = () => {
    drag.current = null;
    setDragId(null);
    setOffset(0);
  };

  const onHandleKey = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const to = e.key === 'ArrowUp' ? index - 1 : e.key === 'ArrowDown' ? index + 1 : -1;
    if (to < 0 || to >= players.length) return;
    e.preventDefault();
    onChange(movePlayer(players, index, to));
  };

  return (
    <>
      <ol className="name-list">
        {players.map((player, i) => {
          const name = displayName(player, i);
          const dragging = player.id === dragId;
          return (
            <li
              key={player.id}
              ref={(el) => {
                if (el) rows.current.set(player.id, el);
                else rows.current.delete(player.id);
              }}
              className={dragging ? 'dragging' : undefined}
              style={dragging ? { transform: `translateY(${offset}px)` } : undefined}
            >
              <button
                className="drag-handle"
                aria-label={he.setup.movePlayer(name)}
                onPointerDown={(e) => onPointerDown(e, player.id)}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onKeyDown={(e) => onHandleKey(e, i)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  {[6, 12, 18].map((y) => (
                    <g key={y}>
                      <circle cx="9" cy={y} r="1.6" />
                      <circle cx="15" cy={y} r="1.6" />
                    </g>
                  ))}
                </svg>
              </button>
              <span className="name-index">{i + 1}</span>
              <input
                ref={(el) => {
                  if (el) inputs.current.set(player.id, el);
                  else inputs.current.delete(player.id);
                }}
                className={`input${isDuplicate(player.name) ? ' input-warn' : ''}`}
                value={player.name}
                placeholder={he.playerFallback(i + 1)}
                maxLength={16}
                enterKeyHint="next"
                autoComplete="off"
                aria-label={he.playerFallback(i + 1)}
                onChange={(e) => setName(player.id, e.target.value)}
              />
              <button
                className="icon-btn remove-btn"
                aria-label={he.setup.removePlayer(name)}
                disabled={players.length <= MIN_PLAYERS}
                onClick={() => remove(player.id)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M7 7l10 10M17 7L7 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </li>
          );
        })}
      </ol>

      {duplicates.map((name) => (
        <p key={name} className="help warn" role="status">
          {he.setup.duplicateName(name)}
        </p>
      ))}

      {players.length < MAX_PLAYERS ? (
        <button className="btn btn-dashed" onClick={add}>
          <span aria-hidden="true">+</span> {he.setup.addPlayer}
        </button>
      ) : (
        <p className="help">{he.setup.maxPlayers(MAX_PLAYERS)}</p>
      )}
    </>
  );
}
