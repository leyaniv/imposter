import TopBar from '../components/TopBar';
import { he } from '../i18n/he';

interface Props {
  name: string;
  /** "2 מתוך 5". לא מוצג כשמישהו חוזר להציץ במילה */
  progress?: string;
  onConfirm: () => void;
  onExit?: () => void;
  onCancel?: () => void;
}

export default function PassScreen({ name, progress, onConfirm, onExit, onCancel }: Props) {
  return (
    <main className="screen">
      {onExit && <TopBar onExit={onExit} />}
      <div className="screen-body center">
        <p className="muted">{he.pass.passTo}</p>
        <p className="big-name">{name}</p>
        {progress && <p className="progress">{progress}</p>}
      </div>
      <div className="screen-actions">
        <button className="btn btn-primary" onClick={onConfirm}>
          {he.pass.iAm(name)}
        </button>
        {onCancel && (
          <button className="btn btn-ghost" onClick={onCancel}>
            {he.common.cancel}
          </button>
        )}
      </div>
    </main>
  );
}
