import StickyActions from '../components/StickyActions';
import { changelog } from '../data/changelog.he';
import { he } from '../i18n/he';

/** 2026-10-18 -> 18.10.2026 */
function formatDate(date: string): string {
  return date.split('-').reverse().join('.');
}

export default function ChangelogScreen({ onBack }: { onBack: () => void }) {
  return (
    <main className="screen">
      <div className="screen-body">
        <h1 className="heading">{he.changelog.title}</h1>
        {changelog.map((entry) => (
          <section key={entry.version} className="rules-section">
            <div className="label-row">
              <h2 className="label">{he.about.version(entry.version)}</h2>
              <p className="muted">{formatDate(entry.date)}</p>
            </div>
            <ul>
              {entry.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <StickyActions>
        <button className="btn btn-primary" onClick={onBack}>
          {he.changelog.back}
        </button>
      </StickyActions>
    </main>
  );
}
