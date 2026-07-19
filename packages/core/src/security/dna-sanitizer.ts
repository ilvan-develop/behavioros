import type { DNAPackage } from '@behavioros/schemas';
import { parse as parseYAML } from 'yaml';

// ============================================================
// DNA Sanitizer — Validates DNA content against injection attacks
// ============================================================

const SUSPICIOUS_PATTERNS: RegExp[] = [
  /ignore\s+(previous|all)\s+instructions/i,
  /you\s+are\s+now\s+(a|an)/i,
  /forget\s+(your|all)\s+(rules|instructions)/i,
  /bypass\s+(all|every|the)\s+(security|governance)/i,
  /override\s+(all|every|the)\s+(restrictions)/i,
  /disable\s+(all|every|the)\s+(safety)/i,
  /eval\s*\(/i,
  /exec\s*\(/i,
  /<script/i,
  /require\s*\(\s*['"]child_process['"]\s*\)/i,
  /process\.exit/i,
  /system\s*\(/i,
];

const FORBIDDEN_GOVERNANCE_ACTIONS = ['auto_approve'];

const FORBIDDEN_PERSONA_PATTERNS = [
  /\badmin\b/i,
  /\broot\b/i,
  /\bsuperuser\b/i,
  /\bunrestricted\b/i,
  /\bno\s+limits?\b/i,
  /\bbypass\s+all\b/i,
];

export interface SanitizationResult {
  safe: boolean;
  violations: SanitizationViolation[];
  riskScore: number; // 0-100
}

export interface SanitizationViolation {
  type: 'prompt_injection' | 'forbidden_action' | 'suspicious_persona' | 'suspicious_pattern';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  location?: string;
}

/**
 * Sanitize DNA YAML content against injection attacks and dangerous configurations.
 */
export function sanitizeDNA(yamlContent: string): SanitizationResult {
  const violations: SanitizationViolation[] = [];

  // Check for prompt injection patterns in raw YAML
  for (const pattern of SUSPICIOUS_PATTERNS) {
    const match = yamlContent.match(pattern);
    if (match) {
      violations.push({
        type: 'prompt_injection',
        severity: 'critical',
        description: `Suspicious pattern detected: ${pattern.source}`,
        location: `Match: "${match[0]}"`,
      });
    }
  }

  // Parse YAML and validate structure
  try {
    const parsed = parseYAML(yamlContent) as DNAPackage;

    // Check governance rules
    if (parsed.governance) {
      for (const rule of parsed.governance) {
        if (FORBIDDEN_GOVERNANCE_ACTIONS.includes(rule.action)) {
          violations.push({
            type: 'forbidden_action',
            severity: 'critical',
            description: `Forbidden governance action: ${rule.action}`,
            location: `Rule: ${rule.id}`,
          });
        }
      }
    }

    // Check personas
    if (parsed.personas) {
      for (const persona of parsed.personas) {
        // Check for suspicious persona descriptions
        if (persona.description) {
          for (const pattern of FORBIDDEN_PERSONA_PATTERNS) {
            if (pattern.test(persona.description)) {
              violations.push({
                type: 'suspicious_persona',
                severity: 'high',
                description: `Suspicious persona description: ${persona.description}`,
                location: `Persona: ${persona.role}`,
              });
            }
          }
        }

        // Check for excessive authority
        if (persona.authority === 'c-level' || persona.authority === 'vp') {
          violations.push({
            type: 'suspicious_persona',
            severity: 'medium',
            description: `High authority persona: ${persona.authority}`,
            location: `Persona: ${persona.role}`,
          });
        }

        // Check for missing boundaries
        if (!persona.boundaries || persona.boundaries.length === 0) {
          violations.push({
            type: 'suspicious_persona',
            severity: 'medium',
            description: 'Persona has no boundaries defined',
            location: `Persona: ${persona.role}`,
          });
        }
      }
    }
  } catch {
    violations.push({
      type: 'suspicious_pattern',
      severity: 'high',
      description: 'Failed to parse YAML content',
    });
  }

  // Calculate risk score
  const riskScore = calculateRiskScore(violations);

  return {
    safe: violations.filter((v) => v.severity === 'critical').length === 0,
    violations,
    riskScore,
  };
}

/**
 * Analyze intent of a DNA package for risk scoring.
 */
export function analyzeIntent(dna: DNAPackage): {
  riskScore: number;
  flags: string[];
  recommendation: 'approve' | 'review' | 'reject';
} {
  const flags: string[] = [];
  let riskScore = 0;

  // Check for authority escalation
  const authorityLevels: Record<string, number> = {
    junior: 1,
    senior: 2,
    architect: 3,
    lead: 4,
    director: 5,
    vp: 6,
    'c-level': 7,
  };

  const maxAuthority = Math.max(...dna.personas.map((p) => authorityLevels[p.authority] ?? 0));

  if (maxAuthority >= 6) {
    flags.push('high-authority-persona');
    riskScore += 20;
  }

  // Check for governance bypass
  if (dna.governance?.every((r) => r.action === 'warn' || r.action === 'log')) {
    flags.push('no-enforcement-rules');
    riskScore += 30;
  }

  // Check for missing boundaries
  const agentsWithoutBoundaries = dna.personas.filter(
    (p) => !p.boundaries || p.boundaries.length === 0,
  );

  if (agentsWithoutBoundaries.length > 0) {
    flags.push('agents-without-boundaries');
    riskScore += 15;
  }

  // Check for too many personas
  if (dna.personas.length > 10) {
    flags.push('excessive-personas');
    riskScore += 10;
  }

  return {
    riskScore: Math.min(100, riskScore),
    flags,
    recommendation: riskScore > 70 ? 'reject' : riskScore > 30 ? 'review' : 'approve',
  };
}

function calculateRiskScore(violations: SanitizationViolation[]): number {
  const severityWeights: Record<string, number> = {
    critical: 40,
    high: 25,
    medium: 15,
    low: 5,
  };

  let score = 0;
  for (const violation of violations) {
    score += severityWeights[violation.severity] ?? 0;
  }

  return Math.min(100, score);
}
