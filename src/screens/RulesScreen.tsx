import StickyActions from '../components/StickyActions';
import { he } from '../i18n/he';

export default function RulesScreen({ onBack }: { onBack: () => void }) {
  return (
    <main className="screen">
      <div className="screen-body">
        <h1 className="heading">{he.rules.title}</h1>
        {he.rules.sections.map((section) => (
          <section key={section.title} className="rules-section">
            <h2 className="label">{section.title}</h2>
            <ul>
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <StickyActions>
        <button className="btn btn-primary" onClick={onBack}>
          {he.rules.back}
        </button>
      </StickyActions>
    </main>
  );
}
