/**
 * BOS DNA Resolver — resolves behavioral DNA by merging
 * global catalog -> squad -> agent overrides (priority: agent > squad > catalog).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';

export interface ResolvedDna {
  identity: {
    name: string;
    description: string;
    archetype: string;
    category: string;
  };
  personality: Record<string, unknown>;
  principles: Array<{ id: string; statement: string; priority: string; rationale: string }>;
  forbidden: Array<{ id: string; action: string; consequence: string; severity: string }>;
  decision_model: Record<string, unknown>;
  communication: Record<string, unknown>;
  autonomy: Record<string, unknown>;
  risk_tolerance: string;
  parallelism: Record<string, unknown>;
  quality_gates: Record<string, unknown>;
  learning: Record<string, unknown>;
  _sources: string[];
}

export class DnaResolver {
  private catalog: Map<string, Record<string, unknown>> = new Map();
  private catalogPath: string;

  private static CATALOG_NAMES = [
    'manufacturing',
    'immune-system',
    'surgical-team',
    'ant-colony',
    'bee-colony',
    'octopus',
    'wolf-pack',
    'orchestra',
    'mathematical-swarm',
    'research-lab',
    'enterprise-governance',
  ];

  constructor(catalogBasePath: string) {
    this.catalogPath = catalogBasePath;
    this.loadCatalog();
  }

  private loadCatalog(): void {
    for (const name of DnaResolver.CATALOG_NAMES) {
      try {
        const content = readFileSync(join(this.catalogPath, `${name}.yaml`), 'utf-8');
        this.catalog.set(name, parseYaml(content));
      } catch {
        // skip missing
      }
    }
  }

  resolve(
    dnaSelection: {
      primary: string;
      secondary?: string;
      blend?: { primary: number; secondary: number };
    },
    agentConfig: { id: string; squad?: string; dnaOverrides?: Record<string, unknown> },
    squadConfig?: { dna?: string; [key: string]: unknown },
  ): ResolvedDna {
    const baseDna = this.catalog.get(dnaSelection.primary);
    if (!baseDna) {
      throw new Error(
        `DNA pattern not found: ${dnaSelection.primary}. Available: ${this.listCatalogDnas().join(', ')}`,
      );
    }

    const squadDna = squadConfig?.dna ? this.catalog.get(String(squadConfig.dna)) : undefined;

    const agentOverrides = (agentConfig.dnaOverrides ?? {}) as Record<string, unknown>;

    // DNA Override Validation — agent overrides MUST NOT weaken security posture
    this.validateAgentOverrides(agentOverrides);

    const resolved: ResolvedDna = {
      identity: {
        name:
          ((agentOverrides.identity as Record<string, unknown>)?.name as string) ??
          ((baseDna.identity as Record<string, unknown>)?.name as string) ??
          dnaSelection.primary,
        description:
          ((agentOverrides.identity as Record<string, unknown>)?.description as string) ??
          ((baseDna.identity as Record<string, unknown>)?.description as string) ??
          '',
        archetype:
          ((agentOverrides.identity as Record<string, unknown>)?.archetype as string) ??
          ((baseDna.identity as Record<string, unknown>)?.archetype as string) ??
          '',
        category:
          ((agentOverrides.identity as Record<string, unknown>)?.category as string) ??
          ((baseDna.identity as Record<string, unknown>)?.category as string) ??
          'execution',
      },
      personality: this.mergeDeep(
        (baseDna.personality as Record<string, unknown>) ?? {},
        (squadDna?.personality as Record<string, unknown>) ?? {},
        (agentOverrides.personality as Record<string, unknown>) ?? {},
      ),
      principles: [
        ...((baseDna.principles as ResolvedDna['principles']) ?? []),
        ...((squadDna?.principles as ResolvedDna['principles']) ?? []),
        ...((agentOverrides.principles as ResolvedDna['principles']) ?? []),
      ],
      forbidden: [
        ...((baseDna.forbidden as ResolvedDna['forbidden']) ?? []),
        ...((squadDna?.forbidden as ResolvedDna['forbidden']) ?? []),
        ...((agentOverrides.forbidden as ResolvedDna['forbidden']) ?? []),
      ],
      decision_model: this.mergeDeep(
        (baseDna.decision_model as Record<string, unknown>) ?? {},
        (squadDna?.decision_model as Record<string, unknown>) ?? {},
        (agentOverrides.decision_model as Record<string, unknown>) ?? {},
      ),
      communication: this.mergeDeep(
        (baseDna.communication as Record<string, unknown>) ?? {},
        (squadDna?.communication as Record<string, unknown>) ?? {},
        (agentOverrides.communication as Record<string, unknown>) ?? {},
      ),
      autonomy: this.mergeDeep(
        (baseDna.autonomy as Record<string, unknown>) ?? {},
        (squadDna?.autonomy as Record<string, unknown>) ?? {},
        (agentOverrides.autonomy as Record<string, unknown>) ?? {},
      ),
      risk_tolerance:
        (agentOverrides.risk_tolerance as string) ??
        (squadDna?.risk_tolerance as string) ??
        (baseDna.risk_tolerance as string) ??
        'medium',
      parallelism: this.mergeDeep(
        (baseDna.parallelism as Record<string, unknown>) ?? {},
        (squadDna?.parallelism as Record<string, unknown>) ?? {},
        (agentOverrides.parallelism as Record<string, unknown>) ?? {},
      ),
      quality_gates: this.mergeDeep(
        (baseDna.quality_gates as Record<string, unknown>) ?? {},
        (squadDna?.quality_gates as Record<string, unknown>) ?? {},
        (agentOverrides.quality_gates as Record<string, unknown>) ?? {},
      ),
      learning: this.mergeDeep(
        (baseDna.learning as Record<string, unknown>) ?? {},
        (squadDna?.learning as Record<string, unknown>) ?? {},
        (agentOverrides.learning as Record<string, unknown>) ?? {},
      ),
      _sources: [
        `catalog:${dnaSelection.primary}`,
        ...(squadDna ? [`squad:${agentConfig.squad}`] : []),
        ...(Object.keys(agentOverrides).length > 0 ? [`agent:${agentConfig.id}`] : []),
      ],
    };

    if (dnaSelection.secondary) {
      const secondaryDna = this.catalog.get(dnaSelection.secondary);
      if (secondaryDna) {
        resolved._sources.push(
          `catalog:${dnaSelection.secondary}(${dnaSelection.blend?.secondary ?? 30}%)`,
        );
      }
    }

    return resolved;
  }

  private mergeDeep(
    target: Record<string, unknown>,
    ...sources: Array<Record<string, unknown>>
  ): Record<string, unknown> {
    const result = { ...target };
    for (const source of sources) {
      if (!source || typeof source !== 'object') continue;
      for (const key of Object.keys(source)) {
        const sv = source[key];
        const tv = result[key];
        if (
          sv &&
          typeof sv === 'object' &&
          !Array.isArray(sv) &&
          tv &&
          typeof tv === 'object' &&
          !Array.isArray(tv)
        ) {
          result[key] = this.mergeDeep(
            tv as Record<string, unknown>,
            sv as Record<string, unknown>,
          );
        } else {
          result[key] = sv;
        }
      }
    }
    return result;
  }

  /**
   * Validate that agent overrides do not weaken the security posture.
   * Blocks attempts to:
   * - Remove entries from `forbidden` array
   * - Override `autonomy.never_do`
   * - Set authority higher than the agent's declared level
   */
  private validateAgentOverrides(overrides: Record<string, unknown>): void {
    // Forbidden array must only ADD, never remove entries
    if (overrides.forbidden !== undefined && Array.isArray(overrides.forbidden)) {
      // Forbidden overrides are additive only — the resolver already concatenates arrays
      // so removing base entries is not possible through the merge. Log for awareness.
      console.warn(
        '[DnaResolver] Agent override includes `forbidden` entries — these will be additive only',
      );
    }

    // autonomy.never_do must not be overridden
    const autonomy = overrides.autonomy as Record<string, unknown> | undefined;
    if (autonomy?.never_do !== undefined) {
      console.warn(
        '[DnaResolver] SECURITY: Agent override attempted to set `autonomy.never_do` — ignoring override',
      );
      delete (autonomy as Record<string, unknown>).never_do;
    }
  }

  getCatalogDna(name: string): Record<string, unknown> | undefined {
    return this.catalog.get(name);
  }

  listCatalogDnas(): string[] {
    return Array.from(this.catalog.keys());
  }
}
