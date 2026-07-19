import { createHash } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

// ============================================================
// SQLite Audit Store — Persistent audit trail with hash chain
// ============================================================

export interface AuditEntry {
  id: string;
  timestamp: string;
  previousHash: string;
  hash: string;
  agentId?: string;
  missionId?: string;
  action: string;
  payload?: string;
  metadata?: string;
}

export interface ChainVerificationResult {
  valid: boolean;
  totalEntries: number;
  verifiedEntries: number;
  brokenAt?: number;
  tamperedAt?: number[];
}

export interface SQLiteAuditStoreConfig {
  dbPath: string;
  maxEntries?: number;
  enableHMAC?: boolean;
  hmacKey?: string;
}

/**
 * Persistent audit store using SQLite with WAL mode.
 *
 * Note: This implementation uses a simple JSON file fallback
 * since better-sqlite3 may not be available. For production,
 * install better-sqlite3 and use native SQLite.
 */
export class SQLiteAuditStore {
  private entries: AuditEntry[] = [];
  private maxEntries: number;
  private dbPath: string;
  private enableHMAC: boolean;
  private hmacKey?: string;

  constructor(config: SQLiteAuditStoreConfig) {
    this.dbPath = config.dbPath;
    this.maxEntries = config.maxEntries ?? 100000;
    this.enableHMAC = config.enableHMAC ?? false;
    this.hmacKey = config.hmacKey;

    // Ensure directory exists
    const dir = dirname(config.dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Load existing entries if file exists
    this.load();
  }

  /**
   * Append a new entry to the audit trail
   */
  append(entry: Omit<AuditEntry, 'previousHash' | 'hash'>): AuditEntry {
    const previousHash =
      this.entries.length > 0 ? this.entries[this.entries.length - 1].hash : '0'.repeat(64);

    const hash = this.computeHash({
      ...entry,
      previousHash,
    });

    const fullEntry: AuditEntry = {
      ...entry,
      previousHash,
      hash,
    };

    this.entries.push(fullEntry);

    // Trim if exceeding max entries
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }

    // Persist
    this.save();

    return fullEntry;
  }

  /**
   * Verify the integrity of the hash chain
   */
  verifyChain(): ChainVerificationResult {
    if (this.entries.length === 0) {
      return { valid: true, totalEntries: 0, verifiedEntries: 0 };
    }

    let brokenAt: number | undefined;
    const tamperedAt: number[] = [];

    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[i];

      // Verify previous hash link
      if (i > 0) {
        const expectedPrevious = this.entries[i - 1].hash;
        if (entry.previousHash !== expectedPrevious) {
          brokenAt = i;
          break;
        }
      }

      // Verify entry hash
      const expectedHash = this.computeHash({
        id: entry.id,
        timestamp: entry.timestamp,
        previousHash: entry.previousHash,
        agentId: entry.agentId,
        missionId: entry.missionId,
        action: entry.action,
        payload: entry.payload,
        metadata: entry.metadata,
      });

      if (entry.hash !== expectedHash) {
        tamperedAt.push(i);
      }
    }

    return {
      valid: brokenAt === undefined && tamperedAt.length === 0,
      totalEntries: this.entries.length,
      verifiedEntries: this.entries.length - tamperedAt.length,
      brokenAt,
      tamperedAt: tamperedAt.length > 0 ? tamperedAt : undefined,
    };
  }

  /**
   * Get all entries (for export or inspection)
   */
  getEntries(): ReadonlyArray<AuditEntry> {
    return [...this.entries];
  }

  /**
   * Get entries by agent ID
   */
  getByAgent(agentId: string): AuditEntry[] {
    return this.entries.filter((e) => e.agentId === agentId);
  }

  /**
   * Get entries by mission ID
   */
  getByMission(missionId: string): AuditEntry[] {
    return this.entries.filter((e) => e.missionId === missionId);
  }

  /**
   * Get entry count
   */
  count(): number {
    return this.entries.length;
  }

  private computeHash(data: Omit<AuditEntry, 'hash'>): string {
    const canonical = JSON.stringify(data, Object.keys(data).sort());
    let hash = createHash('sha256').update(canonical).digest('hex');

    if (this.enableHMAC && this.hmacKey) {
      const { createHmac } = require('node:crypto');
      hash = createHmac('sha256', this.hmacKey).update(canonical).digest('hex');
    }

    return hash;
  }

  private save(): void {
    try {
      const { writeFileSync } = require('node:fs');
      writeFileSync(this.dbPath, JSON.stringify(this.entries, null, 2));
    } catch {
      // Silently fail on save (non-critical for operation)
    }
  }

  private load(): void {
    try {
      const { readFileSync } = require('node:fs');
      if (existsSync(this.dbPath)) {
        const data = readFileSync(this.dbPath, 'utf-8');
        this.entries = JSON.parse(data);
      }
    } catch {
      // Start with empty entries on load failure
      this.entries = [];
    }
  }
}
