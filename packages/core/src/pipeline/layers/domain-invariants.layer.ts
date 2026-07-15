import type { DispatcherLayerResult, PipelineDispatcherContext } from '../pipeline-context';
import type { PipelineLayer } from './layer.interface';

// ============================================================
// Layer 4 — Domain Invariants
// Validates domain-specific invariants using an entity factory
// registry pattern. Checks payment, auth, data, and custom
// invariants defined by the project.
// Structural layer: fails fast on invariant violations.
// ============================================================

export type InvariantCheck = (context: PipelineDispatcherContext) => InvariantResult;

export interface InvariantResult {
  passed: boolean;
  name: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface DomainInvariantConfig {
  domain: string;
  checks: InvariantCheck[];
}

export interface DomainInvariantsLayerOptions {
  invariants?: DomainInvariantConfig[];
}

// --- Built-in Invariant Factories ---

export function requirePayloadField(field: string): InvariantCheck {
  return (context) => {
    const hasField = context.payload && field in context.payload;
    return {
      passed: hasField,
      name: `require_${field}`,
      message: hasField
        ? `Payload contains required field '${field}'`
        : `Payload missing required field '${field}'`,
      severity: 'error',
    };
  };
}

export function requireNoSecrets(): InvariantCheck {
  return (context) => {
    const secretPatterns = [
      /password/i,
      /secret/i,
      /api[_-]?key/i,
      /token/i,
      /private[_-]?key/i,
      /credential/i,
    ];

    for (const [key, value] of Object.entries(context.payload ?? {})) {
      if (typeof value === 'string') {
        for (const pattern of secretPatterns) {
          if (pattern.test(key) && value.length > 0) {
            return {
              passed: false,
              name: 'no_secrets_in_payload',
              message: `Potential secret detected in payload field '${key}'`,
              severity: 'error',
            };
          }
        }
      }
    }

    return {
      passed: true,
      name: 'no_secrets_in_payload',
      message: 'No secrets detected in payload',
      severity: 'error',
    };
  };
}

export function maxPayloadSize(maxKeys: number): InvariantCheck {
  return (context) => {
    const keyCount = Object.keys(context.payload ?? {}).length;
    return {
      passed: keyCount <= maxKeys,
      name: 'max_payload_size',
      message:
        keyCount <= maxKeys
          ? `Payload size (${keyCount} keys) within limit (${maxKeys})`
          : `Payload size (${keyCount} keys) exceeds limit (${maxKeys})`,
      severity: 'warning',
    };
  };
}

export function requireActionPattern(pattern: RegExp): InvariantCheck {
  return (context) => {
    const matches = pattern.test(context.action);
    return {
      passed: matches,
      name: 'action_pattern',
      message: matches
        ? `Action '${context.action}' matches expected pattern`
        : `Action '${context.action}' does not match expected pattern ${pattern}`,
      severity: 'error',
    };
  };
}

export class DomainInvariantsLayer implements PipelineLayer {
  readonly id = 'domain';
  readonly name = 'Domain Invariants';
  readonly order = 4;

  private invariants: DomainInvariantConfig[];

  constructor(options: DomainInvariantsLayerOptions = {}) {
    this.invariants = options.invariants ?? [];
  }

  shouldExecute(_context: PipelineDispatcherContext): boolean {
    return true;
  }

  async execute(context: PipelineDispatcherContext): Promise<DispatcherLayerResult> {
    const start = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];
    const checkResults: InvariantResult[] = [];

    try {
      // Run all registered invariant checks
      for (const config of this.invariants) {
        for (const check of config.checks) {
          const result = check(context);
          checkResults.push(result);

          if (!result.passed) {
            if (result.severity === 'error') {
              errors.push(`[${config.domain}] ${result.message}`);
            } else {
              warnings.push(`[${config.domain}] ${result.message}`);
            }
          }
        }
      }

      // Always apply built-in security invariants
      const noSecretsCheck = requireNoSecrets()(context);
      checkResults.push(noSecretsCheck);
      if (!noSecretsCheck.passed) {
        errors.push(noSecretsCheck.message);
      }

      const passed = errors.length === 0;
      const passedChecks = checkResults.filter((r) => r.passed).length;
      const score =
        checkResults.length > 0 ? Math.round((passedChecks / checkResults.length) * 100) : 100;

      return {
        layerId: this.id,
        layerName: this.name,
        passed,
        score,
        duration: Date.now() - start,
        details: {
          domainsChecked: this.invariants.map((i) => i.domain),
          totalChecks: checkResults.length,
          passedChecks,
          failedChecks: checkResults.length - passedChecks,
          errors,
          warnings,
        },
        error: passed ? undefined : `Domain invariants failed: ${errors.join('; ')}`,
      };
    } catch (error) {
      return {
        layerId: this.id,
        layerName: this.name,
        passed: false,
        score: 0,
        duration: Date.now() - start,
        details: {},
        error: error instanceof Error ? error.message : 'Unknown domain invariant error',
      };
    }
  }

  addInvariant(config: DomainInvariantConfig): void {
    const existing = this.invariants.find((i) => i.domain === config.domain);
    if (existing) {
      existing.checks.push(...config.checks);
    } else {
      this.invariants.push(config);
    }
  }

  removeInvariant(domain: string): boolean {
    const index = this.invariants.findIndex((i) => i.domain === domain);
    if (index >= 0) {
      this.invariants.splice(index, 1);
      return true;
    }
    return false;
  }

  getInvariants(): DomainInvariantConfig[] {
    return [...this.invariants];
  }
}
