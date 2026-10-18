import TopBar from '../components/TopBar';
import { isImposter, remaining } from '../game/rules';
import type { Round } from '../game/types';
import { he } from '../i18n/he';
import { displayName } from '../ui/names';
import { winReasonText, winnerTitle } from '../ui/results';
import GuessScreen from './GuessScreen';

interface Props {
  round: Round;
  onLastGuess: (correct: boolean) => void;
  onContinue: () => void;
  onResults: () => void;
  onExit: () => void;
}

/** אחרי הדחה: האם זה המתחזה, ניחוש אחרון, ואם המשחק נגמר */
export default function OutcomeScreen({ round, onLastGuess, onContinue, onResults, onExit }: Props) {
  const index = round.players.findIndex((player) => player.id === round.revealedId);
  const player = round.players[index];
  const caught = !!player && isImposter(round, player.id);

  const who = player && (
    <>
      <p className="big-name pop">{displayName(player, index)}</p>
      <p className={`outcome-tag${caught ? ' outcome-imposter' : ''}`}>
        {caught ? he.outcome.imposter : he.outcome.notImposter}
      </p>
    </>
  );

  if (round.guessPending) {
    return (
      <GuessScreen
        before={who}
        title={he.guess.lastTitle}
        text={he.guess.lastText}
        onAnswer={onLastGuess}
        onExit={onExit}
      />
    );
  }

  return (
    <main className="screen">
      <TopBar onExit={onExit} />
      <div className="screen-body center">
        {who}

        {round.winner ? (
          <div className="winner-banner pop">
            <p className="winner-title">{winnerTitle(round)}</p>
            {winReasonText(round) && <p className="muted">{winReasonText(round)}</p>}
          </div>
        ) : (
          <>
            {caught && <p className="muted">{he.outcome.wrongGuess}</p>}
            {caught && remaining(round).imposters > 0 && <p className="notice">{he.outcome.oneMoreImposter}</p>}
            <p className="muted">{he.outcome.goOn}</p>
          </>
        )}
      </div>

      <div className="screen-actions">
        {round.winner ? (
          <button className="btn btn-primary" onClick={onResults}>
            {he.outcome.toResults}
          </button>
        ) : (
          <button className="btn btn-primary" onClick={onContinue}>
            {he.outcome.backToGame}
          </button>
        )}
      </div>
    </main>
  );
}
