/**
 * Audit Chain Entry — immutable record in the hash chain.
 *
 * Each entry is cryptographically linked to its predecessor via `previousHash`,
 * forming a tamper-evident chain from the genesis block.
 */

export interface AuditEntry {
  /** Unique identifier for this entry (UUID v4). */
  id: string;

  /** ISO-8601 timestamp of when the entry was created. */
  timestamp: Date;

  /** Identifier of the agent that produced this entry. */
  agentId: string;

  /** Action performed (e.g. 'deploy', 'commit', 'review'). */
  action: string;

  /** Arbitrary structured details about the action. */
  details: Record<string, unknown>;

  /** SHA-256 hash of the preceding entry. Empty string for the genesis entry. */
  previousHash: string;

  /** SHA-256 hash of this entry (computed from its canonical content + previousHash). */
  hash: string;

  /** Optional metadata (e.g. branch, environment, pipeline run ID). */
  metadata: Record<string, unknown>;
}

/**
 * Minimal payload used to compute an entry's hash.
 * Excludes `hash` itself so the hash is self-referencing only through content.
 */
export interface AuditEntryPayload {
  id: string;
  timestamp: Date;
  agentId: string;
  action: string;
  details: Record<string, unknown>;
  previousHash: string;
  metadata: Record<string, unknown>;
}
