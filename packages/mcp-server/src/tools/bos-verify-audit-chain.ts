import type { AuditChainVerifier } from '@behavioros/core';
import { z } from 'zod';

export const bosVerifyAuditChainInput = z.object({
  scope: z
    .enum(['full', 'last-10'])
    .optional()
    .default('full')
    .describe('Verify the entire chain from genesis, or just the last 10 entries'),
});

export type BosVerifyAuditChainInput = z.infer<typeof bosVerifyAuditChainInput>;

export async function bosVerifyAuditChain(
  verifier: AuditChainVerifier,
  input: BosVerifyAuditChainInput,
) {
  const result = input.scope === 'last-10' ? verifier.verifyLast(10) : verifier.verify();
  const report = verifier.report(result);

  return {
    content: [
      { type: 'text' as const, text: report },
      {
        type: 'text' as const,
        text: `\n--- RAW DATA ---\n${JSON.stringify(result, null, 2)}`,
      },
    ],
  };
}
