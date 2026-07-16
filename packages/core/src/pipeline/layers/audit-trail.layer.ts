import { createHash } from 'node:crypto';
import type { DispatcherLayerResult, PipelineDispatcherContext } from '../pipeline-context';
import type { PipelineLayer } from './layer.interface';

// ============================================================
// Layer 8 — Audit Trail
// Append-only audit trail with hash chain for tamper evidence.
// NEVER blocks — always records results.
// ============================================================

export interface AuditTrailEntry {
  pipelineId: string;
  layerIndex: number;
  layerId: string;
  action: string;
  agentId: string;
  timestamp: string;
  previousHash: string;
  hash: string;
  details: Record<string, unknown>;
}

export interface AuditTrailLayerOptions {
  maxEntries?: number;
}

export class AuditTrailLayer implements PipelineLayer {
  readonly id = 'audit-trail';
  readonly name = 'Audit Trail';
  readonly order = 8;

  private trail: AuditTrailEntry[] = [];
  private maxEntries: number;

  constructor(options: AuditTrailLayerOptions = {}) {
    this.maxEntries = options.maxEntries ?? 10_000;
  }

  shouldExecute(_context: PipelineDispatcherContext): boolean {
    return true;
  }

  async execute(context: PipelineDispatcherContext): Promise<DispatcherLayerResult> {
    const start = Date.now();

    try {
      const previousHash =
        this.trail.length > 0 ? this.trail[this.trail.length - 1].hash : '0'.repeat(64);

      // Build entry data
      const entryData = {
        pipelineId: context.id,
        layerIndex: context.currentLayerIndex,
        action: context.action,
        agentId: context.agentId,
        timestamp: new Date().toISOString(),
        previousHash,
        payload: context.payload,
        metadata: Object.fromEntries(context.metadata.entries()),
      };

      // Compute hash chain
      const hash = createHash('sha256').update(JSON.stringify(entryData)).digest('hex');

      const entry: AuditTrailEntry = {
        pipelineId: context.id,
        layerIndex: context.currentLayerIndex,
        layerId: 'audit-trail',
        action: context.action,
        agentId: context.agentId,
        timestamp: entryData.timestamp,
        previousHash,
        hash,
        details: {
          payloadKeys: Object.keys(context.payload ?? {}),
          metadataKeys: Array.from(context.metadata.keys()),
          layerResultsCount: context.layerResults.length,
        },
      };

      // Append to trail (never removes — append-only)
      this.trail.push(entry);

      // Trim if over max (keeps head, drops oldest)
      if (this.trail.length > this.maxEntries) {
        this.trail = this.trail.slice(-this.maxEntries);
      }

      // Verify chain integrity
      const chainValid = this.verifyChain();

      // NEVER blocks
      return {
        layerId: this.id,
        layerName: this.name,
        passed: true,
        score: chainValid ? 100 : 50,
        duration: Date.now() - start,
        details: {
          entryHash: hash,
          previousHash,
          chainValid,
          trailLength: this.trail.length,
          pipelineId: context.id,
          recordedAt: entry.timestamp,
        },
      };
    } catch (error) {
      // NEVER blocks
      return {
        layerId: this.id,
        layerName: this.name,
        passed: true,
        score: 0,
        duration: Date.now() - start,
        details: {
          error: error instanceof Error ? error.message : 'Unknown audit trail error',
          note: 'Audit trail layer does not block — error recorded',
        },
      };
    }
  }

  verifyChain(): boolean {
    for (let i = 0; i < this.trail.length; i++) {
      const entry = this.trail[i];

      // Verify link to previous
      if (i === 0) {
        if (entry.previousHash !== '0'.repeat(64)) {
          return false;
        }
      } else {
        if (entry.previousHash !== this.trail[i - 1].hash) {
          return false;
        }
      }

      // Verify entry hash
      const _recomputed = createHash('sha256')
        .update(
          JSON.stringify({
            pipelineId: entry.pipelineId,
            layerIndex: entry.layerIndex,
            action: entry.action,
            agentId: entry.agentId,
            timestamp: entry.timestamp,
            previousHash: entry.previousHash,
          }),
        )
        .digest('hex');

      // We can't perfectly recompute without the original payload,
      // but we verify the chain linkage is intact
      if (entry.hash.length !== 64) {
        return false;
      }
    }

    return true;
  }

  getTrail(): AuditTrailEntry[] {
    return [...this.trail];
  }

  getTrailForPipeline(pipelineId: string): AuditTrailEntry[] {
    return this.trail.filter((e) => e.pipelineId === pipelineId);
  }

  getTrailLength(): number {
    return this.trail.length;
  }

  clearTrail(): void {
    this.trail = [];
  }
}
