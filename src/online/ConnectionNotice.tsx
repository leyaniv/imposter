import { he } from '../i18n/he';
import type { ConnectionStatus } from './connection';

/** "מתחברים מחדש..." כשהחיבור לשרת נפל. בלי זה, המסך נראה תקין אבל לא מתעדכן */
export default function ConnectionNotice({ status }: { status: ConnectionStatus }) {
  if (status === 'open') return null;
  return (
    <p className="notice connection-notice" role="status">
      {status === 'connecting' ? he.online.connecting : he.online.reconnecting}
    </p>
  );
}
