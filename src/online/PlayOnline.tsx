import { useState } from 'react';
import ConfirmDialog from '../components/ConfirmDialog';
import PlayerCircle from '../components/PlayerCircle';
import TopBar from '../components/TopBar';
import WordReport from '../components/WordReport';
import type { WordProblem } from '../game/types';
import { useStarterDraw } from '../hooks/useStarterDraw';
import { he } from '../i18n/he';
import RevealScreen from '../screens/RevealScreen';
import ConnectionNotice from './ConnectionNotice';
import type { ConnectionStatus } from './connection';
import MuteButton from './MuteButton';
import type { RoomState, RoundState } from './protocol';
import { shownRole } from './RevealOnline';

interface Props {
  state: RoomState;
  round: RoundState;
  status: ConnectionStatus;
  /** כבר דיווחו מהטלפון הזה על המילה בסבב הזה */
  reported: boolean;
  onReport: (problem: WordProblem) => void;
  onVote: (targetId: string) => void;
  onFreeGuess: () => void;
  onEndRound: () => void;
  onAskLeave: () => void;
}

/** ההגרלה של מי מתחיל רצה פעם אחת בכל סבב בכל טלפון, ולא שוב אחרי ריענון */
function drawnKey(state: RoomState, round: RoundState): string {
  return `imposter:drawn:${state.code}:${round.number}`;
}

function wasDrawn(key: string): boolean {
  try {
    return sessionStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function markDrawn(key: string) {
  try {
    sessionStorage.setItem(key, '1');
  } catch {
    // לא קריטי: לכל היותר ההגרלה תוצג שוב
  }
}

type Overlay = { kind: 'peek' } | { kind: 'report' } | { kind: 'end' } | { kind: 'guess' } | { kind: 'vote'; index: number } | null;

/** שלב הדיבור: מי מתחיל, המעגל (לחיצה על שם פותחת הצבעה), הצצה חוזרת, ניחוש חופשי ומשוב על המילה */
export default function PlayOnline({
  state,
  round,
  status,
  reported,
  onReport,
  onVote,
  onFreeGuess,
  onEndRound,
  onAskLeave,
}: Props) {
  const [overlay, setOverlay] = useState<Overlay>(null);
  const key = drawnKey(state, round);
  const [drawing] = useState(() => !wasDrawn(key));
  const startIndex = Math.max(0, round.players.findIndex((player) => player.id === round.starterId));
  const { highlightIndex, done } = useStarterDraw(round.players.length, startIndex, drawing, () => markDrawn(key));
  const isHost = state.hostId === state.you;
  const out = round.eliminatedIds.includes(state.you);
  const role = shownRole(round)!;
  const lastVote = round.lastVote && !round.lastVote.eliminated ? round.lastVote : undefined;

  if (overlay?.kind === 'peek') {
    return <RevealScreen key="peek" role={role} doneLabel={he.forgot.done} onDone={() => setOverlay(null)} />;
  }

  if (overlay?.kind === 'report') {
    return (
      <main key="report" className="screen">
        <div className="screen-body center">
          <h1 className="heading">{he.feedback.title}</h1>
          <p className="muted">{he.feedback.duringRound}</p>
          <WordReport reported={reported} onReport={onReport} />
        </div>
        <div className="screen-actions">
          <button className="btn btn-primary" onClick={() => setOverlay(null)}>
            {he.outcome.backToGame}
          </button>
        </div>
      </main>
    );
  }

  const voteTarget = overlay?.kind === 'vote' ? round.players[overlay.index] : undefined;

  return (
    <main className="screen">
      <TopBar onExit={onAskLeave}>
        <MuteButton />
      </TopBar>
      <div className="screen-body center">
        <ConnectionNotice status={status} />
        {lastVote ? (
          <p className="notice" role="status">
            {he.online.vote.count(lastVote.yes, lastVote.no)}. {he.online.vote.noMajority}
          </p>
        ) : (
          <>
            <p className="muted">{done ? he.start.title : he.start.drawing}</p>
            <p className={`big-name${done ? ' pop' : ' invisible'}`}>{round.players[startIndex]?.name}</p>
          </>
        )}
        <PlayerCircle
          players={round.players}
          highlightIndex={lastVote ? -1 : highlightIndex}
          landed={done && drawing}
          eliminatedIds={round.eliminatedIds}
          scores={state.scores}
          onSelect={done && !out ? (index) => round.players[index].id !== state.you && setOverlay({ kind: 'vote', index }) : undefined}
        />
        <p className={`muted${done ? '' : ' invisible'}`}>{he.start.clockwise}</p>
        <p className={`help${done ? '' : ' invisible'}`}>{out ? he.online.round.out : he.online.round.votingHint}</p>
        {round.category && <p className="category-tag">{he.category(round.category)}</p>}
        {round.imposterCount > 1 && <p className="notice">{he.start.twoImposters}</p>}
      </div>

      <div className={`screen-actions${done ? '' : ' invisible'}`}>
        {!out && (
          <button className="btn btn-secondary" onClick={() => setOverlay({ kind: 'guess' })}>
            {he.start.freeGuess}
          </button>
        )}
        <div className="actions-row">
          {isHost && (
            <button className="btn btn-ghost" onClick={() => setOverlay({ kind: 'end' })}>
              {he.start.endRound}
            </button>
          )}
          <button className="btn btn-ghost" onClick={() => setOverlay({ kind: 'peek' })}>
            {he.forgot.button}
          </button>
        </div>
        <button className="link-btn link-muted" onClick={() => setOverlay({ kind: 'report' })}>
          {he.feedback.title}
        </button>
      </div>

      {voteTarget && (
        <ConfirmDialog
          message={he.online.vote.openConfirm(voteTarget.name)}
          confirmLabel={he.online.vote.open}
          cancelLabel={he.common.cancel}
          onConfirm={() => {
            setOverlay(null);
            onVote(voteTarget.id);
          }}
          onCancel={() => setOverlay(null)}
        />
      )}
      {overlay?.kind === 'guess' && (
        <ConfirmDialog
          message={he.online.guess.openConfirm}
          confirmLabel={he.online.guess.openYes}
          cancelLabel={he.common.cancel}
          onConfirm={() => {
            setOverlay(null);
            onFreeGuess();
          }}
          onCancel={() => setOverlay(null)}
        />
      )}
      {overlay?.kind === 'end' && (
        <ConfirmDialog
          message={he.online.round.endConfirm}
          confirmLabel={he.start.confirmYes}
          cancelLabel={he.common.cancel}
          onConfirm={() => {
            setOverlay(null);
            onEndRound();
          }}
          onCancel={() => setOverlay(null)}
        />
      )}
    </main>
  );
}
