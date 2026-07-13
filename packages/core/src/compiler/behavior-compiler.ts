import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { parse as parseYAML } from 'yaml'
import type { DNAPackage } from '@behavioros/schemas'
import { DNAPackageSchema } from '@behavioros/schemas'

// ============================================================
// Behavior Compiler — YAML → Organization (agents, workflows, MCP, CI/CD)
// ============================================================

export interface CompilerOutput {
  organization: GeneratedOrganization
  files: GeneratedFile[]
}

export interface GeneratedOrganization {
  name: string
  agents: GeneratedAgent[]
  workflows: GeneratedWorkflow[]
  hooks: GeneratedHook[]
  cicd: GeneratedCICD
  mcp: GeneratedMCP
  docs: GeneratedDocs
}

export interface GeneratedAgent {
  id: string
  role: string
  authority: string
  persona: string
  tools: string[]
  systemPrompt: string
}

export interface GeneratedWorkflow {
  id: string
  name: string
  steps: string[]
  triggers: string[]
}

export interface GeneratedHook {
  event: string
  action: string
  config: Record<string, unknown>
}

export interface GeneratedCICD {
  providers: string[]
  stages: string[]
  gates: string[]
}

export interface GeneratedMCP {
  server: string
  tools: string[]
  resources: string[]
}

export interface GeneratedDocs {
  readme: string
  architecture: string
  dna: string
}

export interface GeneratedFile {
  path: string
  content: string
  type: 'typescript' | 'yaml' | 'json' | 'markdown'
}

export class BehaviorCompiler {
  private outputDir: string
  private dryRun: boolean
  private verbose: boolean

  constructor(options?: { outputDir?: string; dryRun?: boolean; verbose?: boolean }) {
    this.outputDir = options?.outputDir ?? './generated'
    this.dryRun = options?.dryRun ?? false
    this.verbose = options?.verbose ?? false
  }

  /**
   * Compila um pacote DNA em uma organização completa
   */
  compile(dna: DNAPackage): CompilerOutput {
    const organization = this.generateOrganization(dna)
    const files = this.generateFiles(dna, organization)

    if (!this.dryRun) {
      this.writeFiles(files)
    }

    return { organization, files }
  }

  /**
   * Compila a partir de um arquivo YAML
   */
  compileFromYAML(yamlPath: string): CompilerOutput {
    const content = readFileSync(yamlPath, 'utf-8')
    const parsed = parseYAML(content)
    const dna = DNAPackageSchema.parse(parsed)
    return this.compile(dna)
  }

  private generateOrganization(dna: DNAPackage): GeneratedOrganization {
    return {
      name: dna.name,
      agents: dna.personas.map((p) => ({
        id: `agent-${p.role}`,
        role: p.role,
        authority: p.authority,
        persona: p.description ?? `${p.role} agent`,
        tools: p.tools ?? [],
        systemPrompt: this.generateSystemPrompt(p),
      })),
      workflows: (dna.workflows ?? []).map((w) => ({
        id: w.id,
        name: w.name,
        steps: w.next ?? [],
        triggers: [],
      })),
      hooks: this.generateHooks(dna),
      cicd: {
        providers: ['github'],
        stages: ['lint', 'typecheck', 'test', 'build', 'deploy'],
        gates: (dna.quality ?? []).map((g) => g.name),
      },
      mcp: {
        server: 'behavioros-mcp',
        tools: ['create-mission', 'get-status', 'update-progress', 'list-agents'],
        resources: ['missions', 'agents', 'audit-log', 'quality-metrics'],
      },
      docs: {
        readme: this.generateReadme(dna),
        architecture: this.generateArchitectureDoc(dna),
        dna: this.generateDNADoc(dna),
      },
    }
  }

  private generateSystemPrompt(persona: DNAPackage['personas'][0]): string {
    const lines: string[] = []
    lines.push(`You are a ${persona.role} with ${persona.authority} authority level.`)
    if (persona.description) {
      lines.push(persona.description)
    }
    if (persona.skills && persona.skills.length > 0) {
      lines.push(`Skills: ${persona.skills.join(', ')}`)
    }
    if (persona.boundaries && persona.boundaries.length > 0) {
      lines.push(`Boundaries: ${persona.boundaries.map((b) => b.name).join(', ')}`)
    }
    return lines.join('\n')
  }

  private generateHooks(dna: DNAPackage): GeneratedHook[] {
    const hooks: GeneratedHook[] = []
    const patterns = dna.patterns ?? []

    for (const pattern of patterns) {
      if (pattern.triggers && pattern.triggers.length > 0) {
        for (const trigger of pattern.triggers) {
          hooks.push({
            event: trigger,
            action: pattern.actions?.[0] ?? 'log',
            config: pattern.config ?? {},
          })
        }
      }
    }

    return hooks
  }

  private generateFiles(dna: DNAPackage, org: GeneratedOrganization): GeneratedFile[] {
    const files: GeneratedFile[] = []

    // Agent configs
    for (const agent of org.agents) {
      files.push({
        path: join('agents', `${agent.id}.ts`),
        content: this.generateAgentFile(agent),
        type: 'typescript',
      })
    }

    // Workflow configs
    for (const workflow of org.workflows) {
      files.push({
        path: join('workflows', `${workflow.id}.yaml`),
        content: this.generateWorkflowFile(workflow),
        type: 'yaml',
      })
    }

    // MCP config
    files.push({
      path: join('mcp', 'server.ts'),
      content: this.generateMCPFile(org.mcp),
      type: 'typescript',
    })

    // CI/CD config
    files.push({
      path: join('.github', 'workflows', 'behavioros.yml'),
      content: this.generateCICDFile(org.cicd),
      type: 'yaml',
    })

    // Docs
    files.push({
      path: 'README.md',
      content: org.docs.readme,
      type: 'markdown',
    })

    return files
  }

  private generateAgentFile(agent: GeneratedAgent): string {
    return `// Auto-generated by BehaviorOS Compiler
export const ${agent.id.replace(/-/g, '_')}Agent = {
  id: '${agent.id}',
  role: '${agent.role}',
  authority: '${agent.authority}',
  persona: '${agent.persona}',
  tools: ${JSON.stringify(agent.tools)},
  systemPrompt: \`${agent.systemPrompt}\`,
}
`
  }

  private generateWorkflowFile(workflow: GeneratedWorkflow): string {
    return `# Auto-generated by BehaviorOS Compiler
name: ${workflow.name}
id: ${workflow.id}
steps:
${workflow.steps.map((s) => `  - ${s}`).join('\n')}
triggers:
${workflow.triggers.map((t) => `  - ${t}`).join('\n')}
`
  }

  private generateMCPFile(mcp: GeneratedMCP): string {
    return `// Auto-generated by BehaviorOS Compiler
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

export function createBehaviorOSMCP() {
  const server = new McpServer({
    name: 'behavioros',
    version: '0.1.0',
  })

  // Register tools
  server.tool('create-mission', 'Create a new mission', async (params) => {
    return { content: [{ type: 'text', text: JSON.stringify(params) }] }
  })

  server.tool('get-status', 'Get current status', async () => {
    return { content: [{ type: 'text', text: 'OK' }] }
  })

  return server
}
`
  }

  private generateCICDFile(cicd: GeneratedCICD): string {
    return `# Auto-generated by BehaviorOS Compiler
name: BehaviorOS CI
on: [push, pull_request]
jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
${cicd.stages.map((s) => `      - name: ${s}\n        run: pnpm ${s}`).join('\n')}
`
  }

  private generateReadme(dna: DNAPackage): string {
    return `# ${dna.name}

${dna.description ?? 'BehaviorOS Organization'}

## Agents
${dna.personas.map((p) => `- **${p.role}** (${p.authority}): ${p.description ?? 'N/A'}`).join('\n')}

## Governance Rules
${(dna.governance ?? []).map((r) => `- ${r.name}: ${r.action} (${r.level})`).join('\n') || 'None defined'}

## Quality Gates
${(dna.quality ?? []).map((g) => `- ${g.name}: ${g.type}`).join('\n') || 'None defined'}

Generated by BehaviorOS Compiler v0.1.0
`
  }

  private generateArchitectureDoc(dna: DNAPackage): string {
    return `# Architecture — ${dna.name}

## Overview
This organization uses ${dna.personas.length} agent roles with ${dna.governance?.length ?? 0} governance rules.

## Agents
${dna.personas.map((p) => `### ${p.role}\n- Authority: ${p.authority}\n- Skills: ${p.skills?.join(', ') ?? 'N/A'}`).join('\n\n')}

Generated by BehaviorOS Compiler v0.1.0
`
  }

  private generateDNADoc(dna: DNAPackage): string {
    return `# DNA Package — ${dna.name}

- **ID**: ${dna.id}
- **Version**: ${dna.version}
- **Author**: ${dna.author ?? 'Unknown'}

## Patterns
${(dna.patterns ?? []).map((p) => `- ${p.name} (${p.type})`).join('\n') || 'None defined'}

Generated by BehaviorOS Compiler v0.1.0
`
  }

  private writeFiles(files: GeneratedFile[]): void {
    for (const file of files) {
      const fullPath = join(this.outputDir, file.path)
      const dir = dirname(fullPath)
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }
      writeFileSync(fullPath, file.content, 'utf-8')
      if (this.verbose) {
        console.log(`Generated: ${file.path}`)
      }
    }
  }
}
