// ============================================================
// Event ACL — Validates and transforms event payloads
// ============================================================

import type { ACLResult, AntiCorruptionLayer } from './acl.interface';

const ALLOWED_EVENT_TYPES = ['action', 'query', 'command', 'event'] as const;

export type EventType = (typeof ALLOWED_EVENT_TYPES)[number];

export class EventACL implements AntiCorruptionLayer {
  readonly id = 'event-acl';
  readonly name = 'Event Anti-Corruption Layer';

  validateInput(input: { eventType: string; payload: unknown }): ACLResult {
    if (!ALLOWED_EVENT_TYPES.includes(input.eventType as EventType)) {
      return {
        passed: false,
        reason: `Invalid event type: '${input.eventType}'. Allowed: ${ALLOWED_EVENT_TYPES.join(', ')}`,
      };
    }

    return { passed: true };
  }

  transformInput(input: Record<string, unknown>): Record<string, unknown> {
    return {
      ...input,
      timestamp: Date.now(),
    };
  }

  validateOutput(output: Record<string, unknown>): ACLResult {
    if (!output) {
      return { passed: false, reason: 'Event output is empty' };
    }

    return { passed: true };
  }

  transformOutput(output: Record<string, unknown>): Record<string, unknown> {
    return output;
  }
}
