import { randomUUID } from 'node:crypto';

/**
 * EvidenceSource — Configuration and options interface.
 */
export interface EvidenceSource {
  id: string;
  name: string;
  reliability: number;
  type: 'observation' | 'measurement' | 'test-result' | 'log' | 'report' | 'inference';
}

/**
 * EvidenceItem — Configuration and options interface.
 */
export interface EvidenceItem {
  id: string;
  claimId: string;
  sourceId: string;
  content: string;
  confidence: number;
  timestamp: string;
  verified: boolean;
  verifiedAt?: string;
}

/**
 * EvidenceManager — Provides registerSource, getSource, listSources, addEvidence, ... operations.
 */
export class EvidenceManager {
  private sources = new Map<string, EvidenceSource>();
  private evidence = new Map<string, EvidenceItem[]>();

  registerSource(source: EvidenceSource): void {
    this.sources.set(source.id, source);
  }

  getSource(id: string): EvidenceSource | undefined {
    return this.sources.get(id);
  }

  listSources(): EvidenceSource[] {
    return Array.from(this.sources.values());
  }

  addEvidence(claimId: string, sourceId: string, content: string, confidence?: number): string {
    const source = this.sources.get(sourceId);
    const id = randomUUID();

    if (!this.evidence.has(claimId)) {
      this.evidence.set(claimId, []);
    }

    const item: EvidenceItem = {
      id,
      claimId,
      sourceId,
      content,
      confidence: confidence ?? source?.reliability ?? 0.5,
      timestamp: new Date().toISOString(),
      verified: false,
    };

    this.evidence.get(claimId)!.push(item);
    return id;
  }

  getEvidence(claimId: string): EvidenceItem[] {
    return this.evidence.get(claimId) ?? [];
  }

  verify(evidenceId: string): void {
    for (const items of this.evidence.values()) {
      const item = items.find((e) => e.id === evidenceId);
      if (item) {
        item.verified = true;
        item.verifiedAt = new Date().toISOString();
        return;
      }
    }
  }

  getUnverifiedEvidence(): EvidenceItem[] {
    const unverified: EvidenceItem[] = [];
    for (const items of this.evidence.values()) {
      for (const item of items) {
        if (!item.verified) {
          unverified.push(item);
        }
      }
    }
    return unverified;
  }

  removeEvidence(id: string): void {
    for (const [claimId, items] of this.evidence) {
      const index = items.findIndex((e) => e.id === id);
      if (index !== -1) {
        items.splice(index, 1);
        if (items.length === 0) {
          this.evidence.delete(claimId);
        }
        return;
      }
    }
  }
}
