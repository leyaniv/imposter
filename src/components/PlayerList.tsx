import { useEffect, useRef } from 'react';
import { MAX_PLAYERS, MIN_PLAYERS, addPlayer, duplicateNames } from '../game/setup';
import type { Player } from '../game/types';
import { useDragReorder } from '../hooks/useDragReorder';
import { he } from '../i18n/he';
import { displayName } from '../ui/names';
import DragHandle from './DragHandle';

interface Props {
  players: Player[];
  onChange: (players: Player[]) => void;
}

/**
 * רשימת השחקנים לפי סדר הישיבה: הוספה, הסרה, ושינוי הסדר בגרירה של הידית.
 * המזהה של כל שחקן נשאר קבוע, כך שהניקוד שלו לא הולך לאיבוד כשמשנים את הסדר.
 */
export default function PlayerList({ players, onChange }: Props) {
  const inputs = useRef(new Map<string, HTMLInputElement>());
  const focusId = useRef<string | null>(null);
  const { rowRef, handleProps, rowProps } = useDragReorder(players, onChange);

  useEffect(() => {
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

  return (
    <>
      <ol className="name-list">
        {players.map((player, i) => {
          const name = displayName(player, i);
          return (
            <li key={player.id} ref={rowRef(player.id)} {...rowProps(player.id)}>
              <DragHandle label={he.setup.movePlayer(name)} {...handleProps(player.id, i)} />
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
