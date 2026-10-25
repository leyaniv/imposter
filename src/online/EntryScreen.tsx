import { useState, type FormEvent } from 'react';
import { he } from '../i18n/he';
import { CODE_LENGTH, MAX_NAME_LENGTH, formatCode, isRoomCode } from './protocol';

interface Props {
  /** קוד מהקישור (?room=). ריק = מקלידים קוד */
  code: string;
  name: string;
  error?: string;
  onJoin: (code: string, name: string) => void;
  onClearCode: () => void;
  onBack: () => void;
}

/** הצטרפות לחדר: שם, ואם לא הגענו מקישור, גם קוד */
export default function EntryScreen({ code: linkCode, name: savedName, error, onJoin, onClearCode, onBack }: Props) {
  const [name, setName] = useState(savedName);
  const [code, setCode] = useState('');
  const hasName = name.trim().length > 0;
  const fromLink = isRoomCode(linkCode);
  const target = fromLink ? linkCode : code;

  const join = (e: FormEvent) => {
    e.preventDefault();
    if (hasName && isRoomCode(target)) onJoin(target, name);
  };

  return (
    <main className="screen">
      <form className="screen-body" onSubmit={join}>
        <h1 className="heading">{fromLink ? he.online.joinRoom(formatCode(linkCode)) : he.home.join}</h1>

        <label className="field">
          <span className="label">{he.online.name}</span>
          <input
            className="input"
            value={name}
            placeholder={he.online.namePlaceholder}
            maxLength={MAX_NAME_LENGTH}
            autoComplete="nickname"
            enterKeyHint={fromLink ? 'go' : 'next'}
            autoFocus={!savedName}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        {!fromLink && (
          <label className="field">
            <span className="label">{he.online.code}</span>
            <input
              className="input code-input"
              value={code}
              placeholder={he.online.codePlaceholder}
              inputMode="numeric"
              autoComplete="off"
              enterKeyHint="go"
              maxLength={CODE_LENGTH}
              autoFocus={!!savedName}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
          </label>
        )}

        {error && (
          <p className="help warn" role="alert">
            {error}
          </p>
        )}

        <div className="screen-actions">
          <button className="btn btn-primary" type="submit" disabled={!hasName || !isRoomCode(target)}>
            {he.online.join}
          </button>
          {fromLink && (
            <button className="link-btn link-muted" type="button" onClick={onClearCode}>
              {he.online.otherRoom}
            </button>
          )}
        </div>
      </form>

      <div className="screen-actions">
        <button className="btn btn-ghost" onClick={onBack}>
          {he.online.back}
        </button>
      </div>
    </main>
  );
}
