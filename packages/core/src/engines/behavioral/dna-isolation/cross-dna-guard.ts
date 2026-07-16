import { ContextManager } from './context-manager';
import { PermissionMatrixManager } from './permission-matrix';

export interface CrossDNARequest {
  sourceDnaId: string;
  targetDnaId: string;
  action: string;
  agentId: string;
  payload: unknown;
}

export interface CrossDNAResult {
  allowed: boolean;
  reason: string;
  requiresApproval: boolean;
}

export class CrossDNAGuard {
  private readonly contextManager: ContextManager;
  private readonly permissionMatrix: PermissionMatrixManager;

  constructor() {
    this.contextManager = new ContextManager();
    this.permissionMatrix = new PermissionMatrixManager();
  }

  validate(request: CrossDNARequest): CrossDNAResult {
    if (
      !this.contextManager.validateCrossDNAAccess(
        request.sourceDnaId,
        request.targetDnaId,
        request.action,
      )
    ) {
      return {
        allowed: false,
        reason: 'Cross-DNA access is blocked by default',
        requiresApproval: false,
      };
    }

    const agentContext = this.contextManager.getAgentContext(request.agentId);
    if (!agentContext) {
      return {
        allowed: false,
        reason: 'Agent context not found',
        requiresApproval: false,
      };
    }

    return {
      allowed: false,
      reason: 'Cross-DNA access requires explicit approval',
      requiresApproval: true,
    };
  }

  getContextManager(): ContextManager {
    return this.contextManager;
  }

  getPermissionMatrix(): PermissionMatrixManager {
    return this.permissionMatrix;
  }
}
