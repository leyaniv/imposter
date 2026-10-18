import type { Player } from '../game/types';
import { he } from '../i18n/he';

export function displayName(player: Player, index: number): string {
  return player.name || he.playerFallback(index + 1);
}
