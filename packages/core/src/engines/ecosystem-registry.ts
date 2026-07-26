/**
 * BehaviorOS Ecosystem Registry — Central registry that ties together
 * SkillEngine, AITMPL, Open Design, and UI-UX Pro Max adapters.
 *
 * Provides unified initialization, reporting, installation, and diagnostics
 * across all ecosystem sources.
 */

import { access } from 'node:fs/promises';
import { join } from 'node:path';
import type { ComponentRegistry, EcosystemReport, Skill } from '@behavioros/schemas';
import type { SQLiteStore } from '../persistence/sqlite-store';
import type { AITMPLAdapter } from './adapters/aitmpl-adapter';
import type { OpenDesignAdapter } from './adapters/open-design-adapter';
import type { UIUXProMaxAdapter } from './adapters/ui-ux-adapter';
import type { DNALoader } from './behavioral/dna-loader';
import type { SkillEngine } from './skill-engine';

// ============================================================
// Types
// ============================================================

/**
 * EcosystemRegistryOptions — Configuration and options interface.
 */
export interface EcosystemRegistryOptions {
  db?: SQLiteStore;
  skillEngine?: SkillEngine;
  aitmpl?: AITMPLAdapter;
  openDesign?: OpenDesignAdapter;
  uiUx?: UIUXProMaxAdapter;
}

/**
 * SyncResults — Configuration and options interface.
 */
export interface SyncResults {
  results: unknown[];
}

/**
 * DoctorResult — Configuration and options interface.
 */
export interface DoctorResult {
  healthy: boolean;
  engines: Record<string, { status: string; issues: number; error?: string }>;
  stats: {
    totalComponents: number;
    activeComponents: number;
    agents: number;
    dnas: number;
    issues: number;
  };
}

// ============================================================
// EcosystemRegistry
// ============================================================

/**
 * EcosystemRegistry — ============================================================.
 */
export class EcosystemRegistry {
  private db?: SQLiteStore;
  private skillEngine?: SkillEngine;
  private aitmpl?: AITMPLAdapter;
  private openDesign?: OpenDesignAdapter;
  private uiUx?: UIUXProMaxAdapter;
  private dnaLoader?: DNALoader;
  private dnaPackagesLoaded: number = 0;
  private initialized: boolean = false;

  constructor(options: EcosystemRegistryOptions = {}) {
    this.db = options.db;
    this.skillEngine = options.skillEngine;
    this.aitmpl = options.aitmpl;
    this.openDesign = options.openDesign;
    this.uiUx = options.uiUx;
  }

  /**
   * Set a DNALoader for loading DNA packages during initialization.
   */
  setDNALoader(loader: DNALoader): void {
    this.dnaLoader = loader;
  }

  /**
   * Initialize by loading from all available sources.
   */
  async initialize(): Promise<void> {
    const results: string[] = [];

    // 1. Load from DNA (if DNALoader is available)
    if (this.dnaLoader && this.skillEngine) {
      try {
        // Try loading from the project's DNA directory
        const dnaDir = join(process.cwd(), 'dnas');
        await access(dnaDir);
        const packages = await this.dnaLoader.loadAll('dnas');
        for (const dna of packages) {
          await this.skillEngine.syncFromDNA(dna);
          this.dnaPackagesLoaded++;
        }
        if (packages.length > 0) {
          results.push(`Loaded ${packages.length} DNA packages`);
        }
      } catch {
        // No DNA directory found — skip
      }
    }

    // 2. Load from .opencode/skills/
    if (this.skillEngine) {
      const localResult = await this.skillEngine.loadFromOpenCodeSkills();
      if (localResult.added > 0) {
        results.push(`Loaded ${localResult.added} local skills`);
      }
    }

    // 3. Detect adapters
    if (this.aitmpl) {
      // AITMPL is available by default (relies on npx)
      results.push('AITMPL adapter ready');
    }

    if (this.openDesign) {
      const hasOD = await this.openDesign.detect();
      if (hasOD) {
        results.push('Open Design adapter ready');
      }
    }

    if (this.uiUx) {
      const hasUI = await this.uiUx.detect();
      if (hasUI) {
        results.push('UI-UX Pro Max adapter ready');
      }
    }

    this.initialized = true;
  }

  /**
   * Generate a comprehensive ecosystem report.
   */
  async generateReport(): Promise<EcosystemReport> {
    const project = process.env.npm_package_name ?? process.cwd().split(/[/\\]/).pop() ?? 'unknown';

    const report: EcosystemReport = {
      project,
      timestamp: new Date().toISOString(),
      agents: [],
      skills: [],
      mcps: [],
      designSystems: [],
      dnas: [],
    };

    if (this.skillEngine) {
      const status = await this.skillEngine.status();
      report.agents = status.agents;
      report.skills = status.skills;
      report.mcps = status.mcps;
      report.designSystems = status.designSystems;
      report.dnas = status.dnas;
    }

    return report;
  }

  /**
   * Install a component from a specified source.
   */
  async install(
    type: string,
    id: string,
    source: string,
  ): Promise<{ success: boolean; component?: ComponentRegistry | Skill; error?: string }> {
    switch (source) {
      case 'aitmpl': {
        if (!this.aitmpl) {
          return { success: false, error: 'AITMPL adapter not configured' };
        }

        if (type === 'mcp') {
          const result = await this.aitmpl.installMCP('general', id);
          if (!result.success) return { success: false, error: result.error };

          // Register with SkillEngine
          if (this.skillEngine && result.success) {
            await this.skillEngine.install({ type: 'mcp', id, source: 'aitmpl' });
          }

          return {
            success: true,
            component: {
              id,
              type: 'mcp',
              name: id,
              source: 'aitmpl',
              version: '1.0.0',
              status: 'active',
              dependencies: [],
              installedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          };
        }

        const skillResult = await this.aitmpl.installSkill('general', id);
        if (!skillResult.success) return { success: false, error: skillResult.error };

        // Register with SkillEngine
        if (this.skillEngine && skillResult.skill) {
          await this.skillEngine.install({
            type: 'skill',
            id: skillResult.skill.id,
            source: 'aitmpl',
            metadata: skillResult.skill as unknown as Record<string, unknown>,
          });
        }

        return { success: true, component: skillResult.skill };
      }

      case 'open-design': {
        if (!this.openDesign) {
          return { success: false, error: 'Open Design adapter not configured' };
        }

        if (type === 'mcp') {
          const result = await this.openDesign.installMCP(id);
          if (!result.success) return { success: false, error: result.error };

          if (this.skillEngine) {
            await this.skillEngine.install({ type: 'mcp', id, source: 'open-design' });
          }

          return { success: true };
        }

        return { success: false, error: `Open Design does not support installing type "${type}"` };
      }

      case 'local': {
        if (!this.skillEngine) {
          return { success: false, error: 'SkillEngine not configured' };
        }

        const result = await this.skillEngine.install({
          type,
          id,
          source: 'local',
        });

        return {
          success: result.success,
          component: result.component,
          error: result.error,
        };
      }

      default:
        return { success: false, error: `Unknown source: "${source}"` };
    }
  }

  /**
   * Sync all components from specified sources.
   */
  async sync(sources?: string[]): Promise<SyncResults> {
    const results: unknown[] = [];

    const sourcesToSync = sources ?? ['dna', 'local', 'aitmpl'];

    if (sourcesToSync.includes('dna') && this.dnaLoader && this.skillEngine) {
      try {
        const dnaDir = join(process.cwd(), 'dnas');
        await access(dnaDir);
        const packages = await this.dnaLoader.loadAll('dnas');
        for (const dna of packages) {
          const syncResult = await this.skillEngine.syncFromDNA(dna);
          results.push({ source: 'dna', package: dna.id, ...syncResult });
        }
      } catch {
        results.push({ source: 'dna', error: 'No DNA directory found' });
      }
    }

    if (sourcesToSync.includes('local') && this.skillEngine) {
      const localResult = await this.skillEngine.loadFromOpenCodeSkills();
      results.push({ source: 'local', ...localResult });
    }

    return { results };
  }

  /**
   * Run diagnostics across all engines and adapters.
   */
  async doctor(): Promise<DoctorResult> {
    const engines: Record<string, { status: string; issues: number; error?: string }> = {};
    let totalComponents = 0;
    let activeComponents = 0;
    let totalIssues = 0;

    // Check SkillEngine
    if (this.skillEngine) {
      try {
        const report = await this.skillEngine.doctor();
        engines['skill-engine'] = {
          status: report.healthy ? 'healthy' : 'issues',
          issues: report.stats.issues,
        };
        totalComponents += report.stats.totalComponents;
        activeComponents += report.stats.active;
        totalIssues += report.stats.issues;
      } catch (error) {
        engines['skill-engine'] = {
          status: 'error',
          issues: 0,
          error: error instanceof Error ? error.message : String(error),
        };
        totalIssues++;
      }
    }

    // Check AITMPL adapter
    if (this.aitmpl) {
      engines.aitmpl = { status: 'ready', issues: 0 };
    }

    // Check Open Design
    if (this.openDesign) {
      try {
        const hasOD = await this.openDesign.detect();
        engines['open-design'] = {
          status: hasOD ? 'ready' : 'not-detected',
          issues: 0,
        };
        if (!hasOD) totalIssues++;
      } catch (error) {
        engines['open-design'] = {
          status: 'error',
          issues: 0,
          error: error instanceof Error ? error.message : String(error),
        };
        totalIssues++;
      }
    }

    // Check UI-UX Pro Max
    if (this.uiUx) {
      try {
        const hasUI = await this.uiUx.detect();
        engines['ui-ux-pro-max'] = {
          status: hasUI ? 'ready' : 'not-detected',
          issues: 0,
        };
        if (!hasUI) totalIssues++;
      } catch (error) {
        engines['ui-ux-pro-max'] = {
          status: 'error',
          issues: 0,
          error: error instanceof Error ? error.message : String(error),
        };
        totalIssues++;
      }
    }

    const healthy = Object.values(engines).every(
      (e) => e.status === 'healthy' || e.status === 'ready',
    );

    const agentCount = this.skillEngine ? (await this.skillEngine.status()).agents.length : 0;

    return {
      healthy,
      engines,
      stats: {
        totalComponents,
        activeComponents,
        agents: agentCount,
        dnas: this.dnaPackagesLoaded,
        issues: totalIssues,
      },
    };
  }

  /**
   * Check if the registry has been initialized.
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}
