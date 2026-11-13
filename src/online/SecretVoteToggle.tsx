import HelpRow from '../components/HelpRow';
import { he } from '../i18n/he';

/** "הצבעה חשאית": הגדרה שקיימת רק במשחק מקוון */
export default function SecretVoteToggle({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <HelpRow label={he.settings.helpLabel(he.online.lobby.secretVote)} help={he.online.lobby.secretVoteHelp}>
      <label className="toggle">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span>{he.online.lobby.secretVote}</span>
      </label>
    </HelpRow>
  );
}
