import { useState } from 'react';
import HoldToReveal from '../components/HoldToReveal';
import type { Round } from '../game/types';
import { he } from '../i18n/he';

interface Props {
  round: Round;
  playerIndex: number;
  doneLabel: string;
  onDone: () => void;
}

/** המסך של המתחזה בנוי בדיוק כמו המסך של שחקן רגיל, כדי שאי אפשר יהיה לזהות אותו ממבט מהצד */
export default function RevealScreen({ round, playerIndex, doneLabel, onDone }: Props) {
  const [seen, setSeen] = useState(false);
  const player = round.players[playerIndex];
  const isImposter = round.imposterIds.includes(player.id);

  return (
    <main className="screen no-select">
      <div className="screen-body center">
        <HoldToReveal onFirstReveal={() => setSeen(true)}>
          {round.showCategory && <p className="category-tag">{he.category(round.category)}</p>}
          <p className="reveal-label">{isImposter ? he.reveal.imposterLabel : he.reveal.crewLabel}</p>
          <p className="reveal-word">{isImposter ? round.hints[player.id] : round.word}</p>
          <p className="reveal-footer">{isImposter ? he.reveal.imposterFooter : he.reveal.crewFooter}</p>
        </HoldToReveal>
      </div>
      <div className="screen-actions">
        <button className="btn btn-primary" disabled={!seen} onClick={onDone}>
          {seen ? doneLabel : he.reveal.lookFirst}
        </button>
      </div>
    </main>
  );
}
