import { Component, type ErrorInfo, type ReactNode } from 'react';
import { track } from '../analytics/posthog';
import { rehydrate, serialize } from '../game/persistence';
import { STORAGE_KEY } from '../hooks/usePersistentReducer';
import { he } from '../i18n/he';

interface State {
  crashed: boolean;
  /** בפיתוח בלבד: השגיאה והרכיב שזרק, כדי לראות אותם גם בטלפון (אין שם קונסול) */
  detail?: string;
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

  componentDidCatch(error: unknown, info: ErrorInfo) {
    track('app_crash', { message: String(error instanceof Error ? error.message : error).slice(0, 200) });
    if (import.meta.env.DEV) {
      const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      const where = (info.componentStack ?? '').trim().split('\n').slice(0, 6).join('\n');
      this.setState({ detail: `${message}\n${where}` });
    }
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
          {this.state.detail && (
            <pre dir="ltr" style={{ whiteSpace: 'pre-wrap', textAlign: 'left', fontSize: 12, maxWidth: '100%' }}>
              {this.state.detail}
            </pre>
          )}
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
