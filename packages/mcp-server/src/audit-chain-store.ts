import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AuditChainEntry } from '@behavioros/core';
import { HashChain, atomicWriteFileSync, getOrCreateStateSecret } from '@behavioros/core';

/**
 * Loads (or creates) a persisted, HMAC-signed hash chain of bos_run_audit results.
 *
 * Reuses the same secret as the signed .agent_state.json (see agent-state-store.ts) —
 * both are local trust anchors for this project, and splitting them into two separately
 * managed secrets wouldn't add real security, just more places to lose a key.
 */
export function loadOrCreateAuditChain(persistDir: string): { chain: HashChain; filePath: string } {
  const filePath = join(persistDir, 'audit-chain.json');
  const secret = getOrCreateStateSecret();
  const chain = new HashChain(secret);

  if (existsSync(filePath)) {
    try {
      const raw = JSON.parse(readFileSync(filePath, 'utf-8')) as AuditChainEntry[];
      // JSON round-trips Date -> ISO string; restore real Date objects so downstream
      // consumers (e.g. AuditChainVerifier.report()'s .toISOString() calls) work correctly.
      const entries = raw.map((e) => ({ ...e, timestamp: new Date(e.timestamp) }));
      chain.loadFrom(entries);
    } catch {
      // Corrupt or unreadable persisted chain — start fresh rather than crash server startup.
      // (The old file is left in place for forensic inspection, not overwritten here.)
    }
  }

  if (chain.length === 0) {
    chain.createGenesis(
      'behavioros-mcp-server',
      'chain:genesis',
      {},
      { note: 'Audit chain initialized', createdAt: new Date().toISOString() },
    );
    persistAuditChain(chain, filePath);
  }

  return { chain, filePath };
}

export function persistAuditChain(chain: HashChain, filePath: string): void {
  atomicWriteFileSync(filePath, JSON.stringify(chain.getEntries(), null, 2));
}
