import { Component, type ReactNode } from 'react';
import { track } from '../analytics/posthog';
import { rehydrate, serialize } from '../game/persistence';
import { STORAGE_KEY } from '../hooks/usePersistentReducer';
import { he } from '../i18n/he';

interface State {
  crashed: boolean;
}

/**
 * כשמשהו במשחק זורק שגיאה, React משאיר מסך לבן. במקום זה: הסבר ושתי דרכים לצאת.
 * המשחק שמור בטלפון, אז ריענון לבד יכול להחזיר לאותו מסך שקרס. לכן "חזרה למסך הפתיחה" מוחקת את הסבב השמור (בלי השמות והניקוד),
 * ומורידה את ?room= מהכתובת כדי לא להיכנס שוב לחדר.
 */
export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { crashed: false };

  static getDerivedStateFromError(): State {
    return { crashed: true };
  }

  componentDidCatch(error: unknown) {
    track('app_crash', { message: String(error instanceof Error ? error.message : error).slice(0, 200) });
  }

  private goHome = () => {
    try {
      // רק הסבב נמחק. השמות, ההגדרות והניקוד של הערב נשארים
      const saved = rehydrate(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serialize({ ...saved, phase: 'home', round: undefined })));
    } catch {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // localStorage חסום: אין סבב שמור למחוק
      }
    }
    location.replace(location.pathname);
  };

  render() {
    if (!this.state.crashed) return this.props.children;
    return (
      <main className="screen">
        <div className="screen-body center">
          <h1 className="heading">{he.crash.title}</h1>
          <p className="muted">{he.crash.text}</p>
        </div>
        <div className="screen-actions">
          <button className="btn btn-primary" onClick={() => location.reload()}>
            {he.crash.retry}
          </button>
          <button className="btn btn-secondary" onClick={this.goHome}>
            {he.crash.home}
          </button>
        </div>
      </main>
    );
  }
}
