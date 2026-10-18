import { he } from '../i18n/he';

interface Props {
  onNewGame: () => void;
  onRules: () => void;
}

export default function HomeScreen({ onNewGame, onRules }: Props) {
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
        <button className="btn btn-ghost" onClick={onRules}>
          {he.home.rules}
        </button>
      </div>
    </main>
  );
}
