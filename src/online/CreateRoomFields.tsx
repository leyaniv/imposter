import { useState, type FormEvent } from 'react';
import GameSettingsFields from '../components/GameSettingsFields';
import { MAX_PLAYERS } from '../game/setup';
import { he } from '../i18n/he';
import type { LocalSetup } from '../screens/LocalSetupFields';
import { MAX_NAME_LENGTH } from './protocol';
import SecretVoteToggle from './SecretVoteToggle';

interface Props {
  local: LocalSetup;
  name: string;
  secretVote: boolean;
  onSecretVote: (secretVote: boolean) => void;
  error?: string;
  busy: boolean;
  onCreate: (name: string) => void;
}

/** משחק מקוון לפני שיש חדר: השם של המארח, "פתיחת חדר", וההגדרות (אותן הגדרות של המשחק המקומי) */
export default function CreateRoomFields({ local, name: savedName, secretVote, onSecretVote, error, busy, onCreate }: Props) {
  const [name, setName] = useState(savedName);
  const hasName = name.trim().length > 0;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (hasName && !busy) onCreate(name);
  };

  return (
    <>
      <form className="field create-room" onSubmit={submit}>
        <label className="field">
          <span className="label">{he.newGame.yourName}</span>
          <input
            className="input"
            value={name}
            placeholder={he.online.namePlaceholder}
            maxLength={MAX_NAME_LENGTH}
            autoComplete="nickname"
            enterKeyHint="go"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        {error && (
          <p className="help warn" role="alert">
            {error}
          </p>
        )}
        <button className="btn btn-secondary" type="submit" disabled={!hasName || busy}>
          {he.newGame.openRoom}
        </button>
        <p className="help">{he.newGame.openRoomHelp}</p>
      </form>

      <GameSettingsFields
        settings={local.settings}
        // עוד לא ידוע כמה יצטרפו. השרת מגביל לשני מתחזים רק מ-7 שחקנים
        playerCount={MAX_PLAYERS}
        allCategories={local.allCategories}
        onChange={local.onChange}
      />
      <SecretVoteToggle checked={secretVote} onChange={onSecretVote} />
    </>
  );
}
