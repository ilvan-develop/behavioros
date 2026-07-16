import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { z } from 'zod';

export const bosLspDiagnosticsInput = z.object({
  projectPath: z.string().describe('Path to the project root'),
  filePath: z
    .string()
    .optional()
    .describe('Specific file to analyze (optional, runs on whole project if omitted)'),
  tools: z
    .array(z.enum(['typescript', 'eslint', 'biome']))
    .default(['typescript'])
    .describe('Diagnostic tools to run'),
  save: z.boolean().default(true).describe('Save results to .ai/diagnostics/'),
});

export type BosLspDiagnosticsInput = z.infer<typeof bosLspDiagnosticsInput>;

interface Diagnostic {
  file: string;
  line: number;
  column: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
  source: string;
}

interface LintResult {
  tool: string;
  success: boolean;
  diagnostics: Diagnostic[];
  error?: string;
}

function runTSC(projectPath: string, filePath?: string): LintResult {
  try {
    const result = execSync('npx tsc --noEmit --pretty false 2>&1', {
      cwd: projectPath,
      encoding: 'utf-8',
      timeout: 60000,
      maxBuffer: 10 * 1024 * 1024,
    });

    const diagnostics = parseTSCOutput(result, projectPath, filePath);
    return { tool: 'typescript', success: diagnostics.length === 0, diagnostics };
  } catch (e: unknown) {
    const err = e as { stdout?: string; message?: string };
    const output = err.stdout || err.message || '';
    const diagnostics = parseTSCOutput(output, projectPath, filePath);
    return { tool: 'typescript', success: false, diagnostics, error: err.message };
  }
}

function parseTSCOutput(output: string, projectPath: string, filePath?: string): Diagnostic[] {
  const lines = output.split('\n');
  const diagnostics: Diagnostic[] = [];

  for (const line of lines) {
    // Match: file.ts(10,5): error TS2345: ...
    const match = line.match(/^(.+?)\((\d+),(\d+)\):\s+(error|warning)\s+TS\d+:\s+(.+)$/);
    if (match) {
      const file = relative(projectPath, match[1]).replace(/\\/g, '/');
      if (filePath && !file.includes(relative(projectPath, filePath).replace(/\\/g, '/'))) continue;

      diagnostics.push({
        file,
        line: parseInt(match[2], 10),
        column: parseInt(match[3], 10),
        severity: match[4].toLowerCase() as 'error' | 'warning',
        message: match[5].trim(),
        source: 'typescript',
      });
    }
  }
  return diagnostics;
}

function findESLintConfig(projectPath: string): string | undefined {
  const configFiles = [
    'eslint.config.js',
    'eslint.config.mjs',
    'eslint.config.cjs',
    'eslint.config.ts',
    'eslint.config.mts',
    '.eslintrc.js',
    '.eslintrc.cjs',
    '.eslintrc.yaml',
    '.eslintrc.yml',
    '.eslintrc.json',
  ];
  for (const file of configFiles) {
    const configPath = resolve(projectPath, file);
    if (existsSync(configPath)) return configPath;
  }
  return undefined;
}

function findBiomeConfig(projectPath: string): string | undefined {
  const configFiles = ['biome.json', 'biome.jsonc', '.biomejson', '.biomejsonc'];
  for (const file of configFiles) {
    const configPath = resolve(projectPath, file);
    if (existsSync(configPath)) return configPath;
  }
  return undefined;
}

function runBiome(projectPath: string, filePath?: string): LintResult {
  try {
    const target = filePath ? relative(projectPath, filePath).replace(/\\/g, '/') : '.';
    const biomeConfig = findBiomeConfig(projectPath);
    const configArgs = biomeConfig ? `--config-path "${projectPath}"` : '';

    const _result = execSync(
      `npx @biomejs/biome ci ${configArgs} "${target}" --reporter=json 2>&1`,
      {
        cwd: projectPath,
        encoding: 'utf-8',
        timeout: 60000,
        maxBuffer: 10 * 1024 * 1024,
      },
    );

    const diagnostics: Diagnostic[] = [];
    return { tool: 'biome', success: diagnostics.length === 0, diagnostics };
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    const output = err.stdout || err.stderr || '[]';

    if (
      output.includes('This is a bug in Biome') ||
      output.includes('Biome encountered an unexpected error')
    ) {
      return {
        tool: 'biome',
        success: false,
        diagnostics: [],
        error:
          'Biome internal error — run on specific files instead of directory. Example: biome check src/file.ts',
      };
    }

    try {
      const parsed = JSON.parse(output);
      const diagnostics: Diagnostic[] = [];
      const diags = parsed.diagnostics || parsed.errors || [];
      for (const d of diags) {
        const location = d.location || {};
        const span = location.span || {};
        const file = location.file
          ? relative(projectPath, location.file).replace(/\\/g, '/')
          : 'unknown';
        const msg = d.description || d.message || JSON.stringify(d);
        diagnostics.push({
          file,
          line: span.start?.line || 0,
          column: span.start?.column || 0,
          severity:
            d.severity === 'error' ? 'error' : d.severity === 'warning' ? 'warning' : 'info',
          message: typeof msg === 'string' ? msg : msg.join(' '),
          source: 'biome',
        });
      }
      return { tool: 'biome', success: diagnostics.length === 0, diagnostics };
    } catch {
      return { tool: 'biome', success: false, diagnostics: [], error: err.message };
    }
  }
}

function runESLint(projectPath: string, filePath?: string): LintResult {
  const configPath = findESLintConfig(projectPath);
  if (!configPath) {
    const biomeConfig = findBiomeConfig(projectPath);
    if (biomeConfig) {
      return runBiome(projectPath, filePath);
    }
    return {
      tool: 'eslint',
      success: false,
      diagnostics: [],
      error: 'No ESLint or Biome config found',
    };
  }

  try {
    const target = filePath ? relative(projectPath, filePath).replace(/\\/g, '/') : '.';

    const args = ['--format json'];
    args.push(`--config "${configPath}"`);
    args.push(`"${target}"`);

    const result = execSync(`npx eslint ${args.join(' ')} 2>&1`, {
      cwd: projectPath,
      encoding: 'utf-8',
      timeout: 60000,
      maxBuffer: 10 * 1024 * 1024,
    });

    const parsed = JSON.parse(result);
    const diagnostics: Diagnostic[] = [];
    for (const fileResult of parsed) {
      for (const msg of fileResult.messages || []) {
        diagnostics.push({
          file: relative(projectPath, fileResult.filePath).replace(/\\/g, '/'),
          line: msg.line || 0,
          column: msg.column || 0,
          severity: msg.severity === 2 ? 'error' : msg.severity === 1 ? 'warning' : 'info',
          message: msg.message,
          source: 'eslint',
        });
      }
    }
    return { tool: 'eslint', success: diagnostics.length === 0, diagnostics };
  } catch (e: unknown) {
    const err = e as { stdout?: string; message?: string };
    const output = err.stdout || '[]';
    try {
      const parsed = JSON.parse(output);
      const diagnostics: Diagnostic[] = [];
      for (const fileResult of parsed) {
        for (const msg of fileResult.messages || []) {
          diagnostics.push({
            file: relative(projectPath, fileResult.filePath).replace(/\\/g, '/'),
            line: msg.line || 0,
            column: msg.column || 0,
            severity: msg.severity === 2 ? 'error' : msg.severity === 1 ? 'warning' : 'info',
            message: msg.message,
            source: 'eslint',
          });
        }
      }
      return { tool: 'eslint', success: diagnostics.length === 0, diagnostics };
    } catch {
      return { tool: 'eslint', success: false, diagnostics: [], error: err.message };
    }
  }
}

export async function bosLspDiagnostics(input: BosLspDiagnosticsInput) {
  const results: LintResult[] = [];

  if (input.tools.includes('typescript')) {
    results.push(runTSC(input.projectPath, input.filePath));
  }
  if (input.tools.includes('biome')) {
    results.push(runBiome(input.projectPath, input.filePath));
  } else if (input.tools.includes('eslint')) {
    results.push(runESLint(input.projectPath, input.filePath));
  }

  const hasErrors = results.some(
    (r) => !r.success || r.diagnostics.some((d) => d.severity === 'error'),
  );
  const totalDiagnostics = results.reduce((sum, r) => sum + r.diagnostics.length, 0);

  if (input.save) {
    const diagDir = resolve(input.projectPath, '.ai/diagnostics');
    if (!existsSync(diagDir)) mkdirSync(diagDir, { recursive: true });

    const report = {
      timestamp: new Date().toISOString(),
      projectPath: input.projectPath,
      filePath: input.filePath,
      results,
      summary: {
        total: totalDiagnostics,
        errors: results.reduce(
          (sum, r) => sum + r.diagnostics.filter((d) => d.severity === 'error').length,
          0,
        ),
        warnings: results.reduce(
          (sum, r) => sum + r.diagnostics.filter((d) => d.severity === 'warning').length,
          0,
        ),
        hasErrors,
      },
    };
    writeFileSync(
      resolve(diagDir, `bos-diagnostics-${Date.now()}.json`),
      JSON.stringify(report, null, 2),
    );
  }

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            success: !hasErrors,
            summary: {
              total: totalDiagnostics,
              errors: results.reduce(
                (sum, r) => sum + r.diagnostics.filter((d) => d.severity === 'error').length,
                0,
              ),
              warnings: results.reduce(
                (sum, r) => sum + r.diagnostics.filter((d) => d.severity === 'warning').length,
                0,
              ),
            },
            results: results.map((r) => ({
              tool: r.tool,
              success: r.success,
              count: r.diagnostics.length,
              diagnostics: r.diagnostics.slice(0, 100),
              error: r.error,
            })),
          },
          null,
          2,
        ),
      },
    ],
  };
}
