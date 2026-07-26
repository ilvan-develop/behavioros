import { randomUUID } from 'node:crypto';

/**
 * OntologyClass — Configuration and options interface.
 */
export interface OntologyClass {
  id: string;
  name: string;
  parentId?: string;
  properties: OntologyProperty[];
  constraints: OntologyConstraint[];
}

/**
 * OntologyProperty — Configuration and options interface.
 */
export interface OntologyProperty {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'reference';
  required: boolean;
  defaultValue?: unknown;
  description?: string;
}

/**
 * OntologyConstraint — Configuration and options interface.
 */
export interface OntologyConstraint {
  type: 'unique' | 'range' | 'enum' | 'regex';
  value: unknown;
  description: string;
}

/**
 * OntologyRelationship — Configuration and options interface.
 */
export interface OntologyRelationship {
  id: string;
  name: string;
  sourceClassId: string;
  targetClassId: string;
  type: 'has-a' | 'references' | 'belongs-to';
  cardinality: 'one' | 'many' | 'optional';
}

type PrimitiveType = 'string' | 'number' | 'boolean' | 'date' | 'reference';

/**
 * OntologyManager — ontology manager.
 *
 * Methods: defineClass, getClass, getClassHierarchy, removeClass, listClasses, defineRelationship, and 7 more.
 */
export class OntologyManager {
  private classes: Map<string, OntologyClass> = new Map();
  private relationships: Map<string, OntologyRelationship> = new Map();
  private childrenCache: Map<string, string[]> = new Map();

  private buildChildrenCache(): void {
    this.childrenCache.clear();
    for (const cls of this.classes.values()) {
      if (cls.parentId) {
        const siblings = this.childrenCache.get(cls.parentId) ?? [];
        siblings.push(cls.id);
        this.childrenCache.set(cls.parentId, siblings);
      }
    }
  }

  defineClass(cls: OntologyClass): void {
    if (!cls.id) {
      cls = { ...cls, id: randomUUID() };
    }

    if (cls.parentId) {
      if (cls.parentId === cls.id) {
        throw new Error(`Circular reference: class "${cls.id}" cannot be its own parent`);
      }
      if (this._hasCircularParent(cls.id, cls.parentId)) {
        throw new Error(
          `Circular reference detected for class "${cls.id}" with parent "${cls.parentId}"`,
        );
      }
    }

    this.classes.set(cls.id, cls);
    this.buildChildrenCache();
  }

  getClass(id: string): OntologyClass | undefined {
    return this.classes.get(id);
  }

  getClassHierarchy(classId: string): string[] {
    const hierarchy: string[] = [];
    let current: OntologyClass | undefined = this.classes.get(classId);
    while (current) {
      hierarchy.unshift(current.id);
      current = current.parentId ? this.classes.get(current.parentId) : undefined;
    }
    return hierarchy;
  }

  removeClass(id: string): void {
    this.classes.delete(id);

    for (const [relId, rel] of this.relationships) {
      if (rel.sourceClassId === id || rel.targetClassId === id) {
        this.relationships.delete(relId);
      }
    }

    for (const cls of this.classes.values()) {
      if (cls.parentId === id) {
        cls.parentId = undefined;
      }
    }

    this.buildChildrenCache();
  }

  listClasses(): OntologyClass[] {
    return Array.from(this.classes.values());
  }

  defineRelationship(rel: OntologyRelationship): void {
    if (!rel.id) {
      rel = { ...rel, id: randomUUID() };
    }

    if (!this.classes.has(rel.sourceClassId)) {
      throw new Error(`Source class "${rel.sourceClassId}" does not exist`);
    }
    if (!this.classes.has(rel.targetClassId)) {
      throw new Error(`Target class "${rel.targetClassId}" does not exist`);
    }

    this.relationships.set(rel.id, rel);
  }

  getRelationship(id: string): OntologyRelationship | undefined {
    return this.relationships.get(id);
  }

  getRelationships(classId: string): OntologyRelationship[] {
    return Array.from(this.relationships.values()).filter(
      (r) => r.sourceClassId === classId || r.targetClassId === classId,
    );
  }

  removeRelationship(id: string): void {
    this.relationships.delete(id);
  }

  listRelationships(): OntologyRelationship[] {
    return Array.from(this.relationships.values());
  }

  validateEntity(
    classId: string,
    properties: Record<string, unknown>,
  ): { valid: boolean; errors: string[] } {
    const cls = this.classes.get(classId);
    if (!cls) {
      return { valid: false, errors: [`Class "${classId}" not found`] };
    }

    const errors: string[] = [];

    for (const prop of cls.properties) {
      const value = properties[prop.name];

      if (value === undefined || value === null) {
        if (prop.required) {
          errors.push(`Missing required property "${prop.name}"`);
        }
        continue;
      }

      const typeError = this.validateType(prop.type, value, prop.name);
      if (typeError) {
        errors.push(typeError);
      }
    }

    for (const constraint of cls.constraints) {
      const constraintErrors = this.validateConstraint(constraint, properties);
      errors.push(...constraintErrors);
    }

    return { valid: errors.length === 0, errors };
  }

  findSubclasses(classId: string): OntologyClass[] {
    return Array.from(this.classes.values()).filter((c) => c.parentId === classId);
  }

  isSubclassOf(classId: string, potentialParentId: string): boolean {
    let current = this.classes.get(classId);
    while (current?.parentId) {
      if (current.parentId === potentialParentId) return true;
      current = this.classes.get(current.parentId);
    }
    return false;
  }

  private validateType(type: PrimitiveType, value: unknown, propName: string): string | null {
    switch (type) {
      case 'string':
        if (typeof value !== 'string') {
          return `Property "${propName}" expected string, got ${typeof value}`;
        }
        break;
      case 'number':
        if (typeof value !== 'number' || Number.isNaN(value as number)) {
          return `Property "${propName}" expected number, got ${typeof value}`;
        }
        break;
      case 'boolean':
        if (typeof value !== 'boolean') {
          return `Property "${propName}" expected boolean, got ${typeof value}`;
        }
        break;
      case 'date':
        if (typeof value !== 'string' || Number.isNaN(Date.parse(value as string))) {
          return `Property "${propName}" expected valid date string, got ${typeof value}`;
        }
        break;
      case 'reference':
        if (typeof value !== 'string') {
          return `Property "${propName}" expected reference (string), got ${typeof value}`;
        }
        break;
    }
    return null;
  }

  private validateConstraint(
    constraint: OntologyConstraint,
    properties: Record<string, unknown>,
  ): string[] {
    const errors: string[] = [];

    switch (constraint.type) {
      case 'enum': {
        if (!Array.isArray(constraint.value)) {
          return [`Enum constraint value must be an array`];
        }
        const allowed = constraint.value as unknown[];
        for (const [key, value] of Object.entries(properties)) {
          if (value !== undefined && !allowed.includes(value)) {
            errors.push(
              `Property "${key}" value "${String(value)}" is not in allowed enum: [${allowed.join(', ')}]`,
            );
          }
        }
        break;
      }
      case 'range': {
        if (!Array.isArray(constraint.value) || constraint.value.length !== 2) {
          return [`Range constraint value must be [min, max]`];
        }
        const [min, max] = constraint.value as [number, number];
        for (const [key, value] of Object.entries(properties)) {
          if (typeof value === 'number') {
            if (value < min || value > max) {
              errors.push(`Property "${key}" value ${value} is out of range [${min}, ${max}]`);
            }
          }
        }
        break;
      }
      case 'regex': {
        if (typeof constraint.value !== 'string') {
          return [`Regex constraint value must be a string pattern`];
        }
        const regex = new RegExp(constraint.value as string);
        for (const [key, value] of Object.entries(properties)) {
          if (typeof value === 'string' && !regex.test(value)) {
            errors.push(
              `Property "${key}" value "${value}" does not match regex /${constraint.value}/`,
            );
          }
        }
        break;
      }
    }

    return errors;
  }

  private _hasCircularParent(classId: string, parentId: string): boolean {
    const visited = new Set<string>();
    let current: OntologyClass | undefined = this.classes.get(parentId);
    while (current) {
      if (current.id === classId) return true;
      if (visited.has(current.id)) return true;
      visited.add(current.id);
      current = current.parentId ? this.classes.get(current.parentId) : undefined;
    }
    return false;
  }
}
