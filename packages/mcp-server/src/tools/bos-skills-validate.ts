import type { SkillEngine } from '@behavioros/core';
import { z } from 'zod';

export const bosSkillsValidateInput = z.object({
  agentId: z.string().describe('Agent ID to check skills for'),
  requiredSkills: z.array(z.string()).describe('List of required skill IDs the agent must have'),
});

export type BosSkillsValidateInput = z.infer<typeof bosSkillsValidateInput>;

export async function bosSkillsValidate(skillEngine: SkillEngine, input: BosSkillsValidateInput) {
  const { agentId, requiredSkills } = input;

  // Use the validateDelegation method (orchestrator = agentId, targetAgent = agentId for self-check)
  const validation = await skillEngine.validateDelegation(agentId, agentId, requiredSkills);

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            allowed: validation.allowed,
            missingSkills: validation.missingSkills,
            insufficientProficiency: validation.insufficientProficiency,
            reason: validation.reason,
            agentId,
            checkedSkills: requiredSkills,
          },
          null,
          2,
        ),
      },
    ],
  };
}
