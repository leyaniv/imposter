import { useEffect, useState } from 'react';
import { trackShare } from '../analytics/events';
import { he } from '../i18n/he';
import { shareGame } from '../ui/share';

interface Props {
  /** יש ניקוד מהערב, אז מציגים כפתור לצפייה בו */
  showScores: boolean;
  onNewGame: () => void;
  onScores: () => void;
  onRules: () => void;
}

export default function HomeScreen({ showScores, onNewGame, onScores, onRules }: Props) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 3000);
    return () => clearTimeout(timer);
  }, [copied]);

  const share = async () => {
    const result = await shareGame();
    trackShare(result);
    if (result === 'copied') setCopied(true);
  };

  return (
    <main className="screen home">
      <div className="screen-body center">
        <div className="logo" aria-hidden="true">
          {/* הפרצוף של מימי. נוצר מ-branding/mimi-icon.svg על ידי npm run icons */}
          <img src="mimi-face.svg" alt="" />
        </div>
        <h1 className="title" aria-label={he.appName}>
          <span className="title-accent">{he.appNameParts[0]}</span>
          <span className="title-accent-2">{he.appNameParts[1]}</span>
          {he.appNameParts[2]}
        </h1>
        <p className="muted">{he.tagline}</p>
      </div>
      <div className="screen-actions">
        <button className="btn btn-primary" onClick={onNewGame}>
          {he.home.newGame}
        </button>
        {showScores && (
          <button className="btn btn-secondary" onClick={onScores}>
            {he.home.scores}
          </button>
        )}
        <div className="actions-row">
          <button className="btn btn-ghost" onClick={onRules}>
            {he.home.rules}
          </button>
          <button className="btn btn-ghost btn-icon" onClick={share}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12 15V4M8 8l4-4 4 4M6 12v6a2 2 0 002 2h8a2 2 0 002-2v-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {he.home.share}
          </button>
        </div>
        <p className={`toast${copied ? ' toast-on' : ''}`} role="status">
          {copied ? he.home.linkCopied : ''}
        </p>
      </div>
    </main>
  );
}
