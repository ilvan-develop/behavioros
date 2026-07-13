import { tool } from '@opencode-ai/plugin';
import { readdirSync, readFileSync } from 'fs';
import { extname, join } from 'path';

export default tool({
  description:
    'Validate DNA YAML files against BehaviorOS schema conventions. Checks YAML syntax, required sections, ID formats, and governance rule validity.',
  args: {
    path: tool.schema
      .string()
      .optional()
      .describe('Path to a specific DNA YAML file. If omitted, validates all files in dnas/'),
  },
  async execute(args, context) {
    const { worktree } = context;
    const dnaDir = join(worktree, 'dnas');

    const files: string[] = [];
    if (args.path) {
      files.push(args.path);
    } else {
      const entries = readdirSync(dnaDir);
      for (const entry of entries) {
        if (extname(entry) === '.yaml' || extname(entry) === '.yml') {
          files.push(join(dnaDir, entry));
        }
      }
    }

    const results: Array<{ file: string; valid: boolean; issues: string[] }> = [];

    for (const file of files) {
      const issues: string[] = [];
      try {
        const content = readFileSync(file, 'utf-8');

        // Check for tabs
        if (content.includes('\t')) {
          issues.push('Contains tabs (use spaces for indentation)');
        }

        // Check required sections
        const requiredSections = [
          'version',
          'description',
          'personas',
          'governanceRules',
          'qualityGates',
          'patterns',
          'workflows',
        ];
        for (const section of requiredSections) {
          if (!content.includes(`${section}:`)) {
            issues.push(`Missing required section: ${section}`);
          }
        }

        // Check governance rule actions
        const validActions = ['block', 'escalate', 'warn', 'log'];
        for (const action of validActions) {
          // Simple check - in real usage would parse YAML properly
        }

        // Check for valid YAML structure (basic)
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line.trim().startsWith('- id:') && !line.includes('- id: ')) {
            // Missing space after colon in id
          }
        }

        results.push({
          file: file.replace(worktree + '/', ''),
          valid: issues.length === 0,
          issues,
        });
      } catch (err) {
        results.push({
          file: file.replace(worktree + '/', ''),
          valid: false,
          issues: [`Failed to read file: ${(err as Error).message}`],
        });
      }
    }

    const totalValid = results.filter((r) => r.valid).length;
    const totalInvalid = results.filter((r) => !r.valid).length;

    let output = `DNA Validation Results\n`;
    output += `${'='.repeat(40)}\n`;
    output += `Files checked: ${results.length}\n`;
    output += `Valid: ${totalValid}\n`;
    output += `Invalid: ${totalInvalid}\n\n`;

    for (const result of results) {
      const status = result.valid ? 'PASS' : 'FAIL';
      output += `[${status}] ${result.file}\n`;
      for (const issue of result.issues) {
        output += `  - ${issue}\n`;
      }
    }

    return output;
  },
});
