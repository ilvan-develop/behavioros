import type { ProtocolStateTracker } from '@behavioros/core';
import { z } from 'zod';

export const bosValidateProtocolInput = z.object({});

export type BosValidateProtocolInput = z.infer<typeof bosValidateProtocolInput>;

export async function bosValidateProtocol(protocolTracker: ProtocolStateTracker) {
  const status = protocolTracker.getStatus();

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            valid: status.valid,
            currentStep: status.currentStep,
            currentStepName:
              status.currentStep === 0
                ? 'none'
                : status.currentStep === 1
                  ? 'Select DNA'
                  : status.currentStep === 2
                    ? 'Resolve Truth'
                    : status.currentStep === 3
                      ? 'Create Mission'
                      : status.currentStep === 4
                        ? 'Run Audit'
                        : status.currentStep === 5
                          ? 'Record Learning'
                          : 'unknown',
            nextRequiredStep: status.nextRequiredStep,
            stepsCompleted: status.stepsCompleted,
            stepsMissing: status.stepsMissing,
            orderViolations: status.orderViolations,
            lastActionTimestamps: status.lastActionTimestamps,
          },
          null,
          2,
        ),
      },
    ],
  };
}
