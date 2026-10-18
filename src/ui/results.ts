import type { Round } from '../game/types';
import { he } from '../i18n/he';

/** "ניצחון לשחקנים!" / "ניצחון למתחזה!", או ריק כשעוד לא ידוע */
export function winnerTitle(round: Round): string {
  if (!round.winner) return '';
  return round.winner === 'crew' ? he.winner.crew : he.winner.imposters(round.imposterIds.length);
}

/** למה הסבב נגמר, למשל "תפסו את המתחזה" */
export function winReasonText(round: Round): string {
  if (!round.winReason) return '';
  return he.winner.reason[round.winReason](round.imposterIds.length);
}
