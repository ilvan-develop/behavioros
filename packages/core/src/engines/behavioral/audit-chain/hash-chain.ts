/**
 * Hash Chain — SHA-256 based immutable chain for audit entries.
 *
 * Every entry's hash is derived from its canonical content concatenated with the
 * previous entry's hash, forming a tamper-evident linked list.
 */

import { createHash, createHmac, randomUUID } from 'node:crypto';
import type { AuditEntry, AuditEntryPayload } from './audit-entry.interface';

// ============================================================
// HashChain
// ============================================================

export class HashChain {
  private readonly entries: AuditEntry[] = [];
  private readonly signingKey: string | undefined;

  constructor(signingKey?: string) {
    this.signingKey = signingKey;
  }

  /** Return a shallow copy of the chain. */
  getEntries(): readonly AuditEntry[] {
    return this.entries;
  }

  /** Number of entries in the chain. */
  get length(): number {
    return this.entries.length;
  }

  /** Return the last entry, or `undefined` if the chain is empty. */
  getLastEntry(): AuditEntry | undefined {
    return this.entries[this.entries.length - 1];
  }

  /**
   * Create the genesis (first) block of a new chain.
   *
   * @param agentId  - Agent that creates the genesis entry.
   * @param action   - Initial action label.
   * @param details  - Arbitrary payload.
   * @param metadata - Optional metadata.
   * @returns The genesis {@link AuditEntry}.
   */
  createGenesis(
    agentId: string,
    action: string,
    details: Record<string, unknown> = {},
    metadata: Record<string, unknown> = {},
  ): AuditEntry {
    if (this.entries.length > 0) {
      throw new Error('Cannot create genesis block: chain already has entries');
    }

    const entry = this.buildEntry({
      id: randomUUID(),
      timestamp: new Date(),
      agentId,
      action,
      details,
      previousHash: '',
      metadata,
    });

    this.entries.push(entry);
    return entry;
  }

  /**
   * Append a new entry to the chain.
   *
   * @param agentId  - Agent performing the action.
   * @param action   - Action label.
   * @param details  - Arbitrary payload.
   * @param metadata - Optional metadata.
   * @returns The newly created {@link AuditEntry}.
   * @throws If the chain is empty (call {@link createGenesis} first).
   */
  append(
    agentId: string,
    action: string,
    details: Record<string, unknown> = {},
    metadata: Record<string, unknown> = {},
  ): AuditEntry {
    if (this.entries.length === 0) {
      throw new Error('Chain is empty — call createGenesis() before appending');
    }

    const prev = this.entries[this.entries.length - 1];

    const entry = this.buildEntry({
      id: randomUUID(),
      timestamp: new Date(),
      agentId,
      action,
      details,
      previousHash: prev.hash,
      metadata,
    });

    this.entries.push(entry);
    return entry;
  }

  /**
   * Recompute the expected hash for an entry payload.
   *
   * The canonical form is a deterministic JSON string of the payload fields
   * (sorted keys) followed by the `previousHash`.
   */
  static computeHash(payload: AuditEntryPayload): string {
    const canonical = HashChain.canonicalise(payload);
    return createHash('sha256').update(canonical).digest('hex');
  }

  /**
   * Verify a single entry's hash matches the expected value.
   * If a signing key is configured, also verifies the HMAC signature.
   *
   * @returns `true` if the recomputed hash equals `entry.hash` (and signature is valid if present).
   */
  static verifyEntry(entry: AuditEntry, signingKey?: string): boolean {
    const { hash, ...rest } = entry;
    const expected = HashChain.computeHash(rest as AuditEntryPayload);
    if (hash !== expected) return false;

    // If entry has a signature and a signing key is provided, verify HMAC
    if (entry.signature && signingKey) {
      const hmac = createHmac('sha256', signingKey).update(expected).digest('hex');
      if (hmac !== entry.signature) return false;
    }

    return true;
  }

  /**
   * Load entries from a serialised array (e.g. from disk / database).
   * Replaces any existing entries.
   */
  loadFrom(entries: AuditEntry[]): void {
    this.entries.length = 0;
    this.entries.push(...entries);
  }

  // ------------------------------------------------------------
  // Private helpers
  // ------------------------------------------------------------

  private buildEntry(payload: AuditEntryPayload): AuditEntry {
    const hash = HashChain.computeHash(payload);
    const entry: AuditEntry = { ...payload, hash };

    // HMAC-SHA256 signature when signing key is provided
    if (this.signingKey) {
      const hmac = createHmac('sha256', this.signingKey).update(hash).digest('hex');
      entry.signature = hmac;
    }

    return entry;
  }

  /**
   * Deterministic serialisation — keys sorted alphabetically, Dates ISO-8601,
   * no whitespace.
   */
  private static canonicalise(payload: AuditEntryPayload): string {
    const obj: Record<string, unknown> = {
      id: payload.id,
      timestamp:
        payload.timestamp instanceof Date
          ? payload.timestamp.toISOString()
          : String(payload.timestamp),
      agentId: payload.agentId,
      action: payload.action,
      details: payload.details,
      previousHash: payload.previousHash,
      metadata: payload.metadata,
    };

    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      sorted[key] = obj[key];
    }

    return JSON.stringify(sorted);
  }
}
