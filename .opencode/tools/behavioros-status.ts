import { tool } from '@opencode-ai/plugin';
import { existsSync, readdirSync } from 'fs';
import { extname, join } from 'path';

export default tool({
  description:
    'Get BehaviorOS system status: package health, DNA inventory, engine status, and project configuration overview.',
  args: {},
  async execute(args, context) {
    const { worktree } = context;

    // Check DNA inventory
    const dnaDir = join(worktree, 'dnas');
    let dnaFiles: string[] = [];
    if (existsSync(dnaDir)) {
      dnaFiles = readdirSync(dnaDir).filter((f) => extname(f) === '.yaml' || extname(f) === '.yml');
    }

    // Check packages
    const packagesDir = join(worktree, 'packages');
    const packages: Array<{ name: string; hasDist: boolean; hasTests: boolean }> = [];
    if (existsSync(packagesDir)) {
      const pkgDirs = readdirSync(packagesDir);
      for (const dir of pkgDirs) {
        const pkgJsonPath = join(packagesDir, dir, 'package.json');
        if (existsSync(pkgJsonPath)) {
          const pkgJson = JSON.parse(require('fs').readFileSync(pkgJsonPath, 'utf-8'));
          packages.push({
            name: pkgJson.name || dir,
            hasDist: existsSync(join(packagesDir, dir, 'dist')),
            hasTests: existsSync(join(packagesDir, dir, 'src', '__tests__')),
          });
        }
      }
    }

    // Check apps
    const appsDir = join(worktree, 'apps');
    const apps: string[] = [];
    if (existsSync(appsDir)) {
      const appDirs = readdirSync(appsDir);
      for (const dir of appDirs) {
        const appJsonPath = join(appsDir, dir, 'package.json');
        if (existsSync(appJsonPath)) {
          const appJson = JSON.parse(require('fs').readFileSync(appJsonPath, 'utf-8'));
          apps.push(appJson.name || dir);
        }
      }
    }

    // Check config files
    const configFiles = [
      'opencode.json',
      'AGENTS.md',
      'biome.json',
      'turbo.json',
      'tsconfig.json',
      'pnpm-workspace.yaml',
    ];
    const existingConfigs = configFiles.filter((f) => existsSync(join(worktree, f)));

    // Check .opencode structure
    const opencodeDir = join(worktree, '.opencode');
    const opencodeDirs: string[] = [];
    if (existsSync(opencodeDir)) {
      const entries = readdirSync(opencodeDir);
      for (const entry of entries) {
        const fullPath = join(opencodeDir, entry);
        try {
          const stat = require('fs').statSync(fullPath);
          if (stat.isDirectory()) {
            opencodeDirs.push(entry);
          }
        } catch {
          // skip
        }
      }
    }

    // Build report
    let report = `BehaviorOS System Status\n`;
    report += `${'='.repeat(40)}\n\n`;

    report += `Project: ${worktree}\n`;
    report += `Packages: ${packages.length}\n`;
    report += `Apps: ${apps.length}\n`;
    report += `DNA Files: ${dnaFiles.length}\n\n`;

    report += `Packages:\n`;
    for (const pkg of packages) {
      const dist = pkg.hasDist ? 'built' : 'not built';
      const tests = pkg.hasTests ? 'has tests' : 'no tests';
      report += `  - ${pkg.name} (${dist}, ${tests})\n`;
    }

    report += `\nApps:\n`;
    for (const app of apps) {
      report += `  - ${app}\n`;
    }

    report += `\nDNA Inventory:\n`;
    for (const dna of dnaFiles) {
      report += `  - ${dna}\n`;
    }

    report += `\nConfiguration Files:\n`;
    for (const config of existingConfigs) {
      report += `  - ${config}\n`;
    }

    report += `\nOpenCode Setup:\n`;
    if (opencodeDirs.length > 0) {
      for (const dir of opencodeDirs) {
        report += `  - .opencode/${dir}/\n`;
      }
    } else {
      report += `  No .opencode directory found\n`;
    }

    return report;
  },
});
