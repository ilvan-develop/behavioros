/**
 * BehaviorOS AutonomousDecomposer — Breaks high-level missions into
 * granular subtasks based on mission type. Each mission type has a
 * deterministic decomposition pattern.
 *
 * Part of the AutonomousOrchestrator engine (Phase 2).
 */

import { randomUUID } from 'node:crypto';
import type { SubTask } from '@behavioros/schemas';

// ============================================================
// Types
// ============================================================

/**
 * DecomposerOptions — Configuration and options interface.
 */
export interface DecomposerOptions {
  /** Optional DNA pattern to influence decomposition */
  dna?: Record<string, unknown>;
}

/**
 * MissionType — Union type: feature, bugfix, refactor, security, deploy, research;.
 */
export type MissionType = 'feature' | 'bugfix' | 'refactor' | 'security' | 'deploy' | 'research';

/**
 * MissionInput — Configuration and options interface.
 */
export interface MissionInput {
  title: string;
  type: MissionType;
  description?: string;
}

// ============================================================
// AutonomousDecomposer
// ============================================================

/**
 * AutonomousDecomposer — ============================================================.
 */
export class AutonomousDecomposer {
  constructor(private options: DecomposerOptions = {}) {}

  /**
   * Decompose a high-level mission into granular subtasks.
   * The decomposition strategy depends on mission type.
   */
  async decompose(mission: MissionInput, dna?: Record<string, unknown>): Promise<SubTask[]> {
    const activeDna = dna ?? this.options.dna;

    switch (mission.type) {
      case 'feature':
        return this.decomposeFeature(mission.title, mission.description, activeDna);
      case 'bugfix':
        return this.decomposeBugfix(mission.title, mission.description, activeDna);
      case 'refactor':
        return this.decomposeRefactor(mission.title, mission.description, activeDna);
      case 'security':
        return this.decomposeSecurity(mission.title, mission.description, activeDna);
      case 'deploy':
        return this.decomposeDeploy(mission.title, mission.description, activeDna);
      case 'research':
        return this.decomposeResearch(mission.title, mission.description, activeDna);
      default: {
        // Fallback: treat as feature
        return this.decomposeFeature(mission.title, mission.description, activeDna);
      }
    }
  }

  // ─── Feature Decomposition ──────────────────────────────────

  /**
   * Feature: design → implementation → testing → documentation → review → security → deployment
   */
  private decomposeFeature(
    title: string,
    desc?: string,
    _dna?: Record<string, unknown>,
  ): SubTask[] {
    const baseDescription = desc ?? `Implement feature: ${title}`;

    return [
      this.createSubtask('design', 'task-decomposition', {
        title: `Design: ${title}`,
        description: `Create architectural design and specifications for: ${baseDescription}`,
      }),
      this.createSubtask(
        'implementation',
        title.includes('api') ? 'api-development' : 'development',
        {
          title: `Implement: ${title}`,
          description: `Implement the feature: ${baseDescription}`,
        },
      ),
      this.createSubtask('testing', 'quality-assurance', {
        title: `Test: ${title}`,
        description: `Write and execute tests for: ${baseDescription}`,
      }),
      this.createSubtask('documentation', 'technical-writing', {
        title: `Document: ${title}`,
        description: `Document the implementation of: ${baseDescription}`,
      }),
      this.createSubtask('review', 'code-review', {
        title: `Review: ${title}`,
        description: `Peer review the implementation of: ${baseDescription}`,
      }),
      this.createSubtask('security', 'security-review', {
        title: `Security: ${title}`,
        description: `Security review for: ${baseDescription}`,
      }),
      this.createSubtask('deployment', 'devops', {
        title: `Deploy: ${title}`,
        description: `Deploy the implementation of: ${baseDescription}`,
      }),
    ];
  }

  // ─── Bugfix Decomposition ──────────────────────────────────

  /**
   * Bugfix: diagnosis → fix → testing → documentation (changelog) → review
   */
  private decomposeBugfix(title: string, desc?: string, _dna?: Record<string, unknown>): SubTask[] {
    const baseDescription = desc ?? `Fix bug: ${title}`;

    return [
      this.createSubtask('design', 'diagnosis', {
        title: `Diagnose: ${title}`,
        description: `Root cause analysis for: ${baseDescription}`,
      }),
      this.createSubtask('implementation', 'bug-fixing', {
        title: `Fix: ${title}`,
        description: `Implement the fix for: ${baseDescription}`,
      }),
      this.createSubtask('testing', 'quality-assurance', {
        title: `Verify: ${title}`,
        description: `Verify the fix resolves: ${baseDescription}`,
      }),
      this.createSubtask('documentation', 'technical-writing', {
        title: `Changelog: ${title}`,
        description: `Document the bugfix in changelog: ${baseDescription}`,
      }),
      this.createSubtask('review', 'code-review', {
        title: `Review fix: ${title}`,
        description: `Peer review the bugfix for: ${baseDescription}`,
      }),
    ];
  }

  // ─── Refactor Decomposition ────────────────────────────────

  /**
   * Refactor: analysis → restructure → testing → documentation → review
   */
  private decomposeRefactor(
    title: string,
    desc?: string,
    _dna?: Record<string, unknown>,
  ): SubTask[] {
    const baseDescription = desc ?? `Refactor: ${title}`;

    return [
      this.createSubtask('design', 'code-analysis', {
        title: `Analyze: ${title}`,
        description: `Analyze the codebase to plan refactoring: ${baseDescription}`,
      }),
      this.createSubtask('implementation', 'refactoring', {
        title: `Restructure: ${title}`,
        description: `Restructure the code for: ${baseDescription}`,
      }),
      this.createSubtask('testing', 'quality-assurance', {
        title: `Test: ${title}`,
        description: `Ensure existing behavior is preserved after: ${baseDescription}`,
      }),
      this.createSubtask('documentation', 'technical-writing', {
        title: `Document: ${title}`,
        description: `Document the structural changes: ${baseDescription}`,
      }),
      this.createSubtask('review', 'code-review', {
        title: `Review: ${title}`,
        description: `Peer review the refactoring: ${baseDescription}`,
      }),
    ];
  }

  // ─── Security Decomposition ────────────────────────────────

  /**
   * Security: scan → triage → fix → verify → documentation → report
   */
  private decomposeSecurity(
    title: string,
    desc?: string,
    _dna?: Record<string, unknown>,
  ): SubTask[] {
    const baseDescription = desc ?? `Security: ${title}`;

    return [
      this.createSubtask('security', 'security-scanning', {
        title: `Scan: ${title}`,
        description: `Run security scan for: ${baseDescription}`,
      }),
      this.createSubtask('security', 'security-triage', {
        title: `Triage: ${title}`,
        description: `Triage security findings for: ${baseDescription}`,
      }),
      this.createSubtask('implementation', 'security-fix', {
        title: `Fix: ${title}`,
        description: `Apply security fixes for: ${baseDescription}`,
      }),
      this.createSubtask('testing', 'security-verification', {
        title: `Verify: ${title}`,
        description: `Verify security fixes resolve: ${baseDescription}`,
      }),
      this.createSubtask('documentation', 'technical-writing', {
        title: `Document: ${title}`,
        description: `Document security findings and fixes: ${baseDescription}`,
      }),
      this.createSubtask('review', 'security-review', {
        title: `Report: ${title}`,
        description: `Generate security report for: ${baseDescription}`,
      }),
    ];
  }

  // ─── Deploy Decomposition ──────────────────────────────────

  /**
   * Deploy: build → staging-test → health-check → rollback-plan → deploy
   */
  private decomposeDeploy(title: string, desc?: string, _dna?: Record<string, unknown>): SubTask[] {
    const baseDescription = desc ?? `Deploy: ${title}`;

    return [
      this.createSubtask('deployment', 'build', {
        title: `Build: ${title}`,
        description: `Build artifacts for: ${baseDescription}`,
      }),
      this.createSubtask('testing', 'staging-test', {
        title: `Staging: ${title}`,
        description: `Run staging tests for: ${baseDescription}`,
      }),
      this.createSubtask('deployment', 'health-check', {
        title: `Health: ${title}`,
        description: `Health check verification for: ${baseDescription}`,
      }),
      this.createSubtask('documentation', 'devops', {
        title: `Rollback plan: ${title}`,
        description: `Document rollback plan for: ${baseDescription}`,
      }),
      this.createSubtask('deployment', 'devops', {
        title: `Deploy: ${title}`,
        description: `Execute deployment for: ${baseDescription}`,
      }),
    ];
  }

  // ─── Research Decomposition ────────────────────────────────

  /**
   * Research: literature-review → analysis → findings → recommendations
   */
  private decomposeResearch(
    title: string,
    desc?: string,
    _dna?: Record<string, unknown>,
  ): SubTask[] {
    const baseDescription = desc ?? `Research: ${title}`;

    return [
      this.createSubtask('implementation', 'research', {
        title: `Literature review: ${title}`,
        description: `Review existing literature and resources for: ${baseDescription}`,
      }),
      this.createSubtask('design', 'analysis', {
        title: `Analysis: ${title}`,
        description: `Analyze findings for: ${baseDescription}`,
      }),
      this.createSubtask('documentation', 'technical-writing', {
        title: `Findings: ${title}`,
        description: `Document research findings for: ${baseDescription}`,
      }),
      this.createSubtask('review', 'research-review', {
        title: `Recommendations: ${title}`,
        description: `Provide recommendations based on: ${baseDescription}`,
      }),
    ];
  }

  // ─── Helpers ───────────────────────────────────────────────

  private createSubtask(
    type: SubTask['type'],
    requiredSkill: string,
    overrides: Partial<SubTask> = {},
  ): SubTask {
    return {
      id: randomUUID(),
      title: overrides.title ?? 'Untitled subtask',
      type,
      requiredSkill,
      status: 'pending',
      ...overrides,
    };
  }
}
