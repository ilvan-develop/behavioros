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
    // Check if same-DNA access (always allowed)
    if (request.sourceDnaId === request.targetDnaId) {
      return {
        allowed: true,
        reason: 'Same-DNA access allowed',
        requiresApproval: false,
      };
    }

    // Check if cross-DNA access is registered in permission matrix
    const hasPermission = this.permissionMatrix.checkAccess(
      request.sourceDnaId,
      request.targetDnaId,
      request.action,
    );

    if (hasPermission) {
      return {
        allowed: true,
        reason: 'Cross-DNA access permitted by permission matrix',
        requiresApproval: false,
      };
    }

    // Check agent context
    const agentContext = this.contextManager.getAgentContext(request.agentId);
    if (!agentContext) {
      return {
        allowed: false,
        reason: 'Agent context not found',
        requiresApproval: false,
      };
    }

    // Cross-DNA access not registered - requires approval
    return {
      allowed: false,
      reason: 'Cross-DNA access not in permission matrix',
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
