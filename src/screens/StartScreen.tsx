import { useState } from 'react';
import ConfirmDialog from '../components/ConfirmDialog';
import PlayerCircle from '../components/PlayerCircle';
import TopBar from '../components/TopBar';
import WordReport from '../components/WordReport';
import type { Round, WordProblem } from '../game/types';
import { useStarterDraw } from '../hooks/useStarterDraw';
import { he } from '../i18n/he';
import { displayName } from '../ui/names';
import ChoosePlayerScreen from './ChoosePlayerScreen';
import GuessScreen from './GuessScreen';
import OutcomeScreen from './OutcomeScreen';
import PassScreen from './PassScreen';
import RevealScreen from './RevealScreen';

interface Props {
  round: Round;
  scores: Record<string, number>;
  onAnnounced: () => void;
  onEliminate: (playerId: string) => void;
  onLastGuess: (correct: boolean) => void;
  onDismissReveal: () => void;
  onFreeGuess: (correct: boolean) => void;
  onReportWord: (problem: WordProblem) => void;
  onEndRound: () => void;
  onExit: () => void;
}

/**
 * מי שכח את המילה: בוחרים שחקן, מעבירים לו את הטלפון, והוא מציץ שוב.
 * ניחוש חופשי: המתחזה מנחש, והשחקנים מסמנים אם צדק.
 * דיווח על המילה: באמצע הסבב, בלי לחשוף אותה.
 */
type Overlay =
  | { step: 'choose' }
  | { step: 'pass'; index: number }
  | { step: 'reveal'; index: number }
  | { step: 'freeGuess' }
  | { step: 'report' };

export default function StartScreen({
  round,
  scores,
  onAnnounced,
  onEliminate,
  onLastGuess,
  onDismissReveal,
  onFreeGuess,
  onReportWord,
  onEndRound,
  onExit,
}: Props) {
  const [confirming, setConfirming] = useState(false);
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [eliminating, setEliminating] = useState<number | null>(null);
  // ההגרלה רצה עכשיו (ולא כשחוזרים למסך אחרי הדחה או הצצה), אז מסמנים את הנחיתה
  const [drawing] = useState(!round.starterAnnounced);
  const { highlightIndex, done } = useStarterDraw(
    round.players.length,
    round.startIndex,
    !round.starterAnnounced,
    onAnnounced,
  );

  if (round.revealedId || round.winner) {
    return (
      <OutcomeScreen
        key="outcome"
        round={round}
        onLastGuess={onLastGuess}
        onContinue={onDismissReveal}
        onResults={onEndRound}
        onExit={onExit}
      />
    );
  }
  if (overlay?.step === 'choose') {
    return (
      <ChoosePlayerScreen
        key="choose"
        players={round.players}
        onChoose={(index) => setOverlay({ step: 'pass', index })}
        onCancel={() => setOverlay(null)}
      />
    );
  }
  if (overlay?.step === 'pass') {
    return (
      <PassScreen
        key="pass"
        name={displayName(round.players[overlay.index], overlay.index)}
        onConfirm={() => setOverlay({ step: 'reveal', index: overlay.index })}
        onCancel={() => setOverlay(null)}
      />
    );
  }
  if (overlay?.step === 'reveal') {
    return (
      <RevealScreen
        key="reveal"
        round={round}
        playerIndex={overlay.index}
        doneLabel={he.forgot.done}
        onDone={() => setOverlay(null)}
      />
    );
  }
  if (overlay?.step === 'freeGuess') {
    return (
      <GuessScreen
        key="freeGuess"
        title={he.guess.freeTitle}
        text={he.guess.freeText}
        ask={he.guess.freeAsk}
        rightLabel={he.guess.freeRight(round.imposterIds.length)}
        wrongLabel={he.guess.freeWrong}
        onAnswer={onFreeGuess}
        onCancel={() => setOverlay(null)}
      />
    );
  }

  if (overlay?.step === 'report') {
    return (
      <main key="report" className="screen">
        <div className="screen-body center">
          <h1 className="heading">{he.feedback.title}</h1>
          <p className="muted">{he.feedback.duringRound}</p>
          <WordReport reported={!!round.wordReported} onReport={onReportWord} />
        </div>
        <div className="screen-actions">
          <button className="btn btn-primary" onClick={() => setOverlay(null)}>
            {he.outcome.backToGame}
          </button>
        </div>
      </main>
    );
  }

  const starter = displayName(round.players[round.startIndex], round.startIndex);
  const eliminatingPlayer = eliminating === null ? null : round.players[eliminating];

  return (
    <main className="screen">
      <TopBar onExit={onExit} />
      <div className="screen-body center">
        <p className="muted">{done ? he.start.title : he.start.drawing}</p>
        <p className={`big-name${done ? ' pop' : ' invisible'}`}>{starter}</p>
        <PlayerCircle
          players={round.players}
          highlightIndex={highlightIndex}
          landed={done && drawing}
          eliminatedIds={round.eliminatedIds}
          scores={scores}
          onSelect={done ? setEliminating : undefined}
        />
        <p className={`muted${done ? '' : ' invisible'}`}>{he.start.clockwise}</p>
        <p className={`help${done ? '' : ' invisible'}`}>{he.start.eliminateHint}</p>
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
            <button className="btn btn-secondary" onClick={() => setOverlay({ step: 'freeGuess' })}>
              {he.start.freeGuess}
            </button>
            <div className="actions-row">
              <button className="btn btn-ghost" onClick={() => setConfirming(true)}>
                {he.start.endRound}
              </button>
              <button className="btn btn-ghost" onClick={() => setOverlay({ step: 'choose' })}>
                {he.forgot.button}
              </button>
            </div>
            <button className="link-btn link-muted" onClick={() => setOverlay({ step: 'report' })}>
              {he.feedback.title}
            </button>
          </>
        )}
      </div>

      {eliminatingPlayer && (
        <ConfirmDialog
          message={he.start.eliminateConfirm(displayName(eliminatingPlayer, eliminating!))}
          confirmLabel={he.start.eliminateYes}
          cancelLabel={he.common.cancel}
          onConfirm={() => {
            setEliminating(null);
            onEliminate(eliminatingPlayer.id);
          }}
          onCancel={() => setEliminating(null)}
        />
      )}
    </main>
  );
}
