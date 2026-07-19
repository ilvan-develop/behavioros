import type { AuthorityLevel } from '../../../domain/boundaries/agent-boundary';
import { AgentContext } from '../../../domain/contexts/agent-context';
import { DNAContext } from '../../../domain/contexts/dna-context';

export class ContextManager {
  private dnaContexts: Map<string, DNAContext> = new Map();
  private agentContexts: Map<string, AgentContext> = new Map();

  createDNAContext(dnaId: string): DNAContext {
    const existing = this.dnaContexts.get(dnaId);
    if (existing) {
      return existing;
    }

    const context = new DNAContext(dnaId);
    this.dnaContexts.set(dnaId, context);
    return context;
  }

  createAgentContext(agentId: string, authority: AuthorityLevel): AgentContext {
    const existing = this.agentContexts.get(agentId);
    if (existing) {
      return existing;
    }

    const context = new AgentContext(agentId, authority);
    this.agentContexts.set(agentId, context);
    return context;
  }

  getDNAContext(dnaId: string): DNAContext | undefined {
    return this.dnaContexts.get(dnaId);
  }

  getAgentContext(agentId: string): AgentContext | undefined {
    return this.agentContexts.get(agentId);
  }

  validateCrossDNAAccess(sourceDnaId: string, targetDnaId: string, _action: string): boolean {
    if (sourceDnaId === targetDnaId) {
      return true;
    }
    return false;
  }

  clear(): void {
    this.dnaContexts.clear();
    this.agentContexts.clear();
  }
}
