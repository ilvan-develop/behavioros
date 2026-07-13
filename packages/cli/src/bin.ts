#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import { compileCommand } from './commands/compile.js';
import { initCommand } from './commands/init.js';
import { statusCommand } from './commands/status.js';
import { validateCommand } from './commands/validate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let pkg = { name: 'behavioros', version: '0.0.0' };
try {
  const raw = readFileSync(join(__dirname, '..', 'package.json'), 'utf-8');
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
