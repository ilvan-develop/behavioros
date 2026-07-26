import type { HandoffProtocol, HandoffRecord, HandoffRejectReason } from '@behavioros/core';
import { z } from 'zod';

export const bosAgentHandoffInput = z.object({
  action: z
    .enum(['request', 'accept', 'reject', 'complete', 'status', 'list-active'])
    .describe('Handoff action: request, accept, reject, complete, status, or list-active'),
  handoffId: z
    .string()
    .optional()
    .describe('Handoff ID (required for accept/reject/complete/status)'),
  from: z.string().optional().describe('Source agent ID (required for request)'),
  to: z.string().optional().describe('Target agent ID (required for request)'),
  context: z
    .any()
    .optional()
    .describe('Handoff context object with subtask and missionId (required for request)'),
  reason: z
    .object({
      code: z.string(),
      details: z.string(),
      suggestion: z.string().optional(),
    })
    .optional()
    .describe('Rejection reason (required for reject)'),
  output: z.any().optional().describe('Output data (required for complete)'),
});

export type BosAgentHandoffInput = z.infer<typeof bosAgentHandoffInput>;

function formatHandoffRecord(r: HandoffRecord): Record<string, unknown> {
  return {
    handoffId: r.handoffId,
    from: r.from,
    to: r.to,
    status: r.status,
    context: {
      missionId: r.context.missionId,
      subtask: r.context.subtask,
    },
    rejectionReason: r.rejectionReason,
    hasOutput: r.output !== undefined,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    completedAt: r.completedAt,
  };
}

export async function bosAgentHandoff(protocol: HandoffProtocol, input: BosAgentHandoffInput) {
  const { action, handoffId, from, to, context, reason, output } = input;

  switch (action) {
    case 'request': {
      if (!from || !to || !context) {
        throw new Error(
          'Handoff request requires: from, to, and context (with subtask and missionId)',
        );
      }
      const result = await protocol.request(from, to, context);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                action: 'request',
                handoffId: result.handoffId,
                status: result.status,
                message: `Handoff requested from "${from}" to "${to}"`,
              },
              null,
              2,
            ),
          },
        ],
      };
    }

    case 'accept': {
      if (!handoffId) {
        throw new Error('Handoff accept requires: handoffId');
      }
      await protocol.accept(handoffId);
      const record = await protocol.get(handoffId);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                action: 'accept',
                handoffId,
                status: record?.status,
                message: `Handoff ${handoffId} accepted and in progress`,
              },
              null,
              2,
            ),
          },
        ],
      };
    }

    case 'reject': {
      if (!handoffId || !reason) {
        throw new Error('Handoff reject requires: handoffId and reason (with code and details)');
      }
      const rejectReason: HandoffRejectReason = {
        code: reason.code,
        details: reason.details,
        suggestion: reason.suggestion,
      };
      await protocol.reject(handoffId, rejectReason);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                action: 'reject',
                handoffId,
                status: 'rejected',
                reason: rejectReason,
                message: `Handoff ${handoffId} rejected`,
              },
              null,
              2,
            ),
          },
        ],
      };
    }

    case 'complete': {
      if (!handoffId) {
        throw new Error('Handoff complete requires: handoffId');
      }
      await protocol.complete(handoffId, output);
      const record = await protocol.get(handoffId);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                action: 'complete',
                handoffId,
                status: record?.status,
                completedAt: record?.completedAt,
                message: `Handoff ${handoffId} completed`,
              },
              null,
              2,
            ),
          },
        ],
      };
    }

    case 'status': {
      if (!handoffId) {
        throw new Error('Handoff status requires: handoffId');
      }
      const record = await protocol.status(handoffId);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                action: 'status',
                handoff: formatHandoffRecord(record),
              },
              null,
              2,
            ),
          },
        ],
      };
    }

    case 'list-active': {
      const active = await protocol.listActive();
      const counts = await protocol.countByStatus();
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                action: 'list-active',
                total: active.length,
                counts,
                handoffs: active.map(formatHandoffRecord),
              },
              null,
              2,
            ),
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown handoff action: ${action}`);
  }
}
