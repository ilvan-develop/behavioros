/**
 * Audit Chain Verifier — hash chain integrity verification for audit entries.
 *
 * Provides full-chain verification from genesis, single-entry verification,
 * incremental (last-N) verification, and detailed reporting of broken links
 * and tampered entries.
 */

import type { AuditEntry } from './audit-entry.interface';
import { HashChain } from './hash-chain';
import type { VerificationResult } from './verification-result.interface';

// ============================================================
// AuditChainVerifier
// ============================================================

export class AuditChainVerifier {
  private readonly chain: HashChain;

  constructor(chain: HashChain) {
    this.chain = chain;
  }

  /**
   * Verify the entire chain from genesis.
   *
   * Walks every entry, recomputes its hash, and checks that each entry's
   * `previousHash` matches the preceding entry's stored hash.
   *
   * @returns A {@link VerificationResult} describing the outcome.
   */
  verify(): VerificationResult {
    const entries = this.chain.getEntries();
    return this.verifyRange(entries, 0);
  }

  /**
   * Verify only the last `n` entries (incremental verification).
   *
   * This is useful for quick checks after appending new entries without
   * re-scanning the entire chain.
   *
   * @param n - Number of trailing entries to verify. Capped at chain length.
   * @returns A {@link VerificationResult} scoped to the requested window.
   */
  verifyLast(n: number): VerificationResult {
    const entries = this.chain.getEntries();
    const count = Math.min(n, entries.length);
    const start = entries.length - count;
    return this.verifyRange(entries, start);
  }

  /**
   * Verify a single entry by its 0-based index.
   *
   * @param index - Index of the entry to verify.
   * @returns `true` if the entry's hash is valid **and** its `previousHash`
   *          matches the predecessor's hash (unless it is the genesis entry).
   */
  verifyEntryAt(index: number): boolean {
    const entries = this.chain.getEntries();
    if (index < 0 || index >= entries.length) {
      return false;
    }

    const entry = entries[index];

    if (!HashChain.verifyEntry(entry)) {
      return false;
    }

    if (index === 0) {
      return entry.previousHash === '';
    }

    return entry.previousHash === entries[index - 1].hash;
  }

  /**
   * Generate a human-readable verification report string.
   */
  report(result: VerificationResult): string {
    const lines: string[] = [];
    lines.push('=== Audit Chain Verification Report ===');
    lines.push(`Valid:             ${result.valid ? 'YES' : 'NO'}`);
    lines.push(`Total entries:     ${result.totalEntries}`);
    lines.push(`Verified entries:  ${result.verifiedEntries}`);
    lines.push(`Broken links:      ${result.brokenLinks.length}`);
    lines.push(`Tampered entries:  ${result.tamperedEntries.length}`);
    lines.push(
      `Time span:         ${result.firstEntryTimestamp.toISOString()} → ${result.lastEntryTimestamp.toISOString()}`,
    );
    lines.push(`Duration:          ${result.duration}ms`);

    if (result.brokenLinks.length > 0) {
      lines.push('');
      lines.push('Broken links at indices:');
      for (const idx of result.brokenLinks) {
        lines.push(`  - [${idx}]`);
      }
    }

    if (result.tamperedEntries.length > 0) {
      lines.push('');
      lines.push('Tampered entries at indices:');
      for (const idx of result.tamperedEntries) {
        lines.push(`  - [${idx}]`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Return the list of all tampered entry indices in the entire chain.
   */
  getTamperedIndices(): number[] {
    const entries = this.chain.getEntries();
    const tampered: number[] = [];
    for (let i = 0; i < entries.length; i++) {
      if (!HashChain.verifyEntry(entries[i])) {
        tampered.push(i);
      }
    }
    return tampered;
  }

  /**
   * Return the list of all broken link indices in the entire chain.
   *
   * A broken link exists when entry[i].previousHash !== entry[i-1].hash.
   */
  getBrokenLinkIndices(): number[] {
    const entries = this.chain.getEntries();
    const broken: number[] = [];
    for (let i = 1; i < entries.length; i++) {
      if (entries[i].previousHash !== entries[i - 1].hash) {
        broken.push(i);
      }
    }
    return broken;
  }

  // ------------------------------------------------------------
  // Private helpers
  // ------------------------------------------------------------

  private verifyRange(entries: readonly AuditEntry[], start: number): VerificationResult {
    const t0 = Date.now();
    const brokenLinks: number[] = [];
    const tamperedEntries: number[] = [];
    let verifiedEntries = 0;

    for (let i = start; i < entries.length; i++) {
      const entry = entries[i];

      // Check hash integrity
      if (HashChain.verifyEntry(entry)) {
        verifiedEntries++;
      } else {
        tamperedEntries.push(i);
      }

      // Check chain link (skip genesis)
      if (i > start || (i === start && i > 0)) {
        if (entry.previousHash !== entries[i - 1].hash) {
          brokenLinks.push(i);
        }
      } else if (i === start && i === 0) {
        // Genesis: previousHash must be empty
        if (entry.previousHash !== '') {
          brokenLinks.push(i);
        }
      }
    }

    const totalEntries = entries.length - start;
    const firstEntry = entries[start];
    const lastEntry = entries[entries.length - 1];

    return {
      valid: brokenLinks.length === 0 && tamperedEntries.length === 0,
      totalEntries,
      verifiedEntries,
      brokenLinks,
      tamperedEntries,
      firstEntryTimestamp: firstEntry.timestamp,
      lastEntryTimestamp: lastEntry.timestamp,
      duration: Date.now() - t0,
    };
  }
}
