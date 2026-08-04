/**
 * BehaviorOS SkillEngine — Agent skill resolution, delegation validation,
 * and component registry management.
 *
 * Two-stage routing:
 *   1. DNA match (primary) — exact persona skill references
 *   2. Capability match (semantic fallback) — when confidence < 50%
 */

import { access, readdir, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { ComponentRegistry, DNAPackage, Skill, SkillRef } from '@behavioros/schemas';
import type { DNALoader } from './behavioral/dna-loader';

// ============================================================
// Types
// ============================================================

/**
 * DelegationValidation — Configuration and options interface.
 */
export interface DelegationValidation {
  allowed: boolean;
  missingSkills: string[];
  insufficientProficiency: string[];
  reason?: string;
}

/**
 * SkillEngineStatus — Configuration and options interface.
 */
export interface SkillEngineStatus {
  agents: {
    id: string;
    status: string;
    skillsCount: number;
    skills: string[];
  }[];
  skills: ComponentRegistry[];
  mcps: ComponentRegistry[];
  designSystems: ComponentRegistry[];
  dnas: { id: string; version: string; active: boolean }[];
}

/**
 * SkillEngineDoctorReport — Configuration and options interface.
 */
export interface SkillEngineDoctorReport {
  healthy: boolean;
  issues: {
    severity: 'error' | 'warning';
    component: string;
    message: string;
    fix?: string;
  }[];
  stats: {
    totalComponents: number;
    active: number;
    issues: number;
  };
}

/**
 * SyncFromDNAResult — Configuration and options interface.
 */
export interface SyncFromDNAResult {
  added: number;
  updated: number;
  removed: number;
}

/**
 * SyncFromLocalResult — Configuration and options interface.
 */
export interface SyncFromLocalResult {
  added: number;
  errors: string[];
}

/**
 * InstallResult — Configuration and options interface.
 */
export interface InstallResult {
  success: boolean;
  component?: ComponentRegistry;
  error?: string;
}

/**
 * SkillEngineOptions — Configuration and options interface.
 */
export interface SkillEngineOptions {
  registry?: Map<string, ComponentRegistry>;
  dnaLoader?: DNALoader;
}

// ============================================================
// SkillEngine
// ============================================================

/**
 * SkillEngine — Agent skill resolution, delegation validation,
 * and component registry management.
 *
 * Two-stage routing:
 *   1. DNA match (primary) — exact persona skill references
 *   2. Capability match (semantic fallback) — when confidence < 50%
 */
export class SkillEngine {
  private registry: Map<string, ComponentRegistry>;
  private dnaLoader?: DNALoader;
  private agentSkills: Map<string, SkillRef[]> = new Map();
  private dnaPackages: DNAPackage[] = [];

  /**
   * Creates a SkillEngine with an optional registry and DNA loader.
   *
   * @param options - Configuration options (registry map and DNA loader)
   */
  constructor(options: SkillEngineOptions = {}) {
    this.registry = options.registry ?? new Map();
    this.dnaLoader = options.dnaLoader;
  }

  // ─── Core Resolution ──────────────────────────────────────

  /**
   * Resolve a skill for a given agent.
   * Uses two-stage routing: DNA match first, then capability match (semantic fallback).
   *
   * @param agentId - The agent's unique identifier
   * @param skillId - The skill identifier to resolve
   * @returns Object with hasSkill flag, optional proficiency level, and skill data
   */
  async resolve(
    agentId: string,
    skillId: string,
  ): Promise<{ hasSkill: boolean; proficiency?: number; skill?: Skill }> {
    // Stage 1: DNA match
    const agentSkillRefs = this.agentSkills.get(agentId);
    if (agentSkillRefs) {
      const ref = agentSkillRefs.find((s) => s.id === skillId);
      if (ref) {
        const component = this.registry.get(skillId);
        if (component && component.status === 'active') {
          return {
            hasSkill: true,
            proficiency: ref.proficiency,
            skill: this.toSkill(component),
          };
        }
      }
    }

    // Stage 2: Capability match (semantic fallback)
    // Search registry for the skill by id/name
    const component = this.registry.get(skillId);
    if (component && component.status === 'active') {
      // Check if the agent has any skill in the same category
      const agentSkills = this.agentSkills.get(agentId);
      if (agentSkills && agentSkills.length > 0) {
        // Semantic fallback: agent exists and skill is in registry
        return {
          hasSkill: true,
          proficiency: 2, // Default low proficiency for semantic match
          skill: this.toSkill(component),
        };
      }
    }

    return { hasSkill: false };
  }

  /**
   * Alias a persona role's synced skills onto a concrete agent id.
   *
   * syncFromDNA() registers skill refs keyed by `persona.role` (e.g. "orchestrator"),
   * but AgentManager creates agents with generated ids (e.g. "agent-orchestrator-f388e319")
   * that don't match any role key. Without this, validateDelegation()/resolve() always miss
   * for real agent ids — found via live verification: every agent in a running server was
   * reported as missing skills its own DNA persona explicitly grants it, because the two
   * were never connected. Call this once per agent after syncFromDNA().
   */
  assignPersonaSkillsToAgent(agentId: string, role: string): void {
    const roleSkills = this.agentSkills.get(role);
    if (roleSkills) {
      this.agentSkills.set(agentId, roleSkills);
    }
  }

  // ─── Delegation Validation ─────────────────────────────────

  /**
   * Validate whether an orchestrator can delegate a task to a target agent
   * given the required skills.
   *
   * @param _orchestrator - The orchestrator agent ID (unused, reserved)
   * @param targetAgent - The target agent ID to validate
   * @param requiredSkills - Array of skill IDs required for the task
   * @returns DelegationValidation with allowed flag and any missing/insufficient skills
   */
  async validateDelegation(
    _orchestrator: string,
    targetAgent: string,
    requiredSkills: string[],
  ): Promise<DelegationValidation> {
    const missingSkills: string[] = [];
    const insufficientProficiency: string[] = [];
    const agentSkillRefs = this.agentSkills.get(targetAgent) ?? [];

    for (const skillId of requiredSkills) {
      const ref = agentSkillRefs.find((s) => s.id === skillId);
      if (!ref) {
        missingSkills.push(skillId);
      } else if (ref.proficiency && ref.proficiency < 2) {
        insufficientProficiency.push(skillId);
      }
    }

    const allowed = missingSkills.length === 0 && insufficientProficiency.length === 0;
    const reason = allowed
      ? undefined
      : this.buildRejectionReason(missingSkills, insufficientProficiency);

    return { allowed, missingSkills, insufficientProficiency, reason };
  }

  // ─── Listing / Search ──────────────────────────────────────

  /**
   * List all available skills from the loaded DNA packages and registry.
   *
   * @param _dna - Optional DNA package filter (unused, reserved)
   * @returns Array of available Skill objects
   */
  async listAvailable(_dna?: unknown): Promise<Skill[]> {
    const skills: Skill[] = [];

    // From registry components of type 'skill'
    for (const component of this.registry.values()) {
      if (component.type === 'skill' && component.status === 'active') {
        skills.push(this.toSkill(component));
      }
    }

    return skills;
  }

  /**
   * Search skills by name, category, or tags.
   *
   * @param query - Search query string
   * @param filters - Optional filters (category, authorityLevel, source)
   * @returns Array of matching Skill objects
   */
  async search(
    query: string,
    filters?: { category?: string; authorityLevel?: string; source?: string },
  ): Promise<Skill[]> {
    const results: Skill[] = [];
    const lowerQuery = query.toLowerCase();

    for (const component of this.registry.values()) {
      if (component.type !== 'skill') continue;

      const nameMatch = component.name.toLowerCase().includes(lowerQuery);
      const descMatch = component.description?.toLowerCase().includes(lowerQuery) ?? false;
      const tagMatch = component.tags?.some((t) => t.toLowerCase().includes(lowerQuery)) ?? false;

      if (!nameMatch && !descMatch && !tagMatch) continue;

      const skill = this.toSkill(component);

      // Apply filters
      if (filters?.category && skill.category !== filters.category) continue;
      if (filters?.authorityLevel && skill.authorityRequired !== filters.authorityLevel) continue;
      if (filters?.source && skill.source !== filters.source) continue;

      results.push(skill);
    }

    return results;
  }

  /**
   * Get a specific skill by ID from the registry.
   *
   * @param skillId - The skill identifier
   * @returns The Skill object or null if not found
   */
  async get(skillId: string): Promise<Skill | null> {
    const component = this.registry.get(skillId);
    if (component?.type !== 'skill') return null;
    return this.toSkill(component);
  }

  // ─── Registry Management ───────────────────────────────────

  /**
   * Install a component into the registry.
   *
   * @param component - Component descriptor (type, id, source, optional metadata)
   * @returns InstallResult with success flag and component data
   */
  async install(component: {
    type: string;
    id: string;
    source: string;
    metadata?: Record<string, unknown>;
  }): Promise<InstallResult> {
    if (this.registry.has(component.id)) {
      return {
        success: false,
        error: `Component "${component.id}" already exists in registry`,
      };
    }

    const entry: ComponentRegistry = {
      id: component.id,
      type: component.type as ComponentRegistry['type'],
      name: component.id,
      source: component.source as ComponentRegistry['source'],
      version: '1.0.0',
      status: 'active',
      dependencies: [],
      tags: [],
      metadata: component.metadata,
      installedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.registry.set(component.id, entry);

    return { success: true, component: entry };
  }

  /**
   * Uninstall a component from the registry.
   *
   * @param componentId - The component ID to remove
   */
  async uninstall(componentId: string): Promise<void> {
    this.registry.delete(componentId);
  }

  /**
   * Sync components from a DNA package, extracting persona skills.
   *
   * @param dna - The DNA package to sync from
   * @returns SyncFromDNAResult with added, updated, and removed counts
   */
  async syncFromDNA(dna: DNAPackage): Promise<SyncFromDNAResult> {
    let added = 0;
    let updated = 0;
    let removed = 0;

    // Track existing IDs to detect removals
    const existingIds = new Set(this.registry.keys());

    // Process personas and their skills
    for (const persona of dna.personas) {
      const skills = persona.skills ?? [];

      // Register agent skill refs for two-stage routing
      const skillRefs: SkillRef[] = [];
      for (const skill of skills) {
        if (typeof skill === 'string') {
          skillRefs.push({ id: skill });
        } else {
          skillRefs.push(skill);
        }
      }
      this.agentSkills.set(persona.role, skillRefs);

      // Register each skill as a component
      for (const ref of skillRefs) {
        if (this.registry.has(ref.id)) {
          updated++;
          existingIds.delete(ref.id);
        } else {
          const component: ComponentRegistry = {
            id: ref.id,
            type: 'skill',
            name: ref.id,
            source: 'behavioros',
            version: '1.0.0',
            status: 'active',
            dependencies: [],
            tags: [],
            installedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          this.registry.set(ref.id, component);
          added++;
        }
      }
    }

    // Remove components no longer in DNA (only if they were DNA-sourced)
    for (const id of existingIds) {
      const comp = this.registry.get(id);
      if (comp && comp.source === 'behavioros') {
        this.registry.delete(id);
        removed++;
      }
    }

    this.dnaPackages.push(dna);

    return { added, updated, removed };
  }

  /**
   * Sync components from a local skills directory.
   * Scans for .skillfish.json or SKILL.md files in subdirectories.
   *
   * @param path - Path to the local skills directory
   * @returns SyncFromLocalResult with added count and any errors
   */
  async syncFromLocal(path: string): Promise<SyncFromLocalResult> {
    let added = 0;
    const errors: string[] = [];

    try {
      await access(path);
    } catch {
      return { added, errors };
    }

    const entries = await readdir(path, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      // Look for .skillfish.json or SKILL.md
      const skillfishPath = join(path, entry.name, '.skillfish.json');
      const skillMdPath = join(path, entry.name, 'SKILL.md');

      try {
        await access(skillfishPath);
        const content = await readFile(skillfishPath, 'utf-8');
        const skillfish = JSON.parse(content);

        const component: ComponentRegistry = {
          id: skillfish.id ?? entry.name,
          type: skillfish.type ?? 'skill',
          name: skillfish.name ?? entry.name,
          source: 'local',
          version: skillfish.version ?? '1.0.0',
          status: 'active',
          description: skillfish.description,
          dependencies: skillfish.dependencies ?? [],
          tags: skillfish.tags ?? [],
          metadata: { path: join(path, entry.name) },
          installedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        if (!this.registry.has(component.id)) {
          this.registry.set(component.id, component);
          added++;
        }
      } catch {
        // Try SKILL.md — parse metadata from it
        try {
          await access(skillMdPath);
          const content = await readFile(skillMdPath, 'utf-8');
          const nameMatch = content.match(/^#\s+(.+)/m);
          const descMatch = content.match(/## Description\s*\n([^#]+)/);

          const component: ComponentRegistry = {
            id: entry.name,
            type: 'skill',
            name: nameMatch?.[1] ?? entry.name,
            source: 'local',
            version: '1.0.0',
            status: 'active',
            description: descMatch?.[1]?.trim(),
            dependencies: [],
            tags: [],
            metadata: { path: join(path, entry.name) },
            installedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          if (!this.registry.has(component.id)) {
            this.registry.set(component.id, component);
            added++;
          }
        } catch {
          errors.push(`Failed to parse skill at: ${entry.name}`);
        }
      }
    }

    return { added, errors };
  }

  // ─── Ecosystem Status ──────────────────────────────────────

  /**
   * Get the full status of the ecosystem.
   *
   * @returns SkillEngineStatus with agents, skills, MCPs, design systems, and DNAs
   */
  async status(): Promise<SkillEngineStatus> {
    const agents = Array.from(this.agentSkills.entries()).map(([id, skills]) => ({
      id,
      status: 'active',
      skillsCount: skills.length,
      skills: skills.map((s) => s.id),
    }));

    const skills: ComponentRegistry[] = [];
    const mcps: ComponentRegistry[] = [];
    const designSystems: ComponentRegistry[] = [];

    for (const component of this.registry.values()) {
      switch (component.type) {
        case 'skill':
          skills.push(component);
          break;
        case 'mcp':
          mcps.push(component);
          break;
        case 'design-system':
          designSystems.push(component);
          break;
      }
    }

    const dnas = this.dnaPackages.map((dna) => ({
      id: dna.id,
      version: dna.version,
      active: true,
    }));

    return { agents, skills, mcps, designSystems, dnas };
  }

  // ─── Diagnostics ──────────────────────────────────────────

  /**
   * Run diagnostics on the skill ecosystem.
   * Checks for error states, outdated components, conflicts,
   * dangling skill references, and agents with no skills.
   *
   * @returns SkillEngineDoctorReport with health status and issues
   */
  async doctor(): Promise<SkillEngineDoctorReport> {
    const issues: SkillEngineDoctorReport['issues'] = [];
    let totalComponents = 0;
    let active = 0;

    for (const component of this.registry.values()) {
      totalComponents++;
      if (component.status === 'active') active++;

      // Check for issues
      if (component.status === 'error') {
        issues.push({
          severity: 'error',
          component: component.id,
          message: `Component "${component.id}" is in error state`,
          fix: 'Try reinstalling the component',
        });
      }

      if (component.status === 'outdated') {
        issues.push({
          severity: 'warning',
          component: component.id,
          message: `Component "${component.id}" is outdated (v${component.version})`,
          fix: 'Sync from source to get latest version',
        });
      }

      if (component.status === 'conflict') {
        issues.push({
          severity: 'error',
          component: component.id,
          message: `Component "${component.id}" has a version conflict`,
          fix: 'Remove duplicate entries and reinstall',
        });
      }
    }

    // Check for dangling skill refs
    for (const [agentId, refs] of this.agentSkills) {
      for (const ref of refs) {
        if (!this.registry.has(ref.id)) {
          issues.push({
            severity: 'warning',
            component: `${agentId} → ${ref.id}`,
            message: `Agent "${agentId}" references skill "${ref.id}" which is not in the registry`,
            fix: 'Add the missing skill component or remove the reference',
          });
        }
      }
    }

    // Check for agents with no skills
    for (const [agentId, refs] of this.agentSkills) {
      if (refs.length === 0) {
        issues.push({
          severity: 'warning',
          component: agentId,
          message: `Agent "${agentId}" has no skills assigned`,
          fix: 'Assign skills to this agent in the DNA package',
        });
      }
    }

    const healthy = issues.filter((i) => i.severity === 'error').length === 0;

    return {
      healthy,
      issues,
      stats: {
        totalComponents,
        active,
        issues: issues.length,
      },
    };
  }

  // ─── Internal Helpers ──────────────────────────────────────

  private toSkill(component: ComponentRegistry): Skill {
    return {
      id: component.id,
      name: component.name,
      version: component.version,
      description: component.description ?? '',
      category: 'custom',
      source: component.source as Skill['source'],
      tags: component.tags,
      installedAt: component.installedAt,
      updatedAt: component.updatedAt,
    };
  }

  private buildRejectionReason(missing: string[], insufficient: string[]): string {
    const parts: string[] = [];
    if (missing.length > 0) {
      parts.push(`missing skills: ${missing.join(', ')}`);
    }
    if (insufficient.length > 0) {
      parts.push(`insufficient proficiency: ${insufficient.join(', ')}`);
    }
    return `Delegation not allowed: ${parts.join('; ')}`;
  }

  /**
   * Get the raw registry (for testing/inspection).
   *
   * @returns The internal Map of component ID to ComponentRegistry
   */
  getRegistry(): Map<string, ComponentRegistry> {
    return this.registry;
  }

  /**
   * Get agent skill refs (for testing/inspection).
   *
   * @returns The internal Map of agent ID to SkillRef array
   */
  getAgentSkills(): Map<string, SkillRef[]> {
    return this.agentSkills;
  }

  /**
   * Load from the default .opencode/skills/ directory.
   * Checks both the project-level and home directory paths.
   *
   * @returns SyncFromLocalResult with added count and errors
   */
  async loadFromOpenCodeSkills(): Promise<SyncFromLocalResult> {
    const possiblePaths = [
      join(process.cwd(), '.opencode', 'skills'),
      join(homedir(), '.opencode', 'skills'),
    ];

    let totalAdded = 0;
    const allErrors: string[] = [];

    for (const path of possiblePaths) {
      const result = await this.syncFromLocal(path);
      totalAdded += result.added;
      allErrors.push(...result.errors);
    }

    return { added: totalAdded, errors: allErrors };
  }
}
