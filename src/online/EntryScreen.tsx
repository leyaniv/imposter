import { useState, type FormEvent } from 'react';
import StickyActions from '../components/StickyActions';
import TopBar from '../components/TopBar';
import { he } from '../i18n/he';
import { CODE_LENGTH, MAX_NAME_LENGTH, formatCode, isRoomCode } from './protocol';

const FORM_ID = 'join-room';

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
  const [codeFocused, setCodeFocused] = useState(false);
  const hasName = name.trim().length > 0;
  const fromLink = isRoomCode(linkCode);
  const target = fromLink ? linkCode : code;

  const join = (e: FormEvent) => {
    e.preventDefault();
    if (hasName && isRoomCode(target)) onJoin(target, name);
  };

  return (
    <main className="screen">
      {/* כמו "משחק חדש": הכותרת, ההגדרות וה-X בשורה העליונה, וכפתור הפעולה בתחתית */}
      <TopBar onExit={onBack} exitLabel={he.newGame.exit} settingsFrom="setup" className="top-bar-titled">
        <h1 className="heading">{he.home.join}</h1>
      </TopBar>

      <form id={FORM_ID} className="screen-body" onSubmit={join}>

        <label className="field-inline">
          <span className="label">{he.newGame.yourName}</span>
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

        {/* מקישור: הקוד כבר ידוע, אז מראים אותו בשורה משלו (בכותרת הוא לא נכנס ליד הכפתורים) */}
        {fromLink ? (
          <div className="field-inline">
            <span className="label">{he.online.code}</span>
            <span className="room-code-inline" dir="ltr">
              {formatCode(linkCode)}
            </span>
            <button className="link-btn link-muted link-end" type="button" onClick={onClearCode}>
              {he.online.otherRoom}
            </button>
          </div>
        ) : (
          <label className="field">
            <span className="label">{he.online.code}</span>
            {/* שדה אחד שקוף מעל שש קופסאות: הקלדה, מחיקה והדבקה עובדים כמו בשדה רגיל, בלי לקפוץ בין שדות */}
            <span className="code-cells">
              <input
                className="code-cells-input"
                value={code}
                inputMode="numeric"
                autoComplete="off"
                enterKeyHint="go"
                maxLength={CODE_LENGTH}
                autoFocus={!!savedName}
                onFocus={() => setCodeFocused(true)}
                onBlur={() => setCodeFocused(false)}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))}
              />
              {Array.from({ length: CODE_LENGTH }, (_, i) => (
                <span
                  key={i}
                  aria-hidden="true"
                  className={`code-cell${codeFocused && i === Math.min(code.length, CODE_LENGTH - 1) ? ' code-cell-active' : ''}`}
                >
                  {code[i] ?? ''}
                </span>
              ))}
            </span>
          </label>
        )}

        {error && (
          <p className="help warn" role="alert">
            {error}
          </p>
        )}

      </form>

      {/* כשמקלידים שם או קוד, הכפתור עולה מעל המקלדת ולא נשאר מתחתיה */}
      <StickyActions aboveKeyboard>
        {/* מחוץ לטופס, ומחובר אליו דרך form, כדי שיישב בתחתית */}
        <button className="btn btn-primary" type="submit" form={FORM_ID} disabled={!hasName || !isRoomCode(target)}>
          {he.online.join}
        </button>
      </StickyActions>
    </main>
  );
}
