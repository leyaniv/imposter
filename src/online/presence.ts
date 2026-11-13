import { he } from '../i18n/he';
import type { RoomState } from './protocol';

/** offline: אין חיבור (לא נספר בהצבעה). away: מחובר, אבל הדף מוסתר */
export type Absence = 'away' | 'offline';

/**
 * מי לא נמצא כרגע מול המשחק, לפי playerId. לא כולל את הטלפון הזה: אם רואים את המסך, נמצאים,
 * ועל החיבור של הטלפון עצמו מודיע ConnectionNotice. מי שיצא מהחדר לא ברשימה (הוא כבר לא במשחק)
 */
export function absences(state: RoomState): Record<string, Absence> {
  const result: Record<string, Absence> = {};
  for (const player of state.players) {
    if (player.id === state.you) continue;
    if (!player.connected) result[player.id] = 'offline';
    else if (player.away) result[player.id] = 'away';
  }
  return result;
}

export function absenceLabel(absence: Absence): string {
  return he.online.presence[absence];
}

/** "יוסי (מנותק)", או רק השם כשהשחקן נמצא */
export function nameWithAbsence(name: string, absence: Absence | undefined): string {
  return absence ? he.online.presence.withStatus(name, absenceLabel(absence)) : name;
}
