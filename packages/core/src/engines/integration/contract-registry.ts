import { randomUUID } from 'node:crypto';

/**
 * ApiContract — Configuration and options interface.
 */
export interface ApiContract {
  id: string;
  name: string;
  version: string;
  type: 'rest' | 'grpc' | 'graphql' | 'event';
  endpoints: { path: string; method: string; requestSchema: string; responseSchema: string }[];
  breaking: boolean;
}

/**
 * ContractRegistry — contract registry.
 *
 * Methods: register, get, checkCompatibility, list.
 */
export class ContractRegistry {
  private contracts = new Map<string, ApiContract[]>();

  register(contract: ApiContract): void {
    const existing = this.contracts.get(contract.name);
    if (existing) {
      const exists = existing.some((c) => c.version === contract.version);
      if (exists) {
        throw new Error(
          `Contract '${contract.name}' version '${contract.version}' is already registered`,
        );
      }
      existing.push({ ...contract, id: randomUUID() });
    } else {
      this.contracts.set(contract.name, [{ ...contract, id: randomUUID() }]);
    }
  }

  get(name: string, version?: string): ApiContract | undefined {
    const entries = this.contracts.get(name);
    if (!entries || entries.length === 0) return undefined;
    if (!version) return entries[entries.length - 1];
    return entries.find((c) => c.version === version);
  }

  checkCompatibility(
    name: string,
    versionA: string,
    versionB: string,
  ): { compatible: boolean; breakingChanges: string[] } {
    const contractA = this.get(name, versionA);
    const contractB = this.get(name, versionB);
    if (!contractA || !contractB) {
      return { compatible: false, breakingChanges: ['One or both versions not found'] };
    }
    if (contractA.breaking || contractB.breaking) {
      return {
        compatible: false,
        breakingChanges: contractB.breaking
          ? [`Version ${versionB} is marked as breaking`]
          : [`Version ${versionA} is marked as breaking`],
      };
    }
    return { compatible: true, breakingChanges: [] };
  }

  list(): ApiContract[] {
    const all: ApiContract[] = [];
    for (const entries of this.contracts.values()) {
      all.push(...entries);
    }
    return all;
  }
}
