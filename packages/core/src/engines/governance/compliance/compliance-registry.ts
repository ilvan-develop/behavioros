import type { ComplianceProvider, ComplianceReport } from './provider';

/**
 * ComplianceRegistry — Provides register, get, list, runAll, ... operations.
 */
export class ComplianceRegistry {
  private providers = new Map<string, ComplianceProvider>();

  register(provider: ComplianceProvider): void {
    this.providers.set(provider.name, provider);
  }

  get(name: string): ComplianceProvider | undefined {
    return this.providers.get(name);
  }

  list(): ComplianceProvider[] {
    return Array.from(this.providers.values());
  }

  async runAll(target: string): Promise<ComplianceReport[]> {
    const results: ComplianceReport[] = [];
    for (const provider of this.providers.values()) {
      results.push(await provider.check(target));
    }
    return results;
  }

  async runSpecific(names: string[], target: string): Promise<ComplianceReport[]> {
    const results: ComplianceReport[] = [];
    for (const name of names) {
      const provider = this.providers.get(name);
      if (provider) {
        results.push(await provider.check(target));
      }
    }
    return results;
  }
}
