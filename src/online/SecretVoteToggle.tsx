import { he } from '../i18n/he';

/** "הצבעה חשאית": הגדרה שקיימת רק במשחק מקוון */
export default function SecretVoteToggle({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <div className="field">
      <label className="toggle">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span>{he.online.lobby.secretVote}</span>
      </label>
      <p className="help">{he.online.lobby.secretVoteHelp}</p>
    </div>
  );
}
