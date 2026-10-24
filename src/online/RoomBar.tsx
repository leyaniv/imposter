import TopBar from '../components/TopBar';
import { he } from '../i18n/he';
import MuteButton from './MuteButton';

interface Props {
  isHost: boolean;
  onManage: () => void;
  onAskLeave: () => void;
}

/** הפס העליון במסכי הסבב: השתקה, ניהול החדר (רק למארח) ויציאה */
export default function RoomBar({ isHost, onManage, onAskLeave }: Props) {
  return (
    <TopBar onExit={onAskLeave}>
      <MuteButton />
      {isHost && (
        <button className="icon-btn" aria-label={he.online.host.manage} onClick={onManage}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            {[6, 12, 18].map((y) => (
              <circle key={y} cx="12" cy={y} r="1.9" fill="currentColor" />
            ))}
          </svg>
        </button>
      )}
    </TopBar>
  );
}
