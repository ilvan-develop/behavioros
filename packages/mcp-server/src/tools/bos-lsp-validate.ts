import { z } from 'zod';
import { bosLspDiagnostics } from './bos-lsp-diagnostics.js';

export const bosLspValidateInput = z.object({
  projectPath: z.string().describe('Path to the project root'),
  filePath: z.string().optional().describe('Specific file to validate'),
  failOnError: z.boolean().default(true).describe('Fail if any errors found'),
  failOnWarning: z.boolean().default(false).describe('Fail if any warnings found'),
  maxErrors: z.number().default(0).describe('Maximum allowed errors (0 = no errors)'),
  maxWarnings: z.number().default(10).describe('Maximum allowed warnings'),
});

export type BosLspValidateInput = z.infer<typeof bosLspValidateInput>;

export async function bosLspValidate(input: BosLspValidateInput) {
  const diagResult = await bosLspDiagnostics({
    projectPath: input.projectPath,
    filePath: input.filePath,
    tools: ['typescript', 'eslint'],
    save: true,
  });

  const diagText = diagResult.content[0]?.text ?? '{}';
  const diag = JSON.parse(diagText);

  const errors = diag.summary.errors;
  const warnings = diag.summary.warnings;

  const passed =
    (!input.failOnError || errors <= input.maxErrors) &&
    (!input.failOnWarning || warnings <= input.maxWarnings);

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            passed,
            summary: diag.summary,
            gates: {
              errors: { passed: errors <= input.maxErrors, actual: errors, max: input.maxErrors },
              warnings: {
                passed: warnings <= input.maxWarnings,
                actual: warnings,
                max: input.maxWarnings,
              },
            },
            details: diag.results,
          },
          null,
          2,
        ),
      },
    ],
  };
}
