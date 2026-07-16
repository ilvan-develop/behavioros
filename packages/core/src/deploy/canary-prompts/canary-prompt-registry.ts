import { randomUUID } from 'node:crypto';
import {
  CanaryPromptCreateSchema,
  CanaryPromptDefinitionSchema,
  type CanaryPromptCategory,
  type CanaryPromptCreate,
  type CanaryPromptDefinition,
} from './canary-prompt.schema';

// ============================================================
// Canary Prompt Registry — Manage canary prompt definitions
// ============================================================

export interface RegistryValidationResult {
  valid: boolean;
  errors: string[];
}

export class CanaryPromptRegistry {
  private prompts: Map<string, CanaryPromptDefinition> = new Map();

  register(input: CanaryPromptCreate): CanaryPromptDefinition {
    const now = new Date().toISOString();
    const parsed = CanaryPromptCreateSchema.safeParse(input);
    if (!parsed.success) {
      throw new Error(`Invalid prompt: ${parsed.error.issues.map((i) => i.message).join(', ')}`);
    }

    if (this.prompts.has(parsed.data.id)) {
      throw new Error(`Prompt with id "${parsed.data.id}" already exists`);
    }

    const definition: CanaryPromptDefinition = {
      ...parsed.data,
      createdAt: now,
      updatedAt: now,
    };

    this.prompts.set(definition.id, definition);
    return definition;
  }

  unregister(id: string): boolean {
    return this.prompts.delete(id);
  }

  get(id: string): CanaryPromptDefinition | undefined {
    return this.prompts.get(id);
  }

  list(): CanaryPromptDefinition[] {
    return Array.from(this.prompts.values());
  }

  listByCategory(category: CanaryPromptCategory): CanaryPromptDefinition[] {
    return this.list().filter((p) => p.category === category);
  }

  validate(input: unknown): RegistryValidationResult {
    const result = CanaryPromptDefinitionSchema.safeParse(input);
    if (result.success) {
      return { valid: true, errors: [] };
    }
    return {
      valid: false,
      errors: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    };
  }

  export(): string {
    const prompts = this.list();
    const lines: string[] = ['# Canary Prompts', ''];

    for (const p of prompts) {
      lines.push(`- id: ${p.id}`);
      lines.push(`  name: "${p.name}"`);
      lines.push(`  description: "${p.description}"`);
      lines.push(`  category: ${p.category}`);
      lines.push(`  driftThreshold: ${p.driftThreshold}`);
      lines.push(`  version: ${p.version}`);
      if (p.tags.length > 0) {
        lines.push(`  tags: [${p.tags.map((t) => `"${t}"`).join(', ')}]`);
      }
      lines.push(`  prompt: |`);
      lines.push(`    ${p.prompt.split('\n').join('\n    ')}`);
      lines.push(`  expectedBehavior: |`);
      lines.push(`    ${p.expectedBehavior.split('\n').join('\n    ')}`);
      lines.push('');
    }

    return lines.join('\n');
  }

  import(yaml: string): CanaryPromptDefinition[] {
    const imported: CanaryPromptDefinition[] = [];
    const blocks = yaml.split(/^- id: /m).filter(Boolean);

    for (const block of blocks) {
      const parseResult = this.parseYamlBlock(block);
      if (parseResult) {
        const now = new Date().toISOString();
        const definition: CanaryPromptDefinition = {
          ...parseResult,
          createdAt: now,
          updatedAt: now,
        };
        this.prompts.set(definition.id, definition);
        imported.push(definition);
      }
    }

    return imported;
  }

  clear(): void {
    this.prompts.clear();
  }

  size(): number {
    return this.prompts.size;
  }

  private parseYamlBlock(block: string): CanaryPromptCreate | null {
    const lines = block.split('\n');
    const result: Record<string, unknown> = {};

    let currentField: string | null = null;
    let multilineContent = '';
    let inMultiline = false;

    for (const line of lines) {
      const trimmed = line.trim();

      if (inMultiline) {
        const indent = line.length - line.trimStart().length;
        if (indent >= 4 && trimmed) {
          multilineContent += (multilineContent ? '\n' : '') + trimmed;
          continue;
        } else if (currentField) {
          result[currentField] = multilineContent;
          inMultiline = false;
          multilineContent = '';
          currentField = null;
        }
      }

      const fieldMatch = trimmed.match(/^(\w+):\s*(.*)/);
      if (!fieldMatch) continue;

      const [, field, value] = fieldMatch;

      if (value === '|' || value === '>') {
        currentField = field;
        inMultiline = true;
        multilineContent = '';
        continue;
      }

      if (field === 'tags') {
        const tagsMatch = value.match(/\[(.*)\]/);
        if (tagsMatch) {
          result.tags = tagsMatch[1].split(',').map((t) => t.trim().replace(/"/g, ''));
        }
      } else if (field === 'driftThreshold' || field === 'version') {
        result[field] = field === 'driftThreshold' ? Number.parseFloat(value) : value;
      } else {
        result[field] = value.replace(/^["']|["']$/g, '');
      }
    }

    if (inMultiline && currentField) {
      result[currentField] = multilineContent;
    }

    const parsed = CanaryPromptCreateSchema.safeParse(result);
    if (!parsed.success) return null;
    return parsed.data;
  }

  private generateId(): string {
    return `canary-${randomUUID().slice(0, 8)}`;
  }
}
