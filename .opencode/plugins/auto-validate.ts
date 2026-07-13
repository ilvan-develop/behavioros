import type { Plugin } from '@opencode-ai/plugin';

export const AutoValidatePlugin: Plugin = async ({ project, $, worktree }) => {
  return {
    'file.edited': async (input) => {
      // Auto-validate DNA files when they are edited
      if (input.filePath.includes('dnas/') && input.filePath.endsWith('.yaml')) {
        try {
          const result = await $`node -e "
            const fs = require('fs');
            const content = fs.readFileSync('${input.filePath}', 'utf-8');
            const issues = [];
            if (content.includes('\\t')) issues.push('Contains tabs');
            const required = ['version', 'personas', 'governanceRules', 'qualityGates', 'patterns', 'workflows'];
            for (const s of required) {
              if (!content.includes(s + ':')) issues.push('Missing section: ' + s);
            }
            if (issues.length > 0) {
              console.log('DNA validation warnings for ' + '${input.filePath}'.split('/').pop() + ':');
              issues.forEach(i => console.log('  - ' + i));
            } else {
              console.log('DNA file OK: ' + '${input.filePath}'.split('/').pop());
            }
          "
          `
            .cwd(worktree)
            .text();

          if (result.trim()) {
            // Log the validation result (will appear in OpenCode logs)
            console.log(`[auto-validate] ${result.trim()}`);
          }
        } catch (err) {
          console.error(`[auto-validate] Error: ${(err as Error).message}`);
        }
      }
    },
  };
};
