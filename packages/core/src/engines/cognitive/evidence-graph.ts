/**
 * EvidenceEdge — Configuration and options interface.
 */
export interface EvidenceEdge {
  source: string;
  target: string;
  evidenceIds: string[];
  weight: number;
  lastUpdated: string;
}

/**
 * EvidenceGraph — evidence graph.
 *
 * Methods: addEdge, getEdge, propagateTruth, getConnected, clear.
 */
export class EvidenceGraph {
  private edges = new Map<string, EvidenceEdge>();

  private key(source: string, target: string): string {
    return `${source}|${target}`;
  }

  addEdge(source: string, target: string, evidenceId: string, confidence: number): void {
    const k = this.key(source, target);
    const existing = this.edges.get(k);
    const now = new Date().toISOString();

    if (existing) {
      const ids = new Set([...existing.evidenceIds, evidenceId]);
      const weights = Array.from(ids).map(
        () =>
          (existing.weight * existing.evidenceIds.length + confidence) /
          (existing.evidenceIds.length + 1),
      );
      const avgWeight = weights.reduce((a, b) => a + b, 0) / weights.length;
      this.edges.set(k, {
        ...existing,
        evidenceIds: Array.from(ids),
        weight: Math.max(0, Math.min(1, avgWeight)),
        lastUpdated: now,
      });
    } else {
      this.edges.set(k, {
        source,
        target,
        evidenceIds: [evidenceId],
        weight: Math.max(0, Math.min(1, confidence)),
        lastUpdated: now,
      });
    }
  }

  getEdge(source: string, target: string): EvidenceEdge | undefined {
    return this.edges.get(this.key(source, target));
  }

  propagateTruth(): void {
    const keys = Array.from(this.edges.keys());
    for (const k of keys) {
      const edge = this.edges.get(k);
      if (!edge) continue;
      if (edge.evidenceIds.length === 0) continue;
      const avgConfidence =
        edge.evidenceIds.reduce((sum) => {
          return sum + edge.weight;
        }, 0) / edge.evidenceIds.length;
      edge.weight = Math.max(0, Math.min(1, avgConfidence));
      edge.lastUpdated = new Date().toISOString();
      this.edges.set(k, edge);
    }
  }

  getConnected(source: string): { target: string; weight: number }[] {
    const result: { target: string; weight: number }[] = [];
    for (const [, edge] of this.edges) {
      if (edge.source === source) {
        result.push({ target: edge.target, weight: edge.weight });
      }
    }
    return result;
  }

  clear(): void {
    this.edges.clear();
  }
}
