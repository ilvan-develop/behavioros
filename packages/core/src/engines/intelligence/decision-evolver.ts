import crypto from 'node:crypto';

/**
 * WeightedVote — Configuration and options interface.
 */
export interface WeightedVote {
  agentId: string;
  choice: string;
  weight: number;
  rationale?: string;
}

/**
 * DecisionResult — Configuration and options interface.
 */
export interface DecisionResult {
  id: string;
  question: string;
  choices: string[];
  votes: WeightedVote[];
  winner: string;
  score: number;
  quorumReached: boolean;
  vetoed: boolean;
  decidedAt: string;
}

/**
 * DecisionEvolver — decision evolver.
 *
 * Methods: decide.
 */
export class DecisionEvolver {
  decide(
    question: string,
    choices: string[],
    votes: WeightedVote[],
    quorum: number = 0.5,
  ): DecisionResult {
    const totalWeight = votes.reduce((sum, v) => sum + v.weight, 0);
    const quorumReached = totalWeight >= quorum;

    const scores = new Map<string, number>();
    for (const choice of choices) {
      scores.set(choice, 0);
    }

    for (const vote of votes) {
      const current = scores.get(vote.choice) ?? 0;
      scores.set(vote.choice, current + vote.weight);
    }

    let winner = '';
    let maxScore = 0;
    let tie = false;
    for (const [choice, score] of scores) {
      if (score > maxScore) {
        maxScore = score;
        winner = choice;
        tie = false;
      } else if (score === maxScore && score > 0) {
        tie = true;
      }
    }

    const vetoed = !quorumReached;
    if (tie || !quorumReached) {
      winner = '';
    }

    return {
      id: crypto.randomUUID(),
      question,
      choices,
      votes,
      winner,
      score: maxScore,
      quorumReached,
      vetoed,
      decidedAt: new Date().toISOString(),
    };
  }
}
