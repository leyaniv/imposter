import { useState } from 'react';
import HoldToReveal from '../components/HoldToReveal';
import type { Round } from '../game/types';
import { he } from '../i18n/he';

/** מה שמוצג במסך החשיפה. בלי שאר הסבב, כדי שגם טלפון שמכיר רק את התפקיד שלו יוכל להציג אותו */
export interface ShownRole {
  imposter: boolean;
  /** המילה, או הרמז של המתחזה */
  text: string;
  /** רק כשכולם יודעים את הקטגוריה */
  category?: string;
}

/** התפקיד של שחקן בסבב, במצב הטלפון האחד */
export function roundRole(round: Round, playerIndex: number): ShownRole {
  const { id } = round.players[playerIndex];
  const imposter = round.imposterIds.includes(id);
  return {
    imposter,
    text: imposter ? round.hints[id] : round.word,
    category: round.showCategory ? round.category : undefined,
  };
}

interface Props {
  role: ShownRole;
  doneLabel: string;
  onDone: () => void;
}

/** המסך של המתחזה בנוי בדיוק כמו המסך של שחקן רגיל, כדי שאי אפשר יהיה לזהות אותו ממבט מהצד */
export default function RevealScreen({ role, doneLabel, onDone }: Props) {
  const [seen, setSeen] = useState(false);

  return (
    <main className="screen no-select">
      <div className="screen-body center">
        <HoldToReveal onFirstReveal={() => setSeen(true)}>
          {role.category && <p className="category-tag">{he.category(role.category)}</p>}
          <p className="reveal-label">{role.imposter ? he.reveal.imposterLabel : he.reveal.crewLabel}</p>
          <p className="reveal-word">{role.text}</p>
          <p className="reveal-footer">{role.imposter ? he.reveal.imposterFooter : he.reveal.crewFooter}</p>
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
