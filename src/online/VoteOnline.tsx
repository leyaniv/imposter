import { useState } from 'react';
import ConfirmDialog from '../components/ConfirmDialog';
import TopBar from '../components/TopBar';
import { he } from '../i18n/he';
import ConnectionNotice from './ConnectionNotice';
import type { ConnectionStatus } from './connection';
import MuteButton from './MuteButton';
import type { RoomState, RoundState, VoteState } from './protocol';

interface Props {
  state: RoomState;
  round: RoundState;
  vote: VoteState;
  status: ConnectionStatus;
  onCast: (yes: boolean) => void;
  onCancel: () => void;
  onClose: () => void;
  onAskLeave: () => void;
}

/** הצבעה פתוחה: "להדיח את X?" עם בעד ונגד. הנאשם רק רואה שמצביעים עליו */
export default function VoteOnline({ state, round, vote, status, onCast, onCancel, onClose, onAskLeave }: Props) {
  const [confirmClose, setConfirmClose] = useState(false);
  const nameOf = (id: string) => round.players.find((player) => player.id === id)?.name ?? '';
  const isTarget = vote.targetId === state.you;
  const isVoter = vote.voterIds.includes(state.you);
  const isStarter = vote.startedBy === state.you;
  const canClose = isStarter || state.hostId === state.you;

  return (
    <main className="screen">
      <TopBar onExit={onAskLeave}>
        <MuteButton />
      </TopBar>
      <div className="screen-body center">
        <ConnectionNotice status={status} />
        <h1 className="heading">{he.online.vote.title(nameOf(vote.targetId))}</h1>
        <p className="muted">{he.online.vote.by(nameOf(vote.startedBy))}</p>

        {isTarget ? (
          <p className="big-name pop">{he.online.vote.accused}</p>
        ) : isVoter ? (
          <div className="segmented vote-choice" role="radiogroup" aria-label={he.online.vote.title(nameOf(vote.targetId))}>
            {([true, false] as const).map((yes) => (
              <button
                key={String(yes)}
                role="radio"
                aria-checked={vote.myVote === yes}
                className={`segment${vote.myVote === yes ? ' segment-on' : ''}`}
                onClick={() => onCast(yes)}
              >
                {yes ? he.online.vote.yes : he.online.vote.no}
              </button>
            ))}
          </div>
        ) : (
          <p className="muted">{he.online.vote.watching}</p>
        )}

        <p className="label">{he.online.vote.progress(vote.votedCount, vote.voterIds.length)}</p>
        {vote.votes && (
          <ul className="vote-list">
            {vote.voterIds.map((id) => {
              const cast = vote.votes![id];
              return (
                <li key={id}>
                  <span>{nameOf(id)}</span>
                  <span className={`vote-mark${cast === true ? ' vote-yes' : cast === false ? ' vote-no' : ''}`}>
                    {cast === true ? he.online.vote.yes : cast === false ? he.online.vote.no : he.online.vote.pending}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {(isStarter || canClose) && (
        <div className="screen-actions">
          {canClose && (
            <button className="btn btn-secondary" onClick={() => setConfirmClose(true)}>
              {he.online.vote.close}
            </button>
          )}
          {isStarter && (
            <button className="btn btn-ghost" onClick={onCancel}>
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
