import { trackLink } from '../analytics/events';
import StickyActions from '../components/StickyActions';
import { he } from '../i18n/he';

const GITHUB_URL = 'https://github.com/leyaniv/imposter';
const ISSUES_URL = 'https://github.com/leyaniv/imposter/issues/new';
const KOFI_URL = 'https://ko-fi.com/yanivlevinsky';

interface Props {
  onChangelog: () => void;
  onBack: () => void;
}

export default function AboutScreen({ onChangelog, onBack }: Props) {
  return (
    <main className="screen">
      <div className="screen-body">
        <h1 className="heading">{he.about.title}</h1>

        <section className="rules-section about-story">
          <img className="about-mimi" src="mimi-face.svg" alt="" />
          <h2 className="label">{he.about.storyTitle}</h2>
          {he.about.story.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </section>

        <figure className="about-photo">
          {/* מוקטנת וחתוכה מ-mimi/, בלי נתוני Exif */}
          <img src="mimi-photo.jpg" alt={he.about.photoAlt} width={800} height={667} loading="lazy" />
          <figcaption className="help">{he.about.photoCaption}</figcaption>
        </figure>

        <div className="about-links">
          <a
            className="btn btn-secondary btn-icon"
            href={KOFI_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackLink('kofi')}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M4 8h13v5a5 5 0 01-5 5H9a5 5 0 01-5-5V8zM17 9h1.5a2.5 2.5 0 010 5H17M8 4v1.5M12 3v2.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {he.about.kofi}
          </a>
          <a
            className="btn btn-ghost btn-icon"
            href={ISSUES_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackLink('issues')}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M5 5h14v10H9l-4 4V5zM12 8v3M12 13.5v.01"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {he.about.issues}
          </a>
          <a
            className="btn btn-ghost btn-icon"
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackLink('github')}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M8 9l-4 3 4 3M16 9l4 3-4 3M13.5 6l-3 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {he.about.github}
          </a>
        </div>

        <p className="help">{he.about.privacy}</p>
        <p className="help">{he.about.credits}</p>

        <div className="label-row about-version">
          <p className="muted">{he.about.version(__APP_VERSION__)}</p>
          <button className="link-btn" onClick={onChangelog}>
            {he.about.changelog}
          </button>
        </div>
      </div>

      <StickyActions>
        <button className="btn btn-primary" onClick={onBack}>
          {he.about.back}
        </button>
      </StickyActions>
    </main>
  );
}
