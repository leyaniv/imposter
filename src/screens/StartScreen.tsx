import { useState } from 'react';
import PlayerCircle from '../components/PlayerCircle';
import TopBar from '../components/TopBar';
import type { Round } from '../game/types';
import { useStarterDraw } from '../hooks/useStarterDraw';
import { he } from '../i18n/he';
import { displayName } from '../ui/names';
import ChoosePlayerScreen from './ChoosePlayerScreen';
import PassScreen from './PassScreen';
import RevealScreen from './RevealScreen';

interface Props {
  round: Round;
  onAnnounced: () => void;
  onEndRound: () => void;
  onExit: () => void;
}

/** מי שכח את המילה: בוחרים שחקן, מעבירים לו את הטלפון, והוא מציץ שוב */
type Peek = { step: 'choose' } | { step: 'pass'; index: number } | { step: 'reveal'; index: number };

export default function StartScreen({ round, onAnnounced, onEndRound, onExit }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [peek, setPeek] = useState<Peek | null>(null);
  const { highlightIndex, done } = useStarterDraw(
    round.players.length,
    round.startIndex,
    !round.starterAnnounced,
    onAnnounced,
  );

  if (peek?.step === 'choose') {
    return (
      <ChoosePlayerScreen
        key="choose"
        players={round.players}
        onChoose={(index) => setPeek({ step: 'pass', index })}
        onCancel={() => setPeek(null)}
      />
    );
  }
  if (peek?.step === 'pass') {
    return (
      <PassScreen
        key="pass"
        name={displayName(round.players[peek.index], peek.index)}
        onConfirm={() => setPeek({ step: 'reveal', index: peek.index })}
        onCancel={() => setPeek(null)}
      />
    );
  }
  if (peek?.step === 'reveal') {
    return (
      <RevealScreen
        key="reveal"
        round={round}
        playerIndex={peek.index}
        doneLabel={he.forgot.done}
        onDone={() => setPeek(null)}
      />
    );
  }

  const starter = displayName(round.players[round.startIndex], round.startIndex);

  return (
    <main className="screen">
      <TopBar onExit={onExit} />
      <div className="screen-body center">
        <p className="muted">{done ? he.start.title : he.start.drawing}</p>
        <p className={`big-name${done ? ' pop' : ' invisible'}`}>{starter}</p>
        <PlayerCircle players={round.players} highlightIndex={highlightIndex} />
        <p className={`muted${done ? '' : ' invisible'}`}>{he.start.clockwise}</p>
        {round.showCategory && <p className="category-tag">{he.category(round.category)}</p>}
        {round.imposterIds.length > 1 && <p className="notice">{he.start.twoImposters}</p>}
      </div>

      <div className={`screen-actions${done ? '' : ' invisible'}`}>
        {confirming ? (
          <>
            <p className="confirm-text">{he.start.confirm}</p>
            <button className="btn btn-danger" onClick={onEndRound}>
              {he.start.confirmYes}
            </button>
            <button className="btn btn-ghost" onClick={() => setConfirming(false)}>
              {he.common.cancel}
            </button>
          </>
        ) : (
          <>
            <button className="btn btn-secondary" onClick={() => setConfirming(true)}>
              {he.start.endRound}
            </button>
            <button className="btn btn-ghost" onClick={() => setPeek({ step: 'choose' })}>
              {he.forgot.button}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
