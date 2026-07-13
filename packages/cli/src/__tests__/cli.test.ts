import { describe, it, expect, beforeEach } from 'vitest'
import { Command } from 'commander'
import { sep } from 'node:path'
import { DNALoader, DNAValidator, BehaviorCompiler } from '@behavioros/core'
import { initCommand } from '../commands/init.js'
import { compileCommand } from '../commands/compile.js'
import { validateCommand } from '../commands/validate.js'
import { statusCommand } from '../commands/status.js'
import type { DNAPackage } from '@behavioros/schemas'

const createTestDNA = (overrides?: Partial<DNAPackage>): DNAPackage => ({
  id: 'test-cli',
  name: 'Test CLI DNA',
  version: '1.0.0',
  description: 'A test DNA for CLI unit tests',
  author: 'test',
  personas: [
    { role: 'engineer', authority: 'senior', name: 'Engineer' },
    { role: 'qa', authority: 'senior', name: 'QA' },
  ],
  governance: [
    { id: 'gov-1', name: 'Code Review', level: 'medium', action: 'warn' },
  ],
  quality: [
    { id: 'qg-1', name: 'Test Coverage', type: 'test_coverage', threshold: 80 },
  ],
  patterns: [
    { id: 'pat-1', name: 'Review', type: 'review', triggers: ['agent:engineer'], actions: ['review'] },
  ],
  workflows: [
    { id: 'wf-1', name: 'Feature', type: 'action', next: ['wf-2'] },
    { id: 'wf-2', name: 'Review', type: 'gate', next: [] },
  ],
  ...overrides,
})

// ─── Commander Program Setup ─────────────────────────────

describe('CLI Program Setup', () => {
  let program: Command

  beforeEach(() => {
    program = new Command()
    program.name('behavioros-test').version('0.1.0-test')
  })

  it('should register init command', () => {
    initCommand(program)
    const commands = program.commands.map((c) => c.name())
    expect(commands).toContain('init')
  })

  it('should register compile command', () => {
    compileCommand(program)
    const commands = program.commands.map((c) => c.name())
    expect(commands).toContain('compile')
  })

  it('should register validate command', () => {
    validateCommand(program)
    const commands = program.commands.map((c) => c.name())
    expect(commands).toContain('validate')
  })

  it('should register status command', () => {
    statusCommand(program)
    const commands = program.commands.map((c) => c.name())
    expect(commands).toContain('status')
  })

  it('should register all four commands at once', () => {
    initCommand(program)
    compileCommand(program)
    validateCommand(program)
    statusCommand(program)
    const commands = program.commands.map((c) => c.name())
    expect(commands).toEqual(expect.arrayContaining(['init', 'compile', 'validate', 'status']))
    expect(commands).toHaveLength(4)
  })
})

// ─── DNA Loading (via Core) ──────────────────────────────

describe('DNA Loading', () => {
  it('should load DNA from YAML string', () => {
    const loader = new DNALoader({ validate: true })
    const yaml = `
id: cli-test
name: CLI Test DNA
version: '1.0.0'
personas:
  - role: engineer
    authority: senior
`
    const dna = loader.loadFromString(yaml)
    expect(dna.id).toBe('cli-test')
    expect(dna.personas).toHaveLength(1)
    expect(dna.personas[0].role).toBe('engineer')
  })

  it('should load DNA with empty personas (schema allows it, validator catches it)', () => {
    const loader = new DNALoader({ validate: true })
    const dna = loader.loadFromString(`
id: empty-personas
name: Empty Personas
version: '1.0.0'
personas: []
`)
    expect(dna.id).toBe('empty-personas')
    expect(dna.personas).toHaveLength(0)
    const result = DNAValidator.validate(dna)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'DNA_NO_PERSONAS')).toBe(true)
  })
})

// ─── DNA Validation (via Core) ───────────────────────────

describe('DNA Validation', () => {
  it('should validate a complete DNA package', () => {
    const dna = createTestDNA()
    const result = DNAValidator.validate(dna)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('should detect missing personas as error', () => {
    const dna = createTestDNA({ personas: [] })
    const result = DNAValidator.validate(dna)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'DNA_NO_PERSONAS')).toBe(true)
  })

  it('should warn about missing description', () => {
    const dna = createTestDNA({ description: undefined })
    const result = DNAValidator.validate(dna)
    expect(result.warnings.some((w) => w.code === 'DNA_NO_DESCRIPTION')).toBe(true)
  })

  it('should warn about missing author', () => {
    const dna = createTestDNA({ author: undefined })
    const result = DNAValidator.validate(dna)
    expect(result.warnings.some((w) => w.code === 'DNA_NO_AUTHOR')).toBe(true)
  })

  it('should return a human-readable summary', () => {
    const dna = createTestDNA()
    const result = DNAValidator.validate(dna)
    const summary = DNAValidator.summary(result)
    expect(summary).toContain('Valid:')
    expect(summary).toContain('Errors:')
    expect(summary).toContain('Warnings:')
  })
})

// ─── Behavior Compiler (via Core) ────────────────────────

describe('Behavior Compiler', () => {
  it('should compile a DNA package into organization', () => {
    const dna = createTestDNA()
    const compiler = new BehaviorCompiler({ dryRun: true })
    const output = compiler.compile(dna)

    expect(output.organization.name).toBe('Test CLI DNA')
    expect(output.organization.agents).toHaveLength(2)
    expect(output.organization.agents[0].role).toBe('engineer')
    expect(output.organization.agents[1].role).toBe('qa')
    expect(output.files.length).toBeGreaterThan(0)
  })

  it('should generate agent files in agents/ directory', () => {
    const dna = createTestDNA()
    const compiler = new BehaviorCompiler({ dryRun: true })
    const output = compiler.compile(dna)

    const agentFiles = output.files.filter((f) => f.path.includes(`agents${sep}`) || f.path.startsWith('agents/'))
    expect(agentFiles).toHaveLength(2)
    expect(agentFiles.every((f) => f.type === 'typescript')).toBe(true)
  })

  it('should generate workflow files in workflows/ directory', () => {
    const dna = createTestDNA()
    const compiler = new BehaviorCompiler({ dryRun: true })
    const output = compiler.compile(dna)

    const workflowFiles = output.files.filter((f) => f.path.includes(`workflows${sep}`) || f.path.startsWith('workflows/'))
    expect(workflowFiles.length).toBeGreaterThan(0)
    expect(workflowFiles.every((f) => f.type === 'yaml')).toBe(true)
  })

  it('should compile from YAML path on disk', () => {
    const { writeFileSync, mkdirSync, rmSync, existsSync } = require('node:fs')
    const { join } = require('node:path')
    const tmpDir = join(process.cwd(), '__cli_test_tmp__')
    const tmpFile = join(tmpDir, 'test-dna.yaml')

    mkdirSync(tmpDir, { recursive: true })
    writeFileSync(
      tmpFile,
      `id: yaml-compile
name: YAML Compile Test
version: '1.0.0'
personas:
  - role: engineer
    authority: senior
`,
      'utf-8',
    )

    try {
      const compiler = new BehaviorCompiler({ dryRun: true })
      const output = compiler.compileFromYAML(tmpFile)
      expect(output.organization.name).toBe('YAML Compile Test')
      expect(output.organization.agents).toHaveLength(1)
    } finally {
      if (existsSync(tmpDir)) {
        rmSync(tmpDir, { recursive: true })
      }
    }
  })

  it('should generate MCP server file', () => {
    const dna = createTestDNA()
    const compiler = new BehaviorCompiler({ dryRun: true })
    const output = compiler.compile(dna)

    const mcpFile = output.files.find((f) => f.path.includes(`mcp${sep}`) || f.path.startsWith('mcp/'))
    expect(mcpFile).toBeDefined()
    expect(mcpFile!.content).toContain('McpServer')
  })
})
