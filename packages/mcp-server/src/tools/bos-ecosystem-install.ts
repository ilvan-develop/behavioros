import type { EcosystemRegistry } from '@behavioros/core';
import { z } from 'zod';

export const bosEcosystemInstallInput = z.object({
  type: z.enum(['skill', 'mcp', 'design-system']).describe('Type of component to install'),
  id: z.string().describe('Component ID to install'),
  source: z
    .enum(['aitmpl', 'open-design', 'local'])
    .default('aitmpl')
    .describe('Source to install from'),
  category: z
    .string()
    .optional()
    .describe('For AITMPL: category path (e.g. "utilities/playwright-skill")'),
});

export type BosEcosystemInstallInput = z.infer<typeof bosEcosystemInstallInput>;

interface ComponentInfo {
  id: string;
  name: string;
  type: string;
  source: string;
  version: string;
  status: string;
}

function formatComponent(component: unknown): ComponentInfo | undefined {
  if (!component) return undefined;
  const c = component as Record<string, unknown>;
  return {
    id: String(c.id ?? ''),
    name: String(c.name ?? c.id ?? ''),
    type: String(c.type ?? 'skill'),
    source: String(c.source ?? 'local'),
    version: String(c.version ?? '1.0.0'),
    status: String(c.status ?? 'active'),
  };
}

export async function bosEcosystemInstall(
  registry: EcosystemRegistry,
  input: BosEcosystemInstallInput,
) {
  const { type, id, source, category } = input;

  const result = await registry.install(type, id, source);

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            success: result.success,
            type,
            id,
            source,
            category: category ?? undefined,
            component: formatComponent(result.component),
            error: result.error ?? undefined,
            message: result.success
              ? `Successfully installed ${type} "${id}" from ${source}`
              : `Failed to install ${type} "${id}": ${result.error}`,
          },
          null,
          2,
        ),
      },
    ],
  };
}
