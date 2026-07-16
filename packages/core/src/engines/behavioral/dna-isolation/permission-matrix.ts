export interface Permission {
  allowed: boolean;
  scope: 'local' | 'global' | 'dna-bound' | 'mixed';
  requiresApproval?: boolean;
  rateLimit?: string;
  audit?: boolean;
  governance?: boolean;
}

export type DNAMode = 'conversational' | 'transactional' | 'hybrid';
export type PermissionAction = 'read' | 'write' | 'api' | 'state';

export interface PermissionMatrix {
  conversational: Record<PermissionAction, Permission>;
  transactional: Record<PermissionAction, Permission>;
  hybrid: Record<PermissionAction, Permission>;
}

const defaultMatrix: PermissionMatrix = {
  conversational: {
    read: { allowed: true, scope: 'local' },
    write: { allowed: false, scope: 'local' },
    api: { allowed: false, scope: 'local' },
    state: { allowed: false, scope: 'local' },
  },
  transactional: {
    read: { allowed: true, scope: 'global' },
    write: { allowed: true, scope: 'local', requiresApproval: true },
    api: { allowed: true, scope: 'global', rateLimit: '100/min' },
    state: { allowed: true, scope: 'global', audit: true },
  },
  hybrid: {
    read: { allowed: true, scope: 'global' },
    write: { allowed: true, scope: 'dna-bound', governance: true },
    api: { allowed: true, scope: 'mixed', requiresApproval: true },
    state: { allowed: true, scope: 'mixed', audit: true },
  },
};

export class PermissionMatrixManager {
  private matrix: PermissionMatrix = structuredClone(defaultMatrix);

  getPermission(dnaMode: DNAMode, action: PermissionAction): Permission {
    return this.matrix[dnaMode][action];
  }

  validateAction(dnaMode: string, action: string): boolean {
    const mode = dnaMode as DNAMode;
    const act = action as PermissionAction;

    if (!this.matrix[mode]?.[act]) {
      return false;
    }

    return this.matrix[mode][act].allowed;
  }

  requiresApproval(dnaMode: string, action: string): boolean {
    const mode = dnaMode as DNAMode;
    const act = action as PermissionAction;

    if (!this.matrix[mode]?.[act]) {
      return false;
    }

    return this.matrix[mode][act].requiresApproval ?? false;
  }

  getMatrix(): PermissionMatrix {
    return structuredClone(this.matrix);
  }
}
