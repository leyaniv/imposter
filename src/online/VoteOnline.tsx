import { useState, type ReactNode } from 'react';
import ConfirmDialog from '../components/ConfirmDialog';
import { he } from '../i18n/he';
import ConnectionNotice from './ConnectionNotice';
import type { ConnectionStatus } from './connection';
import { absences } from './presence';
import type { RoomState, RoundState, VoteState } from './protocol';

interface Props {
  state: RoomState;
  round: RoundState;
  vote: VoteState;
  status: ConnectionStatus;
  onCast: (yes: boolean) => void;
  onCancel: () => void;
  onClose: () => void;
  /** הפס העליון: השתקה, ניהול החדר, הגדרות ויציאה (RoomBar) */
  bar: ReactNode;
}

/** הצבעה פתוחה: "להדיח את X?" עם בעד ונגד. הנאשם רק רואה שמצביעים עליו */
export default function VoteOnline({ state, round, vote, status, onCast, onCancel, onClose, bar }: Props) {
  const [confirmClose, setConfirmClose] = useState(false);
  const nameOf = (id: string) => round.players.find((player) => player.id === id)?.name ?? '';
  const isTarget = vote.targetId === state.you;
  const isVoter = vote.voterIds.includes(state.you);
  const isStarter = vote.startedBy === state.you;
  const canClose = isStarter || state.hostId === state.you;
  const absent = absences(state);
  // מי שעוד במשחק ולא ברשימת המצביעים: מנותק שעוד לא הצביע. השרת לא סופר אותו, ובלי זה הוא פשוט נעלם מהמסך
  const notCounted = round.players
    .filter(({ id }) => id !== vote.targetId && !round.eliminatedIds.includes(id) && !vote.voterIds.includes(id))
    .map(({ id }) => id);
  const awayVoters = vote.voterIds.filter((id) => absent[id] === 'away');
  const canVote = isVoter && !isTarget && !isStarter;

  return (
    <main className="screen">
      {bar}
      <div className="screen-body center">
        <ConnectionNotice status={status} />
        <h1 className="heading">{he.online.vote.title(nameOf(vote.targetId))}</h1>
        <p className="muted">{he.online.vote.by(nameOf(vote.startedBy))}</p>

        {isTarget ? (
          <p className="big-name pop">{he.online.vote.accused}</p>
        ) : isStarter ? (
          <p className="muted">{he.online.vote.starter}</p>
        ) : canVote ? null : (
          <p className="muted">{he.online.vote.watching}</p>
        )}

        <p className="label">{he.online.vote.progress(vote.votedCount, vote.voterIds.length)}</p>
        {vote.votes ? (
          <ul className="vote-list">
            {vote.voterIds.map((id) => {
              const cast = vote.votes![id];
              const away = cast === undefined && absent[id] === 'away';
              return (
                <li key={id}>
                  <span>{nameOf(id)}</span>
                  <span className={`vote-mark${cast === true ? ' vote-yes' : cast === false ? ' vote-no' : ''}`}>
                    {cast === true
                      ? he.online.vote.yes
                      : cast === false
                        ? he.online.vote.no
                        : away
                          ? `${he.online.vote.pending} · ${he.online.presence.away}`
                          : he.online.vote.pending}
                  </span>
                </li>
              );
            })}
            {notCounted.map((id) => (
              <li key={id} className="vote-not-counted">
                <span>{nameOf(id)}</span>
                <span className="vote-mark">{he.online.presence.notCounted}</span>
              </li>
            ))}
          </ul>
        ) : (
          // בהצבעה חשאית אין רשימה, אז רק אומרים מי לא נספר ולמי כדאי לקרוא
          <>
            {notCounted.length > 0 && <p className="muted">{he.online.presence.notCountedList(notCounted.map(nameOf))}</p>}
            {awayVoters.length > 0 && <p className="muted">{he.online.presence.awayList(awayVoters.map(nameOf))}</p>}
          </>
        )}
      </div>

      {(canVote || isStarter || canClose) && (
        <div className="screen-actions">
          {/* בעד ונגד למטה, בהישג האגודל */}
          {canVote && (
            <div className="segmented vote-choice" role="radiogroup" aria-label={he.online.vote.title(nameOf(vote.targetId))}>
              {([true, false] as const).map((yes) => (
                <button
                  key={String(yes)}
                  role="radio"
                  aria-checked={vote.myVote === yes}
                  className={`segment ${yes ? 'segment-yes' : 'segment-no'}${vote.myVote === yes ? ' segment-on' : ''}`}
                  onClick={() => onCast(yes)}
                >
                  {yes ? he.online.vote.yes : he.online.vote.no}
                </button>
              ))}
            </div>
          )}
          {canClose && (
            <button className="btn btn-tinted" onClick={() => setConfirmClose(true)}>
              {he.online.vote.close}
            </button>
          )}
          {isStarter && (
            <button className="btn btn-ghost btn-ghost-accent" onClick={onCancel}>
              {he.online.vote.cancel}
            </button>
          )}
        </div>
      )}

      {confirmClose && (
        <ConfirmDialog
          message={he.online.vote.closeConfirm}
          confirmLabel={he.online.vote.closeYes}
          cancelLabel={he.common.cancel}
          onConfirm={() => {
            setConfirmClose(false);
            onClose();
          }}
          onCancel={() => setConfirmClose(false)}
        />
      )}
    </main>
  );
}
