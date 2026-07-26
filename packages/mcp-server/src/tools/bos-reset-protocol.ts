import type { ProtocolStateTracker } from '@behavioros/core';
import { z } from 'zod';

export const bosResetProtocolInput = z.object({
  reason: z.string().optional().describe('Reason for resetting protocol state'),
  confirm: z.boolean().describe('Must be true to confirm reset'),
});

export type BosResetProtocolInput = z.infer<typeof bosResetProtocolInput>;

export async function bosResetProtocol(
  protocolTracker: ProtocolStateTracker,
  input: BosResetProtocolInput,
) {
  if (!input.confirm) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            { reset: false, reason: 'Reset not confirmed. Set confirm=true to proceed.' },
            null,
            2,
          ),
        },
      ],
    };
  }

  const previousState = protocolTracker.getStatus();
  protocolTracker.reset();

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            reset: true,
            reason: input.reason ?? 'Manual reset',
            previousState: {
              stepsCompleted: previousState.stepsCompleted,
              currentStep: previousState.currentStep,
            },
            newState: 'All protocol steps reset to incomplete',
          },
          null,
          2,
        ),
      },
    ],
  };
}
