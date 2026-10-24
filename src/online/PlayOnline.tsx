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
import type { RoomState, RoundState } from './protocol';
import { shownRole } from './RevealOnline';

interface Props {
  state: RoomState;
  round: RoundState;
  status: ConnectionStatus;
  /** כבר דיווחו מהטלפון הזה על המילה בסבב הזה */
  reported: boolean;
  onReport: (problem: WordProblem) => void;
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

type Overlay = 'peek' | 'report' | 'end' | null;

/** שלב הדיבור: מי מתחיל, המעגל, הצצה חוזרת, משוב על המילה. ההצבעה עדיין בעל-פה */
export default function PlayOnline({ state, round, status, reported, onReport, onEndRound, onAskLeave }: Props) {
  const [overlay, setOverlay] = useState<Overlay>(null);
  const key = drawnKey(state, round);
  const [drawing] = useState(() => !wasDrawn(key));
  const startIndex = Math.max(0, round.players.findIndex((player) => player.id === round.starterId));
  const { highlightIndex, done } = useStarterDraw(round.players.length, startIndex, drawing, () => markDrawn(key));
  const isHost = state.hostId === state.you;
  const role = shownRole(round)!;

  if (overlay === 'peek') {
    return <RevealScreen key="peek" role={role} doneLabel={he.forgot.done} onDone={() => setOverlay(null)} />;
  }

  if (overlay === 'report') {
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

  return (
    <main className="screen">
      <TopBar onExit={onAskLeave} />
      <div className="screen-body center">
        <ConnectionNotice status={status} />
        <p className="muted">{done ? he.start.title : he.start.drawing}</p>
        <p className={`big-name${done ? ' pop' : ' invisible'}`}>{round.players[startIndex]?.name}</p>
        <PlayerCircle
          players={round.players}
          highlightIndex={highlightIndex}
          landed={done && drawing}
          eliminatedIds={round.leftIds}
        />
        <p className={`muted${done ? '' : ' invisible'}`}>{he.start.clockwise}</p>
        <p className={`help${done ? '' : ' invisible'}`}>{he.online.round.votingHint}</p>
        {round.category && <p className="category-tag">{he.category(round.category)}</p>}
        {round.imposterCount > 1 && <p className="notice">{he.start.twoImposters}</p>}
      </div>

      <div className={`screen-actions${done ? '' : ' invisible'}`}>
        <button className="btn btn-secondary" onClick={() => setOverlay('peek')}>
          {he.forgot.button}
        </button>
        {isHost && (
          <button className="btn btn-ghost" onClick={() => setOverlay('end')}>
            {he.start.endRound}
          </button>
        )}
        <button className="link-btn link-muted" onClick={() => setOverlay('report')}>
          {he.feedback.title}
        </button>
      </div>

      {overlay === 'end' && (
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
