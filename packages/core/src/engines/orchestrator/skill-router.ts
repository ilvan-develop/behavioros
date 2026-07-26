/**
 * BehaviorOS SkillRouter — Routes subtasks to the best-matching agent.
 *
 * Two-stage routing:
 *   1. DNA-based match (match task domain to DNA pattern personas)
 *   2. Capability-based match (match skill name to agent's declared skills)
 *   3. Semantic fallback (check similar skill names)
 *   4. Escalation if ALL fail
 *
 * Part of the AutonomousOrchestrator engine (Phase 2).
 */

import type { RejectionReason, SubTask, TaskRoute } from '@behavioros/schemas';
import type { SkillEngine } from '../skill-engine';

// ============================================================
// Types
// ============================================================

/**
 * AgentDescriptor — Configuration and options interface.
 */
export interface AgentDescriptor {
  id: string;
  skills: string[];
  proficiency?: number;
}

/**
 * RoutingResult — Configuration and options interface.
 */
export interface RoutingResult {
  status: 'routed' | 'rejected' | 'escalation';
  route?: TaskRoute;
  reason?: RejectionReason;
}

/**
 * RouteMatch — Configuration and options interface.
 */
export interface RouteMatch {
  agent: string;
  confidence: number;
  strategy: 'dna-match' | 'capability-match' | 'semantic-fallback';
}

/**
 * SkillRouterOptions — Configuration and options interface.
 */
export interface SkillRouterOptions {
  /** Minimum confidence to consider a match valid */
  minConfidence?: number;
}

// ============================================================
// SkillRouter
// ============================================================

/**
 * SkillRouter — ============================================================.
 */
export class SkillRouter {
  private minConfidence: number;

  constructor(
    private skillEngine: SkillEngine,
    options: SkillRouterOptions = {},
  ) {
    this.minConfidence = options.minConfidence ?? 0.5;
  }

  /**
   * Route a subtask to the best-matching agent.
   * Uses a two-stage + fallback strategy.
   */
  async route(subtask: SubTask, availableAgents: AgentDescriptor[]): Promise<RoutingResult> {
    // If no agents available, escalate immediately
    if (!availableAgents || availableAgents.length === 0) {
      return {
        status: 'escalation',
        reason: {
          code: 'out-of-scope',
          details: 'No agents available to route this subtask',
          suggestion: 'Configure at least one agent capable of this skill',
          requiredSkill: subtask.requiredSkill,
        },
      };
    }

    // Stage 1: DNA-based match — match task domain to agent skills via engine
    const dnaMatch = await this.findDnaMatch(subtask.requiredSkill, availableAgents);
    if (dnaMatch && dnaMatch.confidence >= this.minConfidence) {
      return {
        status: 'routed',
        route: {
          subtaskId: subtask.id,
          agentId: dnaMatch.agent,
          confidence: dnaMatch.confidence,
          strategy: 'dna-match',
        },
      };
    }

    // Stage 2: Capability-based match — exact skill name match
    const capabilityMatch = this.findCapabilityMatch(subtask.requiredSkill, availableAgents);
    if (capabilityMatch && capabilityMatch.confidence >= this.minConfidence) {
      return {
        status: 'routed',
        route: {
          subtaskId: subtask.id,
          agentId: capabilityMatch.agent,
          confidence: capabilityMatch.confidence,
          strategy: 'capability-match',
        },
      };
    }

    // Stage 3: Semantic fallback — check similar skill names
    const semanticMatch = this.findSemanticMatch(subtask.requiredSkill, availableAgents);
    if (semanticMatch && semanticMatch.confidence >= this.minConfidence) {
      return {
        status: 'routed',
        route: {
          subtaskId: subtask.id,
          agentId: semanticMatch.agent,
          confidence: semanticMatch.confidence,
          strategy: 'semantic-fallback',
        },
      };
    }

    // Stage 4: All failed — escalation with suggestions
    const suggestions = this.buildSuggestions(subtask.requiredSkill, availableAgents);
    return {
      status: 'escalation',
      reason: {
        code: 'missing-skill',
        details: `No agent found with skill: ${subtask.requiredSkill}`,
        suggestion: suggestions.length > 0 ? suggestions[0] : undefined,
        requiredSkill: subtask.requiredSkill,
      },
    };
  }

  /**
   * Route a single subtask by trying all agents.
   * Returns the best match or null.
   */
  async routeSubtask(subtask: SubTask, agents: AgentDescriptor[]): Promise<RoutingResult> {
    return this.route(subtask, agents);
  }

  // ─── Private Match Methods ─────────────────────────────────

  /**
   * Stage 1: DNA-based match — use SkillEngine to resolve the skill
   * for each available agent.
   */
  private async findDnaMatch(
    requiredSkill: string,
    agents: AgentDescriptor[],
  ): Promise<RouteMatch | null> {
    let bestMatch: RouteMatch | null = null;

    for (const agent of agents) {
      try {
        const result = await this.skillEngine.resolve(agent.id, requiredSkill);
        if (result.hasSkill && result.proficiency) {
          const confidence = result.proficiency / 5; // Normalize 1-5 to 0.2-1.0
          if (
            confidence >= this.minConfidence &&
            (!bestMatch || confidence > bestMatch.confidence)
          ) {
            bestMatch = {
              agent: agent.id,
              confidence,
              strategy: 'dna-match',
            };
          }
        }
      } catch {}
    }

    return bestMatch;
  }

  /**
   * Stage 2: Capability-based match — check if agent declares the skill.
   */
  private findCapabilityMatch(requiredSkill: string, agents: AgentDescriptor[]): RouteMatch | null {
    let bestMatch: RouteMatch | null = null;

    for (const agent of agents) {
      const hasExact = agent.skills.some((s) => s.toLowerCase() === requiredSkill.toLowerCase());
      if (hasExact) {
        const proficiencyBonus = agent.proficiency ? agent.proficiency / 10 : 0;
        const confidence = Math.min(0.6 + proficiencyBonus, 1.0);
        if (!bestMatch || confidence > bestMatch.confidence) {
          bestMatch = {
            agent: agent.id,
            confidence,
            strategy: 'capability-match',
          };
        }
      }
    }

    return bestMatch;
  }

  /**
   * Stage 3: Semantic fallback — check similar skill names.
   * Uses simple substring/prefix/suffix matching.
   */
  private findSemanticMatch(requiredSkill: string, agents: AgentDescriptor[]): RouteMatch | null {
    let bestMatch: RouteMatch | null = null;
    const normalizedReq = requiredSkill.toLowerCase().replace(/[-_]/g, '');

    for (const agent of agents) {
      for (const skill of agent.skills) {
        const normalizedSkill = skill.toLowerCase().replace(/[-_]/g, '');

        // Check if the skill is a substring match or has shared tokens
        const confidence = this.computeSemanticSimilarity(normalizedReq, normalizedSkill);
        if (confidence >= this.minConfidence && (!bestMatch || confidence > bestMatch.confidence)) {
          bestMatch = {
            agent: agent.id,
            confidence,
            strategy: 'semantic-fallback',
          };
        }
      }
    }

    return bestMatch;
  }

  /**
   * Compute a simple semantic similarity score between two strings.
   * Returns a value between 0 and 1.
   */
  private computeSemanticSimilarity(a: string, b: string): number {
    // Exact match (after normalization)
    if (a === b) return 1.0;

    // One contains the other
    if (a.includes(b) || b.includes(a)) return 0.8;

    // Token-based similarity
    const tokensA = a.split(/-|_|\s+/).filter(Boolean);
    const tokensB = b.split(/-|_|\s+/).filter(Boolean);
    const common = tokensA.filter((t) => tokensB.includes(t));
    if (common.length > 0) {
      const maxLen = Math.max(tokensA.length, tokensB.length);
      return common.length / maxLen;
    }

    // Prefix match
    if (a.startsWith(b) || b.startsWith(a)) return 0.5;

    return 0;
  }

  /**
   * Build suggestions when no match is found.
   */
  private buildSuggestions(requiredSkill: string, agents: AgentDescriptor[]): string[] {
    const suggestions: string[] = [];
    const normalizedReq = requiredSkill.toLowerCase();

    for (const agent of agents) {
      for (const skill of agent.skills) {
        const normalizedSkill = skill.toLowerCase();
        const distance = this.levenshteinDistance(normalizedReq, normalizedSkill);
        const maxLen = Math.max(normalizedReq.length, normalizedSkill.length);
        const similarity = maxLen > 0 ? 1 - distance / maxLen : 0;

        if (similarity > 0.3) {
          suggestions.push(
            `Agent "${agent.id}" has skill "${skill}" (${Math.round(similarity * 100)}% similar)`,
          );
        }
      }
    }

    // If no suggestions found, recommend installing the skill
    if (suggestions.length === 0) {
      suggestions.push(`Consider installing a skill for "${requiredSkill}"`);
      if (agents.length > 0) {
        suggestions.push(`Existing agents: ${agents.map((a) => `"${a.id}"`).join(', ')}`);
      }
    }

    return suggestions.slice(0, 3); // Max 3 suggestions
  }

  /**
   * Compute Levenshtein distance between two strings.
   */
  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0]![j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b[i - 1] === a[j - 1]) {
          matrix[i]![j] = matrix[i - 1]![j - 1]!;
        } else {
          matrix[i]![j] = Math.min(
            matrix[i - 1]![j - 1]! + 1, // substitution
            matrix[i]![j - 1]! + 1, // insertion
            matrix[i - 1]![j]! + 1, // deletion
          );
        }
      }
    }

    return matrix[b.length]![a.length]!;
  }
}
