import { randomUUID } from 'node:crypto';

/**
 * SchemaEntry — Configuration and options interface.
 */
export interface SchemaEntry {
  id: string;
  name: string;
  version: string;
  schema: Record<string, unknown>;
  createdAt: string;
}

/**
 * SchemaRegistry — schema registry.
 *
 * Methods: register, get, list, validate, remove, createVersion.
 */
export class SchemaRegistry {
  private schemas = new Map<string, SchemaEntry[]>();

  register(name: string, schema: Record<string, unknown>): string {
    const id = randomUUID();
    const entry: SchemaEntry = {
      id,
      name,
      version: '1.0.0',
      schema,
      createdAt: new Date().toISOString(),
    };
    this.addEntry(name, entry);
    return id;
  }

  get(name: string, version?: string): SchemaEntry | undefined {
    const entries = this.schemas.get(name);
    if (!entries || entries.length === 0) return undefined;
    if (!version) return entries[entries.length - 1];
    return entries.find((e) => e.version === version);
  }

  list(): SchemaEntry[] {
    const all: SchemaEntry[] = [];
    for (const entries of this.schemas.values()) {
      all.push(...entries);
    }
    return all;
  }

  validate(name: string, data: unknown): { valid: boolean; errors: string[] } {
    const entry = this.get(name);
    if (!entry) {
      return { valid: false, errors: [`Schema '${name}' not found`] };
    }
    const errors: string[] = [];
    const schema = entry.schema;
    const properties = (schema.properties as Record<string, { type: string }>) ?? {};
    const required = (schema.required as string[]) ?? [];

    if (typeof data !== 'object' || data === null) {
      return { valid: false, errors: ['Data must be an object'] };
    }

    const obj = data as Record<string, unknown>;

    for (const key of required) {
      if (!(key in obj)) {
        errors.push(`Missing required property '${key}'`);
      }
    }

    for (const [key, def] of Object.entries(properties)) {
      if (key in obj) {
        const value = obj[key];
        const expectedType = def.type;
        if (expectedType === 'string' && typeof value !== 'string') {
          errors.push(`Property '${key}' must be a ${expectedType}`);
        } else if (expectedType === 'number' && typeof value !== 'number') {
          errors.push(`Property '${key}' must be a ${expectedType}`);
        } else if (expectedType === 'boolean' && typeof value !== 'boolean') {
          errors.push(`Property '${key}' must be a ${expectedType}`);
        } else if (expectedType === 'array' && !Array.isArray(value)) {
          errors.push(`Property '${key}' must be a ${expectedType}`);
        } else if (
          expectedType === 'object' &&
          (typeof value !== 'object' || value === null || Array.isArray(value))
        ) {
          errors.push(`Property '${key}' must be a ${expectedType}`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  remove(name: string): void {
    if (!this.schemas.has(name)) {
      throw new Error(`Schema '${name}' not found`);
    }
    this.schemas.delete(name);
  }

  createVersion(name: string, schema: Record<string, unknown>): string {
    const entries = this.schemas.get(name);
    if (!entries || entries.length === 0) {
      throw new Error(`Schema '${name}' not found`);
    }
    const currentVersion = entries[entries.length - 1].version;
    const parts = currentVersion.split('.').map(Number);
    parts[parts.length - 1]++;
    const newVersion = parts.join('.');
    const id = randomUUID();
    const entry: SchemaEntry = {
      id,
      name,
      version: newVersion,
      schema,
      createdAt: new Date().toISOString(),
    };
    this.addEntry(name, entry);
    return id;
  }

  private addEntry(name: string, entry: SchemaEntry): void {
    const existing = this.schemas.get(name);
    if (existing) {
      existing.push(entry);
    } else {
      this.schemas.set(name, [entry]);
    }
  }
}
