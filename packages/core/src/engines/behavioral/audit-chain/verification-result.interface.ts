/**
 * Verification Result — output of an audit chain integrity check.
 *
 * Returned by {@link AuditChainVerifier.verify} and its incremental
 * counterpart {@link AuditChainVerifier.verifyLast}.
 */

export interface VerificationResult {
  /** Whether the entire verified segment of the chain is intact. */
  valid: boolean;

  /** Total number of entries in the chain that were in scope. */
  totalEntries: number;

  /** Number of entries whose hash matched the expected value. */
  verifiedEntries: number;

  /** 0-based indices of entries whose `previousHash` does not match the predecessor's `hash`. */
  brokenLinks: number[];

  /** 0-based indices of entries whose recomputed hash differs from the stored `hash`. */
  tamperedEntries: number[];

  /** Timestamp of the first entry in the verified range. */
  firstEntryTimestamp: Date;

  /** Timestamp of the last entry in the verified range. */
  lastEntryTimestamp: Date;

  /** Wall-clock duration of the verification in milliseconds. */
  duration: number;
}
