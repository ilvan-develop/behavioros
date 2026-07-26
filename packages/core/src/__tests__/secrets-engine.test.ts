import { describe, expect, it } from 'vitest';
import { SecretsEngine } from '../engines/security/secrets-engine';

describe('SecretsEngine', () => {
  describe('store and retrieve', () => {
    it('stores and retrieves a secret', () => {
      const engine = new SecretsEngine();
      const id = engine.store('api-key', 'sk-1234567890abcdef');
      const secret = engine.retrieve('api-key');

      expect(secret).not.toBeNull();
      expect(secret!.id).toBe(id);
      expect(secret!.key).toBe('api-key');
      expect(secret!.value).toBe('sk-1234567890abcdef');
      expect(secret!.version).toBe(1);
    });

    it('returns null for non-existent key', () => {
      const engine = new SecretsEngine();
      expect(engine.retrieve('nonexistent')).toBeNull();
    });
  });

  describe('versioning', () => {
    it('increments version on overwrite with same key', () => {
      const engine = new SecretsEngine();
      engine.store('db-url', 'postgres://localhost:5432/db');
      engine.store('db-url', 'postgres://prod:5432/prod');

      const secret = engine.retrieve('db-url');
      expect(secret).not.toBeNull();
      expect(secret!.version).toBe(2);
      expect(secret!.value).toBe('postgres://prod:5432/prod');
    });

    it('returns latest value after multiple overwrites', () => {
      const engine = new SecretsEngine();
      engine.store('token', 'v1');
      engine.store('token', 'v2');
      engine.store('token', 'v3');

      const secret = engine.retrieve('token');
      expect(secret!.version).toBe(3);
      expect(secret!.value).toBe('v3');
    });
  });

  describe('expiry', () => {
    it('returns null for expired secret', () => {
      const engine = new SecretsEngine();
      engine.store('temp', 'temporary-value', '2020-01-01T00:00:00.000Z');

      expect(engine.retrieve('temp')).toBeNull();
    });

    it('returns secret that has not expired', () => {
      const engine = new SecretsEngine();
      const future = new Date(Date.now() + 86_400_000).toISOString();
      engine.store('persistent', 'value', future);

      expect(engine.retrieve('persistent')).not.toBeNull();
    });

    it('returns null when expiresAt is exactly now', () => {
      const engine = new SecretsEngine();
      const now = new Date().toISOString();
      engine.store('exact', 'value', now);

      expect(engine.retrieve('exact')).toBeNull();
    });
  });

  describe('rotate', () => {
    it('rotates secret value and increments version', () => {
      const engine = new SecretsEngine();
      engine.store('jwt-secret', 'old-secret');
      const rotated = engine.rotate('jwt-secret', 'new-secret');

      expect(rotated.version).toBe(2);
      expect(rotated.value).toBe('new-secret');

      const stored = engine.retrieve('jwt-secret');
      expect(stored!.version).toBe(2);
      expect(stored!.value).toBe('new-secret');
    });

    it('creates new secret on rotate if key does not exist', () => {
      const engine = new SecretsEngine();
      const rotated = engine.rotate('new-key', 'brand-new');

      expect(rotated.version).toBe(1);
      expect(rotated.value).toBe('brand-new');

      const stored = engine.retrieve('new-key');
      expect(stored).not.toBeNull();
    });
  });

  describe('delete', () => {
    it('deletes existing secret and returns true', () => {
      const engine = new SecretsEngine();
      engine.store('to-delete', 'value');
      expect(engine.delete('to-delete')).toBe(true);
      expect(engine.retrieve('to-delete')).toBeNull();
    });

    it('returns false for non-existent key', () => {
      const engine = new SecretsEngine();
      expect(engine.delete('ghost')).toBe(false);
    });
  });

  describe('list', () => {
    it('lists all unique keys with version info', () => {
      const engine = new SecretsEngine();
      engine.store('a', 'val-a');
      engine.store('b', 'val-b');
      engine.store('a', 'val-a-v2');

      const entries = engine.list();
      expect(entries).toHaveLength(2);
      const aEntry = entries.find((e) => e.key === 'a');
      expect(aEntry?.version).toBe(2);
    });
  });

  describe('getMaskedValue', () => {
    it('returns first and last character only', () => {
      const engine = new SecretsEngine();
      engine.store('password', 'abcdef');
      expect(engine.getMaskedValue('password')).toBe('af');
    });

    it('returns null for non-existent key', () => {
      const engine = new SecretsEngine();
      expect(engine.getMaskedValue('missing')).toBeNull();
    });

    it('returns full value for single character', () => {
      const engine = new SecretsEngine();
      engine.store('single', 'x');
      expect(engine.getMaskedValue('single')).toBe('x');
    });
  });

  describe('access logs', () => {
    it('tracks all access actions', () => {
      const engine = new SecretsEngine();
      const _id = engine.store('logged', 'value');
      engine.retrieve('logged');
      engine.rotate('logged', 'new-val');
      engine.delete('logged');

      const logs = engine.getAccessLogs();
      expect(logs).toHaveLength(4);
      expect(logs[0].action).toBe('write');
      expect(logs[1].action).toBe('read');
      expect(logs[2].action).toBe('rotate');
      expect(logs[3].action).toBe('delete');
    });

    it('filters logs by secretId', () => {
      const engine = new SecretsEngine();
      const idA = engine.store('alpha', 'value');
      engine.store('beta', 'other');
      engine.retrieve('alpha');

      const alphaLogs = engine.getAccessLogs(idA);
      expect(alphaLogs).toHaveLength(2);
      expect(alphaLogs.every((l) => l.secretId === idA)).toBe(true);
    });
  });

  describe('encryption', () => {
    it('makes stored value unreadable without key', () => {
      const engine = new SecretsEngine('my-master-key-123');
      const id = engine.store('secret', 'sensitive-data');

      // Access the internal encrypted value
      const raw = (engine as unknown as { secrets: Map<string, { value: string }> }).secrets.get(
        id,
      );
      expect(raw!.value).not.toContain('sensitive-data');
    });

    it('retrieves correct value with matching key', () => {
      const engine = new SecretsEngine('my-master-key-123');
      engine.store('secret', 'sensitive-data');

      const secret = engine.retrieve('secret');
      expect(secret!.value).toBe('sensitive-data');
    });

    it('stores as base64 when no master key provided', () => {
      const engine = new SecretsEngine();
      const id = engine.store('plain', 'hello');
      const raw = (engine as unknown as { secrets: Map<string, { value: string }> }).secrets.get(
        id,
      );
      expect(raw!.value).toBe(Buffer.from('hello', 'utf-8').toString('base64'));
    });
  });

  describe('metadata', () => {
    it('stores and retrieves metadata', () => {
      const engine = new SecretsEngine();
      engine.store('with-meta', 'value', undefined, { environment: 'production', owner: 'team-a' });

      const secret = engine.retrieve('with-meta');
      expect(secret!.metadata).toEqual({ environment: 'production', owner: 'team-a' });
    });
  });
});
