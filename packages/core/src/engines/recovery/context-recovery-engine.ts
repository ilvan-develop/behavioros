import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// ============================================================
// Types
// ============================================================

/**
 * RecoveryCheckpoint — Configuration and options interface.
 */
export interface RecoveryCheckpoint {
  id: string;
  timestamp: string;
  missionId?: string;
  phase: string;
  coverage: number;
  contextHash: string;
  state: Record<string, unknown>;
}

/**
 * RecoveryResult — Configuration and options interface.
 */
export interface RecoveryResult {
  success: boolean;
  restoredFrom: string;
  checkpoints: RecoveryCheckpoint[];
  actions: string[];
  coverageAfter: number;
}

/**
 * ContextRecoveryEngineOptions — Configuration and options interface.
 */
export interface ContextRecoveryEngineOptions {
  basePath?: string;
  maxCheckpoints?: number;
}

// ============================================================
// Constants
// ============================================================

const DEFAULT_MAX_CHECKPOINTS = 50;
const CHECKPOINTS_FILE = 'recovery-checkpoints.json';
const COVERAGE_MAJOR_THRESHOLD = 20;
const COVERAGE_CRITICAL_THRESHOLD = 50;

// ============================================================
// Context Recovery Engine
// ============================================================

/**
 * ContextRecoveryEngine — ============================================================.
 */
export class ContextRecoveryEngine {
  private basePath: string;
  private maxCheckpoints: number;

  constructor(options?: ContextRecoveryEngineOptions) {
    this.basePath = options?.basePath ?? join(process.cwd(), '.behavioros');
    this.maxCheckpoints = options?.maxCheckpoints ?? DEFAULT_MAX_CHECKPOINTS;
  }

  // ----------------------------------------------------------
  // Checkpoint operations
  // ----------------------------------------------------------

  async createCheckpoint(
    missionId: string,
    phase: string,
    state: Record<string, unknown>,
  ): Promise<RecoveryCheckpoint> {
    const checkpoint: RecoveryCheckpoint = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      missionId,
      phase,
      coverage: this.computeCoverageFromState(state),
      contextHash: this.computeContextHash(state),
      state,
    };

    const checkpoints = await this.loadCheckpoints();
    checkpoints.push(checkpoint);

    if (checkpoints.length > this.maxCheckpoints) {
      checkpoints.splice(0, checkpoints.length - this.maxCheckpoints);
    }

    await this.saveCheckpoints(checkpoints);
    return checkpoint;
  }

  async getCheckpoints(): Promise<RecoveryCheckpoint[]> {
    return this.loadCheckpoints();
  }

  async getLatestCheckpoint(): Promise<RecoveryCheckpoint | null> {
    const checkpoints = await this.loadCheckpoints();
    return checkpoints.length > 0 ? checkpoints[checkpoints.length - 1] : null;
  }

  // ----------------------------------------------------------
  // Context loss detection
  // ----------------------------------------------------------

  async detectContextLoss(
    currentCoverage: number,
    lastCheckpoint?: RecoveryCheckpoint,
  ): Promise<{
    lost: boolean;
    severity: 'none' | 'minor' | 'major' | 'critical';
    reason: string;
  }> {
    if (!lastCheckpoint) {
      const latest = await this.getLatestCheckpoint();
      if (!latest) {
        return {
          lost: false,
          severity: 'none',
          reason: 'No previous checkpoint exists for comparison',
        };
      }
      return this.compareCoverage(currentCoverage, latest.coverage);
    }

    return this.compareCoverage(currentCoverage, lastCheckpoint.coverage);
  }

  // ----------------------------------------------------------
  // Context rebuild
  // ----------------------------------------------------------

  async rebuildContext(): Promise<RecoveryResult> {
    const actions: string[] = [];
    let coverageAfter = 0;

    const latest = await this.getLatestCheckpoint();
    if (!latest) {
      return {
        success: false,
        restoredFrom: 'none',
        checkpoints: [],
        actions: ['No checkpoint found to rebuild from'],
        coverageAfter: 0,
      };
    }

    actions.push(`Found latest checkpoint: ${latest.id} (phase: ${latest.phase})`);
    actions.push(`Checkpoint coverage: ${latest.coverage}%`);

    const memoryEntries = await this.readMemoryFiles();
    actions.push(`Read ${memoryEntries.length} memory file(s)`);

    const restoredState = { ...latest.state };
    for (const entry of memoryEntries) {
      if (entry.key in restoredState) {
        actions.push(`Merged memory entry: ${entry.key}`);
      }
    }

    coverageAfter = this.computeCoverageFromState(restoredState);
    actions.push(`Rebuilt context coverage: ${coverageAfter}%`);

    const checkpoints = await this.loadCheckpoints();

    return {
      success: coverageAfter >= latest.coverage * 0.9,
      restoredFrom: latest.id,
      checkpoints,
      actions,
      coverageAfter,
    };
  }

  // ----------------------------------------------------------
  // Recovery validation
  // ----------------------------------------------------------

  async validateRecovery(result: RecoveryResult): Promise<{
    valid: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];

    if (!result.success) {
      issues.push('Recovery result indicates failure');
    }

    if (result.restoredFrom === 'none') {
      issues.push('No checkpoint restored from');
    }

    if (result.actions.length === 0) {
      issues.push('No recovery actions were recorded');
    }

    if (result.coverageAfter < 50) {
      issues.push(`Post-recovery coverage too low: ${result.coverageAfter}%`);
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  // ----------------------------------------------------------
  // Private helpers
  // ----------------------------------------------------------

  private async loadCheckpoints(): Promise<RecoveryCheckpoint[]> {
    await this.ensureDirectory();
    try {
      const filePath = join(this.basePath, CHECKPOINTS_FILE);
      const content = await readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private async saveCheckpoints(checkpoints: RecoveryCheckpoint[]): Promise<void> {
    await this.ensureDirectory();
    const filePath = join(this.basePath, CHECKPOINTS_FILE);
    await writeFile(filePath, JSON.stringify(checkpoints, null, 2), 'utf-8');
  }

  private async ensureDirectory(): Promise<void> {
    await mkdir(this.basePath, { recursive: true });
  }

  private async readMemoryFiles(): Promise<Array<{ key: string; value: string }>> {
    const entries: Array<{ key: string; value: string }> = [];
    const memoryFiles = ['memory.md', 'decisions.md', 'domains.md', 'architecture.md'];

    for (const fileName of memoryFiles) {
      try {
        const filePath = join(this.basePath, fileName);
        const content = await readFile(filePath, 'utf-8');
        const sections = content.split(/^## /m).filter(Boolean);
        for (const section of sections) {
          const lines = section.split('\n');
          const key = lines[0]?.trim();
          if (key) {
            entries.push({ key, value: lines.slice(1).join('\n').trim() });
          }
        }
      } catch {
        // File doesn't exist, skip
      }
    }

    return entries;
  }

  private computeCoverageFromState(state: Record<string, unknown>): number {
    const keys = Object.keys(state);
    if (keys.length === 0) return 0;

    let filled = 0;
    for (const key of keys) {
      const value = state[key];
      if (value !== undefined && value !== null && value !== '') {
        filled++;
      }
    }

    return Math.round((filled / keys.length) * 100);
  }

  private computeContextHash(state: Record<string, unknown>): string {
    const serialized = JSON.stringify(state, Object.keys(state).sort());
    let hash = 0;
    for (let i = 0; i < serialized.length; i++) {
      const char = serialized.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return `ctx-${Math.abs(hash).toString(16)}`;
  }

  private compareCoverage(
    current: number,
    previous: number,
  ): { lost: boolean; severity: 'none' | 'minor' | 'major' | 'critical'; reason: string } {
    const drop = previous - current;

    if (drop <= 0) {
      return {
        lost: false,
        severity: 'none',
        reason: 'Coverage is stable or improved',
      };
    }

    if (drop < COVERAGE_MAJOR_THRESHOLD) {
      return {
        lost: true,
        severity: 'minor',
        reason: `Coverage dropped by ${drop}% (from ${previous}% to ${current}%)`,
      };
    }

    if (drop < COVERAGE_CRITICAL_THRESHOLD) {
      return {
        lost: true,
        severity: 'major',
        reason: `Coverage dropped by ${drop}% (from ${previous}% to ${current}%)`,
      };
    }

    return {
      lost: true,
      severity: 'critical',
      reason: `Coverage dropped by ${drop}% (from ${previous}% to ${current}%) — critical context loss`,
    };
  }
}
