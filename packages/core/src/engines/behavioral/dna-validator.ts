import type { DNAPackage } from '@behavioros/schemas';

// ============================================================
// DNA Validator — Validação avançada de pacotes DNA
// ============================================================

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  code: string;
  message: string;
  path: string;
  severity: 'error';
}

export interface ValidationWarning {
  code: string;
  message: string;
  path: string;
  severity: 'warning';
}

// biome-ignore lint/complexity/noStaticOnlyClass: static utility class pattern for DNA validation
export class DNAValidator {
  /**
   * Validação completa de um pacote DNA
   */
  static validate(dna: DNAPackage): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // 1. Validate personas
    DNAValidator.validatePersonas(dna, errors, warnings);

    // 2. Validate governance rules
    DNAValidator.validateGovernance(dna, errors, warnings);

    // 3. Validate quality gates
    DNAValidator.validateQuality(dna, errors, warnings);

    // 4. Validate patterns
    DNAValidator.validatePatterns(dna, errors, warnings);

    // 5. Validate workflows
    DNAValidator.validateWorkflows(dna, errors, warnings);

    // 6. Validate cross-references
    DNAValidator.validateCrossReferences(dna, errors, warnings);

    // 7. Validate completeness
    DNAValidator.validateCompleteness(dna, errors, warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private static validatePersonas(
    dna: DNAPackage,
    errors: ValidationError[],
    warnings: ValidationWarning[],
  ): void {
    if (dna.personas.length === 0) {
      errors.push({
        code: 'DNA_NO_PERSONAS',
        message: 'DNA package must have at least one persona',
        path: 'personas',
        severity: 'error',
      });
      return;
    }

    const roles = new Set<string>();
    for (const persona of dna.personas) {
      // Check for duplicate roles
      if (roles.has(String(persona.role))) {
        warnings.push({
          code: 'DNA_DUPLICATE_ROLE',
          message: `Duplicate role: ${persona.role}`,
          path: `personas.${String(persona.role)}`,
          severity: 'warning',
        });
      }
      roles.add(String(persona.role));

      // Validate authority levels
      if (persona.authority === 'junior' && !persona.boundaries?.length) {
        warnings.push({
          code: 'DNA_JUNIOR_NO_BOUNDARIES',
          message: `Junior role ${persona.role} has no boundaries defined`,
          path: `personas.${persona.role}.boundaries`,
          severity: 'warning',
        });
      }
    }

    // Check for required roles
    const hasEngineer = roles.has('engineer');
    const hasQA = roles.has('qa');
    if (!hasEngineer) {
      warnings.push({
        code: 'DNA_NO_ENGINEER',
        message: 'DNA package has no engineer role',
        path: 'personas',
        severity: 'warning',
      });
    }
    if (!hasQA) {
      warnings.push({
        code: 'DNA_NO_QA',
        message: 'DNA package has no QA role',
        path: 'personas',
        severity: 'warning',
      });
    }
  }

  private static validateGovernance(
    dna: DNAPackage,
    errors: ValidationError[],
    warnings: ValidationWarning[],
  ): void {
    const rules = dna.governance ?? [];

    if (rules.length === 0) {
      warnings.push({
        code: 'DNA_NO_GOVERNANCE',
        message: 'DNA package has no governance rules defined',
        path: 'governance',
        severity: 'warning',
      });
      return;
    }

    const ids = new Set<string>();
    for (const rule of rules) {
      // Check for duplicate IDs
      if (ids.has(rule.id)) {
        errors.push({
          code: 'DNA_DUPLICATE_GOVERNANCE_ID',
          message: `Duplicate governance rule ID: ${rule.id}`,
          path: `governance.${rule.id}`,
          severity: 'error',
        });
      }
      ids.add(rule.id);

      // Check for critical rules
      if (rule.level === 'critical' && rule.action !== 'block' && rule.action !== 'escalate') {
        warnings.push({
          code: 'DNA_CRITICAL_NO_BLOCK',
          message: `Critical rule ${rule.id} does not block or escalate`,
          path: `governance.${rule.id}`,
          severity: 'warning',
        });
      }
    }
  }

  private static validateQuality(
    dna: DNAPackage,
    errors: ValidationError[],
    warnings: ValidationWarning[],
  ): void {
    const gates = dna.quality ?? [];

    if (gates.length === 0) {
      warnings.push({
        code: 'DNA_NO_QUALITY',
        message: 'DNA package has no quality gates defined',
        path: 'quality',
        severity: 'warning',
      });
      return;
    }

    const names = new Set<string>();
    for (const gate of gates) {
      if (names.has(gate.name)) {
        errors.push({
          code: 'DNA_DUPLICATE_QUALITY_GATE',
          message: `Duplicate quality gate: ${gate.name}`,
          path: `quality.${gate.name}`,
          severity: 'error',
        });
      }
      names.add(gate.name);
    }
  }

  private static validatePatterns(
    dna: DNAPackage,
    errors: ValidationError[],
    warnings: ValidationWarning[],
  ): void {
    const patterns = dna.patterns ?? [];

    if (patterns.length === 0) {
      warnings.push({
        code: 'DNA_NO_PATTERNS',
        message: 'DNA package has no behavior patterns defined',
        path: 'patterns',
        severity: 'warning',
      });
      return;
    }

    const ids = new Set<string>();
    for (const pattern of patterns) {
      if (ids.has(pattern.id)) {
        errors.push({
          code: 'DNA_DUPLICATE_PATTERN_ID',
          message: `Duplicate pattern ID: ${pattern.id}`,
          path: `patterns.${pattern.id}`,
          severity: 'error',
        });
      }
      ids.add(pattern.id);
    }
  }

  private static validateWorkflows(
    dna: DNAPackage,
    errors: ValidationError[],
    warnings: ValidationWarning[],
  ): void {
    const workflows = dna.workflows ?? [];

    const ids = new Set<string>();
    for (const step of workflows) {
      if (ids.has(step.id)) {
        errors.push({
          code: 'DNA_DUPLICATE_WORKFLOW_STEP',
          message: `Duplicate workflow step ID: ${step.id}`,
          path: `workflows.${step.id}`,
          severity: 'error',
        });
      }
      ids.add(step.id);

      // Validate step references
      if (step.next) {
        for (const nextId of step.next) {
          if (!ids.has(nextId) && !workflows.some((w) => w.id === nextId)) {
            warnings.push({
              code: 'DNA_WORKFLOW_STEP_REFERENCE',
              message: `Step ${step.id} references unknown next step: ${nextId}`,
              path: `workflows.${step.id}.next`,
              severity: 'warning',
            });
          }
        }
      }
    }
  }

  private static validateCrossReferences(
    dna: DNAPackage,
    _errors: ValidationError[],
    warnings: ValidationWarning[],
  ): void {
    const agentRoles = new Set(dna.personas.map((p) => p.role));

    // Check pattern triggers reference valid agents
    for (const pattern of dna.patterns ?? []) {
      if (pattern.triggers) {
        for (const trigger of pattern.triggers) {
          // Simple check — can be extended
          if (trigger.includes('agent:') && !agentRoles.has(trigger.replace('agent:', '') as any)) {
            warnings.push({
              code: 'DNA_PATTERN_REFERENCE',
              message: `Pattern ${pattern.id} references unknown agent: ${trigger}`,
              path: `patterns.${pattern.id}.triggers`,
              severity: 'warning',
            });
          }
        }
      }
    }
  }

  private static validateCompleteness(
    dna: DNAPackage,
    _errors: ValidationError[],
    warnings: ValidationWarning[],
  ): void {
    // Check metadata
    if (!dna.description) {
      warnings.push({
        code: 'DNA_NO_DESCRIPTION',
        message: 'DNA package has no description',
        path: 'description',
        severity: 'warning',
      });
    }
    if (!dna.author) {
      warnings.push({
        code: 'DNA_NO_AUTHOR',
        message: 'DNA package has no author',
        path: 'author',
        severity: 'warning',
      });
    }
    if (!dna.version) {
      warnings.push({
        code: 'DNA_NO_VERSION',
        message: 'DNA package has no version',
        path: 'version',
        severity: 'warning',
      });
    }
  }

  /**
   * Validação rápida — retorna apenas se é válido
   */
  static isValid(dna: DNAPackage): boolean {
    return DNAValidator.validate(dna).valid;
  }

  /**
   * Resumo da validação em texto
   */
  static summary(result: ValidationResult): string {
    const lines: string[] = [];
    lines.push(`Valid: ${result.valid ? '✅' : '❌'}`);
    lines.push(`Errors: ${result.errors.length}`);
    lines.push(`Warnings: ${result.warnings.length}`);

    if (result.errors.length > 0) {
      lines.push('\nErrors:');
      for (const error of result.errors) {
        lines.push(`  ❌ [${error.code}] ${error.path}: ${error.message}`);
      }
    }

    if (result.warnings.length > 0) {
      lines.push('\nWarnings:');
      for (const warning of result.warnings) {
        lines.push(`  ⚠️ [${warning.code}] ${warning.path}: ${warning.message}`);
      }
    }

    return lines.join('\n');
  }
}
