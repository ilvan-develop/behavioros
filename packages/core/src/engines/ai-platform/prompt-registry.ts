/**
 * PromptTemplate — Configuration and options interface.
 */
export interface PromptTemplate {
  id: string;
  name: string;
  version: string;
  template: string;
  variables: string[];
  description: string;
  tags: string[];
  createdAt: string;
}

interface PromptEntry {
  template: PromptTemplate;
  versions: Map<string, PromptTemplate>;
}

/**
 * PromptRegistry — prompt registry.
 *
 * Methods: register, get, list, remove, createVersion.
 */
export class PromptRegistry {
  private entries = new Map<string, PromptEntry>();

  register(template: PromptTemplate): void {
    const entry: PromptEntry = {
      template,
      versions: new Map(),
    };
    entry.versions.set(template.version, { ...template });
    this.entries.set(template.id, entry);
  }

  get(id: string, version?: string): PromptTemplate | undefined {
    const entry = this.entries.get(id);
    if (!entry) return undefined;
    if (version) return entry.versions.get(version);
    return entry.template;
  }

  list(tag?: string): PromptTemplate[] {
    const all = Array.from(this.entries.values()).map((e) => e.template);
    if (!tag) return all;
    return all.filter((t) => t.tags.includes(tag));
  }

  remove(id: string): void {
    this.entries.delete(id);
  }

  createVersion(id: string, template: string, variables: string[]): string {
    const entry = this.entries.get(id);
    if (!entry) throw new Error(`Prompt template "${id}" not found`);

    const current = entry.template;
    const parts = current.version.split('.');
    const major = Number(parts[0]) || 1;
    const minor = Number(parts[1]) || 0;
    const patch = Number(parts[2]) || 0;
    const newVersion = `${major}.${minor}.${patch + 1}`;

    const newTemplate: PromptTemplate = {
      ...current,
      version: newVersion,
      template,
      variables,
      createdAt: new Date().toISOString(),
    };

    entry.versions.set(newVersion, newTemplate);
    entry.template = newTemplate;
    return newVersion;
  }
}
