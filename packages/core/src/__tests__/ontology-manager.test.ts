import { beforeEach, describe, expect, it } from 'vitest';
import type { OntologyClass, OntologyRelationship } from '../engines/knowledge/ontology-manager';
import { OntologyManager } from '../engines/knowledge/ontology-manager';

describe('OntologyManager', () => {
  let manager: OntologyManager;

  beforeEach(() => {
    manager = new OntologyManager();
  });

  describe('defineClass / getClass', () => {
    it('should define a class and retrieve it by id', () => {
      const cls: OntologyClass = {
        id: 'person',
        name: 'Person',
        properties: [
          { name: 'name', type: 'string', required: true },
          { name: 'age', type: 'number', required: false },
        ],
        constraints: [],
      };
      manager.defineClass(cls);
      const retrieved = manager.getClass('person');
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('Person');
      expect(retrieved?.properties).toHaveLength(2);
    });

    it('should return undefined for non-existent class', () => {
      expect(manager.getClass('nonexistent')).toBeUndefined();
    });
  });

  describe('listClasses', () => {
    it('should return all defined classes', () => {
      manager.defineClass({
        id: 'c1',
        name: 'Class1',
        properties: [],
        constraints: [],
      });
      manager.defineClass({
        id: 'c2',
        name: 'Class2',
        properties: [],
        constraints: [],
      });
      expect(manager.listClasses()).toHaveLength(2);
    });

    it('should return empty array when no classes defined', () => {
      expect(manager.listClasses()).toEqual([]);
    });
  });

  describe('class hierarchy', () => {
    it('should build and return class hierarchy from root to class', () => {
      manager.defineClass({
        id: 'animal',
        name: 'Animal',
        properties: [],
        constraints: [],
      });
      manager.defineClass({
        id: 'mammal',
        name: 'Mammal',
        parentId: 'animal',
        properties: [],
        constraints: [],
      });
      manager.defineClass({
        id: 'dog',
        name: 'Dog',
        parentId: 'mammal',
        properties: [],
        constraints: [],
      });

      const hierarchy = manager.getClassHierarchy('dog');
      expect(hierarchy).toEqual(['animal', 'mammal', 'dog']);
    });

    it('should return single-element array for root class', () => {
      manager.defineClass({
        id: 'root',
        name: 'Root',
        properties: [],
        constraints: [],
      });
      expect(manager.getClassHierarchy('root')).toEqual(['root']);
    });
  });

  describe('findSubclasses', () => {
    it('should return direct subclasses of a class', () => {
      manager.defineClass({
        id: 'parent',
        name: 'Parent',
        properties: [],
        constraints: [],
      });
      manager.defineClass({
        id: 'child1',
        name: 'Child1',
        parentId: 'parent',
        properties: [],
        constraints: [],
      });
      manager.defineClass({
        id: 'child2',
        name: 'Child2',
        parentId: 'parent',
        properties: [],
        constraints: [],
      });
      manager.defineClass({
        id: 'grandchild',
        name: 'Grandchild',
        parentId: 'child1',
        properties: [],
        constraints: [],
      });

      const subclasses = manager.findSubclasses('parent');
      expect(subclasses).toHaveLength(2);
      expect(subclasses.map((c) => c.id).sort()).toEqual(['child1', 'child2']);
    });

    it('should return empty array if no subclasses', () => {
      manager.defineClass({
        id: 'leaf',
        name: 'Leaf',
        properties: [],
        constraints: [],
      });
      expect(manager.findSubclasses('leaf')).toEqual([]);
    });
  });

  describe('isSubclassOf', () => {
    it('should return true for direct parent-child relationship', () => {
      manager.defineClass({
        id: 'base',
        name: 'Base',
        properties: [],
        constraints: [],
      });
      manager.defineClass({
        id: 'derived',
        name: 'Derived',
        parentId: 'base',
        properties: [],
        constraints: [],
      });
      expect(manager.isSubclassOf('derived', 'base')).toBe(true);
    });

    it('should return true for deep hierarchy', () => {
      manager.defineClass({
        id: 'a',
        name: 'A',
        properties: [],
        constraints: [],
      });
      manager.defineClass({
        id: 'b',
        name: 'B',
        parentId: 'a',
        properties: [],
        constraints: [],
      });
      manager.defineClass({
        id: 'c',
        name: 'C',
        parentId: 'b',
        properties: [],
        constraints: [],
      });
      expect(manager.isSubclassOf('c', 'a')).toBe(true);
    });

    it('should return false when no relationship exists', () => {
      manager.defineClass({
        id: 'x',
        name: 'X',
        properties: [],
        constraints: [],
      });
      manager.defineClass({
        id: 'y',
        name: 'Y',
        properties: [],
        constraints: [],
      });
      expect(manager.isSubclassOf('x', 'y')).toBe(false);
    });
  });

  describe('removeClass', () => {
    it('should remove a class and detach its children', () => {
      manager.defineClass({
        id: 'parent',
        name: 'Parent',
        properties: [],
        constraints: [],
      });
      manager.defineClass({
        id: 'child',
        name: 'Child',
        parentId: 'parent',
        properties: [],
        constraints: [],
      });

      manager.removeClass('parent');
      expect(manager.getClass('parent')).toBeUndefined();
      expect(manager.getClass('child')?.parentId).toBeUndefined();
    });

    it('should remove relationships referencing the removed class', () => {
      manager.defineClass({
        id: 'a',
        name: 'A',
        properties: [],
        constraints: [],
      });
      manager.defineClass({
        id: 'b',
        name: 'B',
        properties: [],
        constraints: [],
      });
      const rel: OntologyRelationship = {
        id: 'r1',
        name: 'a-to-b',
        sourceClassId: 'a',
        targetClassId: 'b',
        type: 'references',
        cardinality: 'many',
      };
      manager.defineRelationship(rel);
      manager.removeClass('a');
      expect(manager.getRelationship('r1')).toBeUndefined();
    });
  });

  describe('relationships', () => {
    beforeEach(() => {
      manager.defineClass({
        id: 'user',
        name: 'User',
        properties: [],
        constraints: [],
      });
      manager.defineClass({
        id: 'order',
        name: 'Order',
        properties: [],
        constraints: [],
      });
    });

    it('should define and retrieve a relationship', () => {
      const rel: OntologyRelationship = {
        id: 'user-orders',
        name: 'UserOrders',
        sourceClassId: 'user',
        targetClassId: 'order',
        type: 'has-a',
        cardinality: 'many',
      };
      manager.defineRelationship(rel);
      expect(manager.getRelationship('user-orders')?.name).toBe('UserOrders');
    });

    it('should get all relationships for a class', () => {
      manager.defineRelationship({
        id: 'r1',
        name: 'R1',
        sourceClassId: 'user',
        targetClassId: 'order',
        type: 'has-a',
        cardinality: 'many',
      });
      manager.defineRelationship({
        id: 'r2',
        name: 'R2',
        sourceClassId: 'order',
        targetClassId: 'user',
        type: 'belongs-to',
        cardinality: 'one',
      });

      const rels = manager.getRelationships('user');
      expect(rels).toHaveLength(2);
    });

    it('should remove a relationship', () => {
      manager.defineRelationship({
        id: 'to-remove',
        name: 'ToRemove',
        sourceClassId: 'user',
        targetClassId: 'order',
        type: 'references',
        cardinality: 'optional',
      });
      manager.removeRelationship('to-remove');
      expect(manager.getRelationship('to-remove')).toBeUndefined();
    });

    it('should list all relationships', () => {
      manager.defineRelationship({
        id: 'r1',
        name: 'R1',
        sourceClassId: 'user',
        targetClassId: 'order',
        type: 'has-a',
        cardinality: 'one',
      });
      manager.defineRelationship({
        id: 'r2',
        name: 'R2',
        sourceClassId: 'order',
        targetClassId: 'user',
        type: 'references',
        cardinality: 'many',
      });
      expect(manager.listRelationships()).toHaveLength(2);
    });
  });

  describe('validateEntity', () => {
    it('should pass validation for valid entity', () => {
      manager.defineClass({
        id: 'employee',
        name: 'Employee',
        properties: [
          { name: 'name', type: 'string', required: true },
          { name: 'age', type: 'number', required: true },
          { name: 'active', type: 'boolean', required: false },
        ],
        constraints: [],
      });
      const result = manager.validateEntity('employee', {
        name: 'John',
        age: 30,
        active: true,
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should fail for missing required property', () => {
      manager.defineClass({
        id: 'employee',
        name: 'Employee',
        properties: [
          { name: 'name', type: 'string', required: true },
          { name: 'age', type: 'number', required: true },
        ],
        constraints: [],
      });
      const result = manager.validateEntity('employee', { age: 25 });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required property "name"');
    });

    it('should fail for wrong type', () => {
      manager.defineClass({
        id: 'employee',
        name: 'Employee',
        properties: [
          { name: 'name', type: 'string', required: true },
          { name: 'age', type: 'number', required: true },
        ],
        constraints: [],
      });
      const result = manager.validateEntity('employee', {
        name: 'Alice',
        age: 'twenty',
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('expected number');
    });

    it('should fail for enum constraint violation', () => {
      manager.defineClass({
        id: 'status-entity',
        name: 'StatusEntity',
        properties: [{ name: 'status', type: 'string', required: true }],
        constraints: [
          { type: 'enum', value: ['active', 'inactive'], description: 'Valid statuses' },
        ],
      });
      const result = manager.validateEntity('status-entity', { status: 'banned' });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('banned');
    });

    it('should fail for range constraint violation', () => {
      manager.defineClass({
        id: 'age-class',
        name: 'AgeClass',
        properties: [{ name: 'age', type: 'number', required: true }],
        constraints: [{ type: 'range', value: [0, 120], description: 'Age range' }],
      });
      const result = manager.validateEntity('age-class', { age: 200 });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('out of range');
    });

    it('should fail for regex constraint violation', () => {
      manager.defineClass({
        id: 'name-class',
        name: 'NameClass',
        properties: [{ name: 'name', type: 'string', required: true }],
        constraints: [
          { type: 'regex', value: '^[A-Z]', description: 'Name must start with uppercase' },
        ],
      });
      const result = manager.validateEntity('name-class', { name: 'alice' });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('does not match regex');
    });

    it('should return error for non-existent class', () => {
      const result = manager.validateEntity('ghost', {});
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('not found');
    });
  });

  describe('circular reference detection', () => {
    it('should throw when a class references itself as parent', () => {
      expect(() =>
        manager.defineClass({
          id: 'self',
          name: 'Self',
          parentId: 'self',
          properties: [],
          constraints: [],
        }),
      ).toThrow('cannot be its own parent');
    });

    it('should throw on circular parent chain', () => {
      manager.defineClass({
        id: 'a',
        name: 'A',
        properties: [],
        constraints: [],
      });
      manager.defineClass({
        id: 'b',
        name: 'B',
        parentId: 'a',
        properties: [],
        constraints: [],
      });
      expect(() =>
        manager.defineClass({
          id: 'a',
          name: 'A',
          parentId: 'b',
          properties: [],
          constraints: [],
        }),
      ).toThrow('Circular reference detected');
    });
  });

  describe('getRelationships by class', () => {
    it('should return relationships where class is source or target', () => {
      manager.defineClass({
        id: 'a',
        name: 'A',
        properties: [],
        constraints: [],
      });
      manager.defineClass({
        id: 'b',
        name: 'B',
        properties: [],
        constraints: [],
      });
      manager.defineClass({
        id: 'c',
        name: 'C',
        properties: [],
        constraints: [],
      });

      manager.defineRelationship({
        id: 'a-to-b',
        name: 'AToB',
        sourceClassId: 'a',
        targetClassId: 'b',
        type: 'references',
        cardinality: 'one',
      });
      manager.defineRelationship({
        id: 'c-to-a',
        name: 'CToA',
        sourceClassId: 'c',
        targetClassId: 'a',
        type: 'belongs-to',
        cardinality: 'many',
      });

      const rels = manager.getRelationships('a');
      expect(rels).toHaveLength(2);
      expect(rels.map((r) => r.id).sort()).toEqual(['a-to-b', 'c-to-a']);
    });

    it('should return empty array when class has no relationships', () => {
      manager.defineClass({
        id: 'lonely',
        name: 'Lonely',
        properties: [],
        constraints: [],
      });
      expect(manager.getRelationships('lonely')).toEqual([]);
    });
  });
});
