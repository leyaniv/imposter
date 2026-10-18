import type { Round, WinReason, Winner } from './types';

/** נקודות לכל שחקן רגיל כשהשחקנים מנצחים */
export const CREW_POINTS = 1;
/** נקודות לכל מתחזה כשהמתחזים מנצחים */
export const IMPOSTER_POINTS = 3;

export function isImposter(round: Round, playerId: string): boolean {
  return round.imposterIds.includes(playerId);
}

function stillIn(round: Round, playerId: string): boolean {
  return !round.eliminatedIds.includes(playerId);
}

/** כמה מתחזים וכמה שחקנים רגילים עוד במשחק */
export function remaining(round: Round): { imposters: number; crew: number } {
  const active = round.players.filter((player) => stillIn(round, player.id));
  const imposters = active.filter((player) => isImposter(round, player.id)).length;
  return { imposters, crew: active.length - imposters };
}

/** האם השחקנים יכולים להדיח את השחקן הזה עכשיו */
export function canEliminate(round: Round, playerId: string): boolean {
  return (
    !round.winner &&
    !round.revealedId &&
    round.players.some((player) => player.id === playerId) &&
    stillIn(round, playerId)
  );
}

function win(round: Round, winner: Winner, winReason: WinReason): Round {
  return { ...round, winner, winReason, guessPending: undefined };
}

/** אחרי הדחה או ניחוש שגוי: האם המשחק נגמר */
function checkWinner(round: Round): Round {
  const { imposters, crew } = remaining(round);
  if (imposters === 0) return win(round, 'crew', 'allCaught');
  if (imposters >= crew) return win(round, 'imposters', 'outnumbered');
  return round;
}

/**
 * השחקנים הדיחו מישהו בהצבעה.
 * מתחזה שהודח מקבל ניחוש אחרון, ורק אחריו בודקים אם המשחק נגמר.
 */
export function eliminate(round: Round, playerId: string): Round {
  if (!canEliminate(round, playerId)) return round;
  const next: Round = { ...round, eliminatedIds: [...round.eliminatedIds, playerId], revealedId: playerId };
  if (isImposter(round, playerId)) return { ...next, guessPending: true };
  return checkWinner(next);
}

/** הניחוש האחרון של מתחזה שהודח. השחקנים (שיודעים את המילה) קובעים אם הוא נכון */
export function resolveLastGuess(round: Round, correct: boolean): Round {
  if (!round.guessPending || round.winner) return round;
  if (correct) return win(round, 'imposters', 'lastGuess');
  return checkWinner({ ...round, guessPending: undefined });
}

/** אחרי שראו מי הודח, והמשחק ממשיך */
export function dismissReveal(round: Round): Round {
  if (!round.revealedId || round.guessPending || round.winner) return round;
  return { ...round, revealedId: undefined };
}

/** מתחזה הכריז שהוא יודע את המילה. נכון = המתחזים מנצחים, שגוי = השחקנים מנצחים */
export function freeGuess(round: Round, correct: boolean): Round {
  if (round.winner || round.guessPending) return round;
  return {
    ...win(round, correct ? 'imposters' : 'crew', correct ? 'freeGuessRight' : 'freeGuessWrong'),
    revealedId: undefined,
  };
}

/** השחקנים סימנו בסוף הסבב מי ניצח, כשהאפליקציה לא יודעת לבד */
export function declareWinner(round: Round, winner: Winner): Round {
  if (round.winner) return round;
  return win(round, winner, 'manual');
}

/** כמה נקודות כל שחקן קיבל בסבב הזה (רק מי שקיבל) */
export function roundPoints(round: Round): Record<string, number> {
  if (!round.winner) return {};
  const winners = round.players.filter((player) => isImposter(round, player.id) === (round.winner === 'imposters'));
  const points = round.winner === 'imposters' ? IMPOSTER_POINTS : CREW_POINTS;
  return Object.fromEntries(winners.map((player) => [player.id, points]));
}

export function addPoints(scores: Record<string, number>, points: Record<string, number>): Record<string, number> {
  const result = { ...scores };
  for (const [id, n] of Object.entries(points)) result[id] = (result[id] ?? 0) + n;
  return result;
}
