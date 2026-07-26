/**
 * Secret — Configuration and options interface.
 */
export interface Secret {
  id: string;
  key: string;
  value: string;
  version: number;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

/**
 * SecretAccessLog — Configuration and options interface.
 */
export interface SecretAccessLog {
  secretId: string;
  action: 'read' | 'write' | 'delete' | 'rotate';
  timestamp: string;
}

function generateId(): string {
  return crypto.randomUUID();
}

function xorEncrypt(value: string, key: string): string {
  let result = '';
  for (let i = 0; i < value.length; i++) {
    const charCode = value.charCodeAt(i) ^ key.charCodeAt(i % key.length);
    result += String.fromCharCode(charCode);
  }
  return result;
}

function toBase64(value: string): string {
  return Buffer.from(value, 'utf-8').toString('base64');
}

function fromBase64(encoded: string): string {
  return Buffer.from(encoded, 'base64').toString('utf-8');
}

/**
 * SecretsEngine — secrets engine.
 *
 * Methods: store, retrieve, rotate, list, getAccessLogs, getMaskedValue.
 */
export class SecretsEngine {
  private secrets: Map<string, Secret> = new Map();
  private keyIndex: Map<string, string> = new Map();
  private accessLogs: SecretAccessLog[] = [];
  private masterKey: string;

  constructor(masterKey?: string) {
    this.masterKey = masterKey ?? '';
  }

  store(
    key: string,
    value: string,
    expiresAt?: string,
    metadata?: Record<string, unknown>,
  ): string {
    const encrypted = this.encrypt(value);
    const existing = this.keyIndex.get(key);

    if (existing) {
      const secret = this.secrets.get(existing)!;
      this.secrets.delete(existing);
      const id = generateId();
      const updated: Secret = {
        id,
        key,
        value: encrypted,
        version: secret.version + 1,
        expiresAt,
        createdAt: secret.createdAt,
        updatedAt: new Date().toISOString(),
        metadata,
      };
      this.secrets.set(id, updated);
      this.keyIndex.set(key, id);
      this.accessLogs.push({ secretId: id, action: 'write', timestamp: new Date().toISOString() });
      return id;
    }

    const id = generateId();
    const now = new Date().toISOString();
    const secret: Secret = {
      id,
      key,
      value: encrypted,
      version: 1,
      expiresAt,
      createdAt: now,
      updatedAt: now,
      metadata,
    };
    this.secrets.set(id, secret);
    this.keyIndex.set(key, id);
    this.accessLogs.push({ secretId: id, action: 'write', timestamp: now });
    return id;
  }

  retrieve(key: string): Secret | null {
    const id = this.keyIndex.get(key);
    if (!id) return null;

    const secret = this.secrets.get(id);
    if (!secret) return null;

    if (secret.expiresAt && new Date(secret.expiresAt) <= new Date()) {
      return null;
    }

    this.accessLogs.push({
      secretId: secret.id,
      action: 'read',
      timestamp: new Date().toISOString(),
    });

    return { ...secret, value: this.decrypt(secret.value) };
  }

  delete(key: string): boolean {
    const id = this.keyIndex.get(key);
    if (!id) return false;

    this.secrets.delete(id);
    this.keyIndex.delete(key);
    this.accessLogs.push({ secretId: id, action: 'delete', timestamp: new Date().toISOString() });
    return true;
  }

  rotate(key: string, newValue: string): Secret {
    const id = this.keyIndex.get(key);
    if (!id) {
      const newId = this.store(key, newValue);
      const secret = this.secrets.get(newId)!;
      this.accessLogs.push({
        secretId: secret.id,
        action: 'rotate',
        timestamp: new Date().toISOString(),
      });
      return { ...secret, value: newValue };
    }

    const existing = this.secrets.get(id)!;
    this.secrets.delete(id);
    const encrypted = this.encrypt(newValue);
    const newId = generateId();
    const rotated: Secret = {
      id: newId,
      key,
      value: encrypted,
      version: existing.version + 1,
      expiresAt: existing.expiresAt,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
      metadata: existing.metadata,
    };
    this.secrets.set(newId, rotated);
    this.keyIndex.set(key, newId);
    this.accessLogs.push({
      secretId: newId,
      action: 'rotate',
      timestamp: new Date().toISOString(),
    });
    return { ...rotated, value: newValue };
  }

  list(): { key: string; version: number; createdAt: string }[] {
    const result: { key: string; version: number; createdAt: string }[] = [];
    const seen = new Set<string>();

    for (const secret of this.secrets.values()) {
      if (!seen.has(secret.key)) {
        seen.add(secret.key);
        result.push({
          key: secret.key,
          version: secret.version,
          createdAt: secret.createdAt,
        });
      }
    }

    return result;
  }

  getAccessLogs(secretId?: string): SecretAccessLog[] {
    if (secretId) {
      return this.accessLogs.filter((log) => log.secretId === secretId);
    }
    return [...this.accessLogs];
  }

  getMaskedValue(key: string): string | null {
    const id = this.keyIndex.get(key);
    if (!id) return null;

    const secret = this.secrets.get(id);
    if (!secret) return null;

    const decrypted = this.decrypt(secret.value);

    if (decrypted.length === 0) return '';
    if (decrypted.length === 1) return decrypted;
    return decrypted[0] + decrypted[decrypted.length - 1];
  }

  private encrypt(value: string): string {
    if (this.masterKey) {
      return xorEncrypt(value, this.masterKey);
    }
    return toBase64(value);
  }

  private decrypt(encrypted: string): string {
    if (this.masterKey) {
      return xorEncrypt(encrypted, this.masterKey);
    }
    return fromBase64(encrypted);
  }
}
