import { useState, type FormEvent } from 'react';
import { he } from '../i18n/he';
import { CODE_LENGTH, MAX_NAME_LENGTH, formatCode, isRoomCode } from './protocol';

interface Props {
  /** קוד מהקישור (?room=). ריק = אפשר לפתוח חדר או להקליד קוד */
  code: string;
  name: string;
  error?: string;
  busy: boolean;
  onCreate: (name: string) => void;
  onJoin: (code: string, name: string) => void;
  onClearCode: () => void;
}

/** פתיחת חדר או הצטרפות לחדר: שם, ואם צריך גם קוד */
export default function EntryScreen({ code: linkCode, name: savedName, error, busy, onCreate, onJoin, onClearCode }: Props) {
  const [name, setName] = useState(savedName);
  const [code, setCode] = useState('');
  const hasName = name.trim().length > 0;
  const fromLink = isRoomCode(linkCode);

  const join = (e: FormEvent) => {
    e.preventDefault();
    const target = fromLink ? linkCode : code;
    if (hasName && isRoomCode(target)) onJoin(target, name);
  };

  return (
    <main className="screen">
      <form className="screen-body" onSubmit={join}>
        <div className="field">
          <h1 className="heading">{fromLink ? he.online.joinRoom(formatCode(linkCode)) : he.online.title}</h1>
          {!fromLink && <p className="help">{he.online.intro}</p>}
        </div>

        <label className="field">
          <span className="label">{he.online.name}</span>
          <input
            className="input"
            value={name}
            placeholder={he.online.namePlaceholder}
            maxLength={MAX_NAME_LENGTH}
            autoComplete="nickname"
            enterKeyHint={fromLink ? 'go' : 'done'}
            autoFocus={!savedName}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        {error && (
          <p className="help warn" role="alert">
            {error}
          </p>
        )}

        {fromLink ? (
          <div className="screen-actions">
            <button className="btn btn-primary" type="submit" disabled={!hasName || busy}>
              {he.online.join}
            </button>
            <button className="link-btn link-muted" type="button" onClick={onClearCode}>
              {he.online.otherRoom}
            </button>
          </div>
        ) : (
          <>
            <button className="btn btn-primary" type="button" disabled={!hasName || busy} onClick={() => onCreate(name)}>
              {he.online.createRoom}
            </button>

            <div className="field">
              <span className="label">{he.online.or}</span>
              <div className="code-row">
                <input
                  className="input code-input"
                  value={code}
                  placeholder={he.online.codePlaceholder}
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={CODE_LENGTH}
                  aria-label={he.online.code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                />
                <button className="btn btn-secondary code-join" type="submit" disabled={!hasName || !isRoomCode(code) || busy}>
                  {he.online.join}
                </button>
              </div>
            </div>
          </>
        )}
      </form>

      <div className="screen-actions">
        <a className="btn btn-ghost link-home" href="./">
          {he.online.back}
        </a>
      </div>
    </main>
  );
}
