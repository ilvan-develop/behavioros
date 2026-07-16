// ============================================================
// Agent ACL — Sanitizes and validates agent inputs/outputs
// ============================================================

import type { ACLResult, AntiCorruptionLayer } from './acl.interface';

const MALICIOUS_PATTERNS = ['DROP', 'DELETE', 'TRUNCATE', 'EXEC', 'UNION'];
const SENSITIVE_FIELDS = ['password', 'secret', 'token', 'key'];

const ALLOWED_ACTIONS = [
  'read',
  'write',
  'execute',
  'deploy',
  'review',
  'create',
  'update',
  'delete',
  'query',
  'export',
] as const;

export class AgentACL implements AntiCorruptionLayer {
  readonly id = 'agent-acl';
  readonly name = 'Agent Anti-Corruption Layer';

  validateInput(input: { agentId: string; action: string; payload: unknown }): ACLResult {
    if (!input.agentId || !input.action) {
      return { passed: false, reason: 'Missing required fields: agentId, action' };
    }

    // Primary defense: allowlist — only known-good actions are permitted
    if (!ALLOWED_ACTIONS.includes(input.action as (typeof ALLOWED_ACTIONS)[number])) {
      return {
        passed: false,
        reason: `Action '${input.action}' is not in the allowlist: [${ALLOWED_ACTIONS.join(', ')}]`,
      };
    }

    // Secondary defense: blocklist — detect malicious patterns in payload
    const payloadStr = JSON.stringify(input.payload ?? {}).toUpperCase();
    const detected = MALICIOUS_PATTERNS.filter((pattern) => payloadStr.includes(pattern));

    if (detected.length > 0) {
      return {
        passed: false,
        reason: `Malicious patterns detected in payload: ${detected.join(', ')}`,
      };
    }

    return { passed: true };
  }

  transformInput(input: Record<string, unknown>): Record<string, unknown> {
    return {
      ...input,
      payload: this.sanitize(input.payload),
    };
  }

  validateOutput(output: Record<string, unknown>): ACLResult {
    const outputStr = JSON.stringify(output).toLowerCase();
    const detected = SENSITIVE_FIELDS.filter((pattern) => outputStr.includes(`"${pattern}"`));

    if (detected.length > 0) {
      return {
        passed: false,
        reason: `Sensitive fields detected in output: ${detected.join(', ')}`,
      };
    }

    return { passed: true };
  }

  transformOutput(output: Record<string, unknown>): Record<string, unknown> {
    const safe = { ...output };
    for (const field of SENSITIVE_FIELDS) {
      delete safe[field];
    }
    return safe;
  }

  private sanitize(payload: unknown): unknown {
    if (typeof payload === 'string') {
      return payload.replace(/[<>]/g, '');
    }
    return payload;
  }
}
