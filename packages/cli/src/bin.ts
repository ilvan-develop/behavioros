#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Command } from 'commander';
import { compileCommand } from './commands/compile.js';
import { initCommand } from './commands/init.js';
import { statusCommand } from './commands/status.js';
import { validateCommand } from './commands/validate.js';

let pkg = { name: 'behavioros', version: '0.0.0' };
try {
  const scriptDir = dirname(process.argv[1]);
  const raw = readFileSync(join(scriptDir, '..', 'package.json'), 'utf-8');
  pkg = JSON.parse(raw);
} catch {
  // fallback for test env or missing package.json
}

const program = new Command()
  .name(pkg.name)
  .description('BehaviorOS CLI — Command-line interface for BehaviorOS')
  .version(pkg.version);

initCommand(program);
compileCommand(program);
validateCommand(program);
statusCommand(program);

export function run(argv = process.argv) {
  program.parse(argv);
}

if (
  process.argv[1]?.endsWith('bin') ||
  process.argv[1]?.endsWith('bin.mjs') ||
  process.argv[1]?.endsWith('bin.js')
) {
  run();
}
