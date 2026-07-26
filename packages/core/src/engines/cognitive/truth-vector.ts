/**
 * DomainTruth — Configuration and options interface.
 */
export interface DomainTruth {
  domain: string;
  score: number;
  evidenceCount: number;
  lastUpdated: string;
}

/**
 * TruthVector — Provides update, get, getAll, getOverall, ... operations.
 */
export class TruthVector {
  private domains = new Map<string, DomainTruth>();

  update(domain: string, score: number, evidenceCount: number): void {
    this.domains.set(domain, {
      domain,
      score: Math.max(0, Math.min(1, score)),
      evidenceCount,
      lastUpdated: new Date().toISOString(),
    });
  }

  get(domain: string): DomainTruth | undefined {
    return this.domains.get(domain);
  }

  getAll(): DomainTruth[] {
    return Array.from(this.domains.values());
  }

  getOverall(): number {
    const values = Array.from(this.domains.values());
    if (values.length === 0) return 0;
    const sum = values.reduce((acc, d) => acc + d.score, 0);
    return sum / values.length;
  }

  decay(rate: number): void {
    const now = new Date().toISOString();
    for (const [domain, truth] of this.domains) {
      const days = this.daysBetween(truth.lastUpdated, now);
      if (days > 0) {
        const decayed = truth.score * (1 - Math.max(0, Math.min(1, rate))) ** days;
        this.domains.set(domain, {
          ...truth,
          score: Math.max(0, Math.min(1, decayed)),
          lastUpdated: now,
        });
      }
    }
  }

  private daysBetween(from: string, to: string): number {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const diffMs = toDate.getTime() - fromDate.getTime();
    return Math.max(0, diffMs / (1000 * 60 * 60 * 24));
  }
}
