import type { BehaviorOSEngine } from '@behavioros/core'

export async function getStatus(engine: BehaviorOSEngine) {
  const stats = engine.getStats()
  const agents = engine.getAllAgents()
  const missions = engine.getAllMissions()
  const governanceRules = engine.getGovernanceRules()
  const qualityGates = engine.getQualityGates()

  const status = {
    ...stats,
    agents: agents.map((a) => ({
      id: a.id,
      role: a.role,
      status: a.status,
      reputation: a.reputation,
    })),
    activeMissions: missions.filter((m) => m.status === 'executing').length,
    governanceRules: governanceRules.length,
    qualityGates: qualityGates.length,
  }

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(status, null, 2),
      },
    ],
  }
}
