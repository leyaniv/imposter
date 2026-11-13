import type { Round, ScoredVote, WinReason, Winner } from './types';

/** נקודות לכל שחקן רגיל כשהשחקנים מנצחים (בטלפון אחד, ובמשחק המקוון רק בניחוש חופשי שגוי) */
export const CREW_POINTS = 1;
/** נקודות לכל מתחזה כשהמתחזים מנצחים */
export const IMPOSTER_POINTS = 3;
/** במשחק המקוון: מתחזה שהודח בהצבעה, והמתחזים ניצחו בכל זאת */
export const CAUGHT_IMPOSTER_POINTS = 2;
/** במשחק המקוון, על כל הצבעה שהדיחה מישהו: למי שצדק +1, למי שטעה -1 */
export const VOTE_POINTS = 1;
/** מי שפתח את ההצבעה: +2 אם צדק, -1 אם טעה. המטרה היא לעודד ללחוץ גם כשרק חושדים */
export const OPENER_RIGHT_POINTS = 2;
export const OPENER_WRONG_POINTS = 1;

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

/** אחרי הדחה, ניחוש שגוי, או שחקן שיצא: האם המשחק נגמר */
export function checkWinner(round: Round): Round {
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

/**
 * במשחק המקוון: הנקודות על הצבעה שהדיחה את targetId.
 * צדק = הצביע בעד הדחה של מתחזה, או נגד הדחה של שחקן רגיל. מתחזה לא מקבל נקודות על הצבעות,
 * אחרת הוא היה נענש על הצבעה נגד שחקן רגיל, כלומר על משחק טוב.
 */
export function scoreVote(
  round: Round,
  targetId: string,
  startedBy: string,
  votes: readonly { playerId: string; yes: boolean }[],
): ScoredVote {
  const imposter = isImposter(round, targetId);
  const ballots = votes.map(({ playerId, yes }) => {
    if (isImposter(round, playerId)) return { playerId, yes, points: 0 };
    const right = yes === imposter;
    const opener = playerId === startedBy;
    const points = right ? (opener ? OPENER_RIGHT_POINTS : VOTE_POINTS) : -(opener ? OPENER_WRONG_POINTS : VOTE_POINTS);
    return { playerId, yes, points };
  });
  return { targetId, imposter, startedBy, ballots };
}

/**
 * במשחק המקוון: הנקודות על סוף הסבב, בלי ההצבעות.
 * מתחזים שניצחו: 3, או 2 למי שהודח. שחקנים: נקודה רק בניחוש חופשי שגוי, כי בשאר הניצחונות הנקודות באות מההצבעות.
 */
export function onlineWinPoints(round: Round): Record<string, number> {
  if (round.winner === 'imposters') {
    return Object.fromEntries(
      round.imposterIds.map((id) => [id, round.eliminatedIds.includes(id) ? CAUGHT_IMPOSTER_POINTS : IMPOSTER_POINTS]),
    );
  }
  if (round.winReason === 'freeGuessWrong') {
    return Object.fromEntries(
      round.players.filter((player) => !isImposter(round, player.id)).map((player) => [player.id, CREW_POINTS]),
    );
  }
  return {};
}

/** במשחק המקוון: כל הנקודות של הסבב (הצבעות וסוף הסבב). רק בסבב שיש בו מנצח */
export function onlineRoundPoints(round: Round, votes: readonly ScoredVote[]): Record<string, number> {
  if (!round.winner) return {};
  let total = onlineWinPoints(round);
  for (const { playerId, points } of votes.flatMap((vote) => vote.ballots)) {
    if (points !== 0) total = addPoints(total, { [playerId]: points });
  }
  return total;
}

export function addPoints(scores: Record<string, number>, points: Record<string, number>): Record<string, number> {
  const result = { ...scores };
  for (const [id, n] of Object.entries(points)) result[id] = (result[id] ?? 0) + n;
  return result;
}
