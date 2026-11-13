import { he } from '../i18n/he';
import type { RoundState } from './protocol';

interface Props {
  round: RoundState;
  you: string;
}

/** סוף הסבב: מאיפה הגיעה כל נקודה. כל הצבעה שהדיחה מישהו, מה כל אחד הצביע, ומה קיבל */
export default function ScoringBreakdown({ round, you }: Props) {
  const scoring = round.reveal?.scoring;
  const winIds = Object.keys(scoring?.win ?? {});
  if (!scoring || (scoring.votes.length === 0 && winIds.length === 0)) return null;

  const nameOf = (id: string) => round.players.find((player) => player.id === id)?.name ?? '';
  const imposterIds = new Set(round.reveal!.imposters.map((imposter) => imposter.id));
  const points = (n: number) => (
    <span className={`score-gain${n < 0 ? ' score-loss' : ''}`}>{he.scores.gain(n)}</span>
  );

  return (
    <details className="result-card scoring">
      <summary className="label">{he.online.scoring.title}</summary>
      {scoring.votes.map((vote, index) => (
        <section key={index} className="scoring-group">
          <p className="scoring-title">{he.online.scoring.vote(nameOf(vote.targetId), vote.imposter)}</p>
          <ul className="scoring-list">
            {vote.ballots.map(({ playerId, yes, points: n }) => (
              <li key={playerId} className={playerId === you ? 'scoring-me' : undefined}>
                <span className="score-name">
                  {nameOf(playerId)}
                  {imposterIds.has(playerId) && <span className="muted"> · {he.online.scoring.imposter}</span>}
                </span>
                <span className={`vote-mark ${yes ? 'vote-yes' : 'vote-no'}`}>
                  {yes ? he.online.vote.yes : he.online.vote.no}
                  {playerId === vote.startedBy && ` · ${he.online.scoring.opened}`}
                </span>
                {imposterIds.has(playerId) ? (
                  <span className="muted" title={he.online.scoring.imposterNoPoints}>
                    —
                  </span>
                ) : (
                  points(n)
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
      {winIds.length > 0 && (
        <section className="scoring-group">
          <p className="scoring-title">{he.online.scoring.win}</p>
          <ul className="scoring-list">
            {winIds.map((id) => (
              <li key={id} className={id === you ? 'scoring-me' : undefined}>
                <span className="score-name">{nameOf(id)}</span>
                {points(scoring.win[id])}
              </li>
            ))}
          </ul>
        </section>
      )}
    </details>
  );
}
