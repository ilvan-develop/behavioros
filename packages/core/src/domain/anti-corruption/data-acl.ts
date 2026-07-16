// ============================================================
// Data ACL — Validates and transforms data payloads
// ============================================================

import type { ACLResult, AntiCorruptionLayer } from './acl.interface';

export class DataACL implements AntiCorruptionLayer {
  readonly id = 'data-acl';
  readonly name = 'Data Anti-Corruption Layer';

  validateInput(input: Record<string, unknown>): ACLResult {
    if (!input.data) {
      return { passed: false, reason: 'Missing required field: data' };
    }

    return { passed: true };
  }

  transformInput(input: Record<string, unknown>): Record<string, unknown> {
    return input;
  }

  validateOutput(output: Record<string, unknown>): ACLResult {
    if (!output) {
      return { passed: false, reason: 'Output is empty' };
    }

    return { passed: true };
  }

  transformOutput(output: Record<string, unknown>): Record<string, unknown> {
    return output;
  }
}
