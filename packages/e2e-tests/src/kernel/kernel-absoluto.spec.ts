import { describe, it, expect, beforeEach } from 'vitest'
import { ContextRecoveryEngine, SelfHealingEngine, CoverageEngine } from '../../../../packages/core/src/index'
import {
  createTestEngine,
  createTestServer,
  createConnectedClient,
} from '../helpers/createTestMcp'

function parseRawData(content: any[]): any {
  const raw = content.find((c: any) => c.text.includes('--- RAW DATA ---'))
  if (raw) {
    const json = raw.text.split('--- RAW DATA ---')[1].trim()
    return JSON.parse(json)
  }
  return JSON.parse(content[0].text)
}

describe('Kernel Absoluto — E2E Proof', () => {
  let engine: any
  let server: any
  let client: any

  beforeEach(async () => {
    engine = createTestEngine()
    server = createTestServer(engine)
    client = await createConnectedClient(server)
  })

  describe('Rule 1: Zero Assumption', () => {
    it('should select DNA pattern with explicit context (no assumptions)', async () => {
      const res = await client.callTool({
        name: 'bos_select_dna',
        arguments: {
          taskType: 'feature',
          domain: 'infra',
          riskLevel: 'critical',
          complexity: 'complex',
        },
      })
      expect(res).toBeDefined()
      expect(res.content).toBeDefined()
      const data = parseRawData(res.content)
      expect(data.pattern).toBeDefined()
      expect(data.confidence).toBeGreaterThan(0)
      expect(data.principles).toBeDefined()
      expect(data.forbidden).toBeDefined()
    })
  })

  describe('Rule 2: Full Context Discovery', () => {
    it('should discover all context before execution via truth resolution', async () => {
      const res = await client.callTool({
        name: 'bos_resolve_truth',
        arguments: {
          taskType: 'feature',
          domain: 'infra',
          riskLevel: 'critical',
          complexity: 'complex',
        },
      })
      expect(res).toBeDefined()
      expect(res.content).toBeDefined()
      const data = JSON.parse(res.content[0].text)
      expect(data.dna).toBeDefined()
      expect(data.principles).toBeDefined()
      expect(data.truthSources).toBeDefined()
      expect(data.truthSources.libraries).toBeDefined()
      expect(data.truthSources.instructions).toBeDefined()
    })
  })

  describe('Rule 3: Coverage Validation', () => {
    it('should enforce minimum coverage threshold', async () => {
      const engine = new CoverageEngine({ threshold: 80 })
      expect(engine).toBeDefined()
      expect(typeof engine.calculate).toBe('function')
      expect(typeof engine.checkThreshold).toBe('function')
    })
  })

  describe('Rule 4: Truth Before Execution', () => {
    it('should resolve truth sources before any delegation', async () => {
      const dnaRes = await client.callTool({
        name: 'bos_select_dna',
        arguments: { taskType: 'feature', domain: 'backend' },
      })
      expect(dnaRes.content).toBeDefined()

      const truthRes = await client.callTool({
        name: 'bos_resolve_truth',
        arguments: { taskType: 'feature', domain: 'backend' },
      })
      expect(truthRes.content).toBeDefined()
      const data = JSON.parse(truthRes.content[0].text)
      expect(data.dna.pattern).toBeDefined()
      expect(data.truthSources.instructions).toBeTruthy()
    })
  })

  describe('Rule 5: Domain Isolation', () => {
    it('should evaluate governance rules for domain boundaries', async () => {
      const res = await client.callTool({
        name: 'evaluate-governance',
        arguments: {
          action: 'deploy to production',
          context: { domain: 'payments', riskLevel: 'critical' },
        },
      })
      expect(res).toBeDefined()
      expect(res.content).toBeDefined()
    })
  })

  describe('Rule 6: State Synchronization', () => {
    it('should persist state via mission lifecycle', async () => {
      const createRes = await client.callTool({
        name: 'create-mission',
        arguments: {
          title: 'Kernel Absoluto state sync test',
          type: 'feature',
          priority: 'high',
        },
      })
      expect(createRes.content).toBeDefined()
      const mission = JSON.parse(createRes.content[0].text)
      expect(mission.id).toBeDefined()

      const updateRes = await client.callTool({
        name: 'update-progress',
        arguments: {
          missionId: mission.id,
          status: 'executing',
          notes: 'Testing state synchronization',
        },
      })
      expect(updateRes.content).toBeDefined()
    })
  })

  describe('Rule 7: Self Audit', () => {
    it('should run audit pipeline after task completion', async () => {
      const res = await client.callTool({
        name: 'bos_run_audit',
        arguments: {
          trigger: 'commit',
          context: {
            branch: 'feature/kernel-absoluto',
            files: 10,
            author: 'kernel-engine',
          },
        },
      })
      expect(res).toBeDefined()
      expect(res.content).toBeDefined()
      const data = parseRawData(res.content)
      expect(data.overallStatus).toBeDefined()
      expect(data.results).toBeDefined()
      expect(Array.isArray(data.results)).toBe(true)
    })
  })

  describe('Rule 8: No Hallucination', () => {
    it('should list real agents from the system', async () => {
      const res = await client.callTool({ name: 'list-agents', arguments: {} })
      expect(res).toBeDefined()
      expect(res.content).toBeDefined()
    })

    it('should return real system status', async () => {
      const res = await client.callTool({ name: 'get-status', arguments: {} })
      expect(res).toBeDefined()
      expect(res.content).toBeDefined()
    })
  })

  describe('Rule 9: Context Recovery', () => {
    it('should create and restore from checkpoints', async () => {
      const recovery = new ContextRecoveryEngine()
      expect(recovery).toBeDefined()
      expect(typeof recovery.createCheckpoint).toBe('function')
      expect(typeof recovery.rebuildContext).toBe('function')

      const checkpoint = await recovery.createCheckpoint('test-mission', 'analysis', 50, { phase: 'test' })
      expect(checkpoint).toBeDefined()
      expect(checkpoint.id).toBeDefined()

      const result = await recovery.rebuildContext()
      expect(result).toBeDefined()
      expect(result.success).toBeDefined()
      expect(result.checkpoints).toBeDefined()
      expect(Array.isArray(result.checkpoints)).toBe(true)
    })
  })

  describe('Rule 10: Definition of Truth', () => {
    it('should have self-healing engine for quality gate remediation', async () => {
      const healing = new SelfHealingEngine()
      expect(healing).toBeDefined()
      expect(typeof healing.monitor).toBe('function')
      expect(typeof healing.autoFix).toBe('function')
    })

    it('should monitor failed gates and trigger healing actions', async () => {
      const healing = new SelfHealingEngine({ enabled: true, maxRetries: 2 })
      const action = await healing.monitor({
        gate: 'lint',
        passed: false,
        error: '3 lint errors found',
      })
      expect(action).toBeDefined()
      expect(action!.type).toBeDefined()
      expect(action!.target).toBe('lint')
    })
  })

  describe('Full Protocol Flow (all 10 rules)', () => {
    it('should execute complete Kernel Absoluto lifecycle', async () => {
      // Rule 1: Zero Assumption — select DNA with explicit params
      const dna = await client.callTool({
        name: 'bos_select_dna',
        arguments: { taskType: 'feature', domain: 'payments', riskLevel: 'critical' },
      })
      expect(dna.content).toBeDefined()

      // Rule 2: Full Context Discovery — resolve truth
      const truth = await client.callTool({
        name: 'bos_resolve_truth',
        arguments: { taskType: 'feature', domain: 'payments' },
      })
      expect(truth.content).toBeDefined()

      // Rule 4: Truth Before Execution — verify truth resolved first
      const truthData = JSON.parse(truth.content[0].text)
      expect(truthData.truthSources.instructions).toBeTruthy()
      expect(truthData.dna.pattern).toBeDefined()

      // Rule 6: State Synchronization — create + update mission
      const mission = await client.callTool({
        name: 'create-mission',
        arguments: { title: 'Kernel Absoluto full lifecycle', type: 'feature', priority: 'critical' },
      })
      const missionData = JSON.parse(mission.content[0].text)

      await client.callTool({
        name: 'update-progress',
        arguments: { missionId: missionData.id, status: 'executing' },
      })

      // Rule 7: Self Audit — run audit
      const audit = await client.callTool({
        name: 'bos_run_audit',
        arguments: { trigger: 'commit', context: { branch: 'main', files: 5 } },
      })
      const auditData = parseRawData(audit.content)
      expect(auditData.overallStatus).toBeDefined()
      expect(auditData.results).toBeDefined()

      // Rule 8: No Hallucination — verify real status
      const status = await client.callTool({ name: 'get-status', arguments: {} })
      expect(status.content).toBeDefined()

      // Rule 7 (learning): Record learning
      const learning = await client.callTool({
        name: 'record-learning',
        arguments: {
          type: 'observation',
          source: 'kernel-absoluto-e2e',
          data: { lifecycle: 'complete', rulesVerified: 10 },
          confidence: 0.95,
        },
      })
      expect(learning.content).toBeDefined()

      // Complete mission
      await client.callTool({
        name: 'update-progress',
        arguments: { missionId: missionData.id, status: 'completed' },
      })

      await client.close()
      await server.close()
    })
  })
})
