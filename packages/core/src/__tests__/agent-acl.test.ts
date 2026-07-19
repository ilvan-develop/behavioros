import { beforeEach, describe, expect, it } from 'vitest';
import { AgentACL } from '../domain/anti-corruption/agent-acl';
import { DataACL } from '../domain/anti-corruption/data-acl';
import { EventACL } from '../domain/anti-corruption/event-acl';

// ============================================================
// Anti-Corruption Layer Tests
// ============================================================

describe('AgentACL', () => {
  let acl: AgentACL;

  beforeEach(() => {
    acl = new AgentACL();
  });

  describe('properties', () => {
    it('should have correct id and name', () => {
      expect(acl.id).toBe('agent-acl');
      expect(acl.name).toBe('Agent Anti-Corruption Layer');
    });
  });

  describe('validateInput', () => {
    it('should pass for valid input', () => {
      const result = acl.validateInput({
        agentId: 'agent-1',
        action: 'deploy',
        payload: { target: 'production' },
      });
      expect(result.passed).toBe(true);
    });

    it('should fail when agentId is missing', () => {
      const result = acl.validateInput({
        agentId: '',
        action: 'deploy',
        payload: {},
      });
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('Missing required fields');
    });

    it('should fail when action is missing', () => {
      const result = acl.validateInput({
        agentId: 'agent-1',
        action: '',
        payload: {},
      });
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('Missing required fields');
    });

    it('should fail when both agentId and action are missing', () => {
      const result = acl.validateInput({
        agentId: '',
        action: '',
        payload: {},
      });
      expect(result.passed).toBe(false);
    });

    it('should detect DROP malicious pattern', () => {
      const result = acl.validateInput({
        agentId: 'agent-1',
        action: 'query',
        payload: { sql: 'DROP TABLE users' },
      });
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('Malicious patterns detected');
      expect(result.reason).toContain('DROP');
    });

    it('should detect DELETE malicious pattern', () => {
      const result = acl.validateInput({
        agentId: 'agent-1',
        action: 'query',
        payload: { sql: 'DELETE FROM users' },
      });
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('DELETE');
    });

    it('should detect TRUNCATE malicious pattern', () => {
      const result = acl.validateInput({
        agentId: 'agent-1',
        action: 'query',
        payload: { sql: 'TRUNCATE TABLE logs' },
      });
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('TRUNCATE');
    });

    it('should detect EXEC malicious pattern', () => {
      const result = acl.validateInput({
        agentId: 'agent-1',
        action: 'query',
        payload: { sql: 'EXEC sp_malicious' },
      });
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('EXEC');
    });

    it('should detect UNION malicious pattern', () => {
      const result = acl.validateInput({
        agentId: 'agent-1',
        action: 'query',
        payload: { sql: '1 UNION SELECT * FROM secrets' },
      });
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('UNION');
    });

    it('should detect multiple malicious patterns', () => {
      const result = acl.validateInput({
        agentId: 'agent-1',
        action: 'query',
        payload: { sql: 'DROP TABLE users; UNION SELECT * FROM secrets' },
      });
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('DROP');
      expect(result.reason).toContain('UNION');
    });

    it('should be case-insensitive for malicious pattern detection', () => {
      const result = acl.validateInput({
        agentId: 'agent-1',
        action: 'query',
        payload: { sql: 'drop table users' },
      });
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('DROP');
    });

    it('should pass for safe payload content', () => {
      const result = acl.validateInput({
        agentId: 'agent-1',
        action: 'query',
        payload: { name: 'test', value: 42 },
      });
      expect(result.passed).toBe(true);
    });
  });

  describe('transformInput', () => {
    it('should sanitize angle brackets from string payloads', () => {
      const result = acl.transformInput({
        payload: '<script>alert("xss")</script>',
      });
      expect(result.payload).toBe('scriptalert("xss")/script');
    });

    it('should pass through non-string payloads', () => {
      const result = acl.transformInput({
        payload: { key: 'value' },
      });
      expect(result.payload).toEqual({ key: 'value' });
    });

    it('should remove < and > from strings', () => {
      const result = acl.transformInput({ payload: 'a < b > c' });
      expect(result.payload).toBe('a  b  c');
    });
  });

  describe('validateOutput', () => {
    it('should pass for clean output', () => {
      const result = acl.validateOutput({ data: 'result', count: 5 });
      expect(result.passed).toBe(true);
    });

    it('should fail for output containing "password"', () => {
      const result = acl.validateOutput({ password: 'secret123' });
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('Sensitive fields detected');
      expect(result.reason).toContain('password');
    });

    it('should fail for output containing "secret"', () => {
      const result = acl.validateOutput({ secret: 'api-key-123' });
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('secret');
    });

    it('should fail for output containing "token"', () => {
      const result = acl.validateOutput({ token: 'jwt-token-123' });
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('token');
    });

    it('should fail for output containing "key"', () => {
      const result = acl.validateOutput({ key: 'private-key' });
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('key');
    });
  });

  describe('transformOutput', () => {
    it('should remove sensitive fields from output', () => {
      const result = acl.transformOutput({
        data: 'safe',
        password: 'secret',
        token: 'jwt-123',
        key: 'private',
        count: 5,
      });
      expect(result).toEqual({ data: 'safe', count: 5 });
      expect(result.password).toBeUndefined();
      expect(result.token).toBeUndefined();
      expect(result.key).toBeUndefined();
    });

    it('should keep non-sensitive fields', () => {
      const result = acl.transformOutput({
        name: 'test',
        value: 42,
        nested: { deep: true },
      });
      expect(result).toEqual({ name: 'test', value: 42, nested: { deep: true } });
    });
  });
});

describe('DataACL', () => {
  let acl: DataACL;

  beforeEach(() => {
    acl = new DataACL();
  });

  describe('properties', () => {
    it('should have correct id and name', () => {
      expect(acl.id).toBe('data-acl');
      expect(acl.name).toBe('Data Anti-Corruption Layer');
    });
  });

  describe('validateInput', () => {
    it('should pass when data field is present', () => {
      const result = acl.validateInput({ data: { records: [] } });
      expect(result.passed).toBe(true);
    });

    it('should fail when data field is missing', () => {
      const result = acl.validateInput({ records: [] });
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('Missing required field: data');
    });

    it('should fail for empty input', () => {
      const result = acl.validateInput({});
      expect(result.passed).toBe(false);
    });
  });

  describe('validateOutput', () => {
    it('should pass for non-empty output', () => {
      const result = acl.validateOutput({ data: 'result' });
      expect(result.passed).toBe(true);
    });

    it('should fail for null output', () => {
      const result = acl.validateOutput(null as unknown as Record<string, unknown>);
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('Output is empty');
    });
  });

  describe('transformInput / transformOutput', () => {
    it('should pass through input unchanged', () => {
      const input = { data: [1, 2, 3] };
      const result = acl.transformInput(input);
      expect(result).toEqual(input);
    });

    it('should pass through output unchanged', () => {
      const output = { data: 'result' };
      const result = acl.transformOutput(output);
      expect(result).toEqual(output);
    });
  });
});

describe('EventACL', () => {
  let acl: EventACL;

  beforeEach(() => {
    acl = new EventACL();
  });

  describe('properties', () => {
    it('should have correct id and name', () => {
      expect(acl.id).toBe('event-acl');
      expect(acl.name).toBe('Event Anti-Corruption Layer');
    });
  });

  describe('validateInput', () => {
    it('should pass for allowed event type "action"', () => {
      const result = acl.validateInput({ eventType: 'action', payload: {} });
      expect(result.passed).toBe(true);
    });

    it('should pass for allowed event type "query"', () => {
      const result = acl.validateInput({ eventType: 'query', payload: {} });
      expect(result.passed).toBe(true);
    });

    it('should pass for allowed event type "command"', () => {
      const result = acl.validateInput({ eventType: 'command', payload: {} });
      expect(result.passed).toBe(true);
    });

    it('should pass for allowed event type "event"', () => {
      const result = acl.validateInput({ eventType: 'event', payload: {} });
      expect(result.passed).toBe(true);
    });

    it('should fail for invalid event type', () => {
      const result = acl.validateInput({ eventType: 'malicious', payload: {} });
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('Invalid event type');
      expect(result.reason).toContain('malicious');
      expect(result.reason).toContain('action, query, command, event');
    });

    it('should fail for empty event type', () => {
      const result = acl.validateInput({ eventType: '', payload: {} });
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('Invalid event type');
    });
  });

  describe('transformInput', () => {
    it('should add timestamp to input', () => {
      const before = Date.now();
      const result = acl.transformInput({ eventType: 'action', payload: {} });
      expect(result.timestamp).toBeDefined();
      expect(result.timestamp).toBeGreaterThanOrEqual(before);
      expect(result.timestamp).toBeLessThanOrEqual(Date.now());
    });

    it('should preserve existing fields', () => {
      const result = acl.transformInput({ eventType: 'action', payload: { key: 'value' } });
      expect(result.eventType).toBe('action');
      expect(result.payload).toEqual({ key: 'value' });
    });
  });

  describe('validateOutput', () => {
    it('should pass for non-empty output', () => {
      const result = acl.validateOutput({ result: 'ok' });
      expect(result.passed).toBe(true);
    });

    it('should fail for null output', () => {
      const result = acl.validateOutput(null as unknown as Record<string, unknown>);
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('Event output is empty');
    });
  });

  describe('transformOutput', () => {
    it('should pass through output unchanged', () => {
      const output = { result: 'ok', data: [1, 2, 3] };
      const result = acl.transformOutput(output);
      expect(result).toEqual(output);
    });
  });
});
