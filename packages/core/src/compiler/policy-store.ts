import type { DNAPackage } from '@behavioros/schemas';
import { OPAEvaluator, type OPAInput, type OPAOutput } from './opa-evaluator';
import { type OPARegoPolicy, YAMLToOPACompiler } from './yaml-to-opa';

export class PolicyStore {
  private evaluator = new OPAEvaluator();
  private compiler = new YAMLToOPACompiler();
  private policies = new Map<string, OPARegoPolicy>();
  private cache = new Map<string, OPAOutput>();

  registerDNA(dna: DNAPackage): OPARegoPolicy {
    const policy = this.compiler.compile(dna);
    this.evaluator.registerPolicy(dna.id, policy);
    this.policies.set(dna.id, policy);
    return policy;
  }

  registerPolicy(dnaId: string, policy: OPARegoPolicy): void {
    this.evaluator.registerPolicy(dnaId, policy);
    this.policies.set(dnaId, policy);
  }

  evaluate(dnaId: string, input: OPAInput): OPAOutput {
    const cacheKey = `${dnaId}:${input.action.type}:${input.agent.authority}`;

    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const result = this.evaluator.evaluate(dnaId, input);
    this.cache.set(cacheKey, result);

    return result;
  }

  getPolicy(dnaId: string): OPARegoPolicy | undefined {
    return this.policies.get(dnaId);
  }

  listPolicies(): string[] {
    return Array.from(this.policies.keys());
  }

  clearCache(): void {
    this.cache.clear();
  }

  removePolicy(dnaId: string): boolean {
    this.policies.delete(dnaId);
    this.clearCache();
    return true;
  }
}
