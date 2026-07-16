import { randomUUID } from 'node:crypto';
import type { AgentState, DNAPackage } from '@behavioros/schemas';

// ============================================================
// AgentManager — Extracted from BehaviorOSEngine
// Manages agent registration and queries
// ============================================================

export class AgentManager {
  private agents: Map<string, AgentState> = new Map();

  constructor(dna: DNAPackage) {
    this.initialize(dna);
  }

  private initialize(dna: DNAPackage): void {
    for (const persona of dna.personas) {
      const agent: AgentState = {
        id: `agent-${persona.role}-${randomUUID().slice(0, 8)}`,
        role: persona.role,
        status: 'idle',
        authority: persona.authority,
        completedMissions: [],
        reputation: 50,
      };
      this.agents.set(agent.id, agent);
    }

    if (dna.agent_mapping) {
      for (const mapping of Object.values(dna.agent_mapping)) {
        for (const agentName of mapping.opencode_agents) {
          if (this.agents.has(agentName)) continue;
          const agent: AgentState = {
            id: agentName,
            role: mapping.role,
            status: 'idle',
            authority: mapping.authority,
            completedMissions: [],
            reputation: 50,
          };
          this.agents.set(agent.id, agent);
        }
      }
    }
  }

  get(id: string): AgentState | undefined {
    return this.agents.get(id);
  }

  getByOpenCodeName(name: string): AgentState | undefined {
    return Array.from(this.agents.values()).find((a) => a.id === name);
  }

  getAll(): AgentState[] {
    return Array.from(this.agents.values());
  }

  getByRole(role: string): AgentState[] {
    return Array.from(this.agents.values()).filter((a) => a.role === role);
  }

  getRawMap(): Map<string, AgentState> {
    return this.agents;
  }
}
