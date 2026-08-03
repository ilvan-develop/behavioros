import { createHmac, randomBytes } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

/**
 * AgentStateStore — the signed, tamper-evident persistence layer for `.agent_state.json`.
 *
 * This is the trust anchor for BehaviorOS's PreToolUse enforcement hook
 * (scripts/validate-protocol.js) and the MCP server's EnforcementMiddleware.
 * Both read/write the same file and must agree on the signing scheme below.
 *
 * Design constraint: a locally-running coding agent with full filesystem access can
 * always read the secret key file the same way it reads any other file, so this does
 * NOT make the protocol state cryptographically unforgeable against a fully-privileged
 * co-resident agent. What it DOES provide:
 *   - Tamper *detection*: hand-editing the boolean flags without recomputing the HMAC
 *     (the naive bypass — e.g. `Edit .agent_state.json`) is caught and blocked loudly,
 *     instead of being silently trusted as it was before.
 *   - A single source of truth for the file contract (no more divergent duplicated
 *     save/load implementations across protocol-engine.ts and enforcement-middleware.ts).
 */

export interface SignedProtocolFields {
  dnaSelected: boolean;
  truthResolved: boolean;
  missionCreated: boolean;
  auditDone: boolean;
  learningRecorded: boolean;
  lastStep: number | null;
  lastUpdated: string;
  /** Active persona role, if selected (e.g. 'orchestrator'). Used by the PreToolUse hook. */
  activeRole?: string;
}

export interface SecurityBlock {
  sessionId: string;
  issuedAt: string;
  signature: string;
}

export interface SignedStateFile {
  version: string;
  protocol: SignedProtocolFields;
  security?: SecurityBlock;
}

export type StateReadReason =
  | 'not-found'
  | 'read-error'
  | 'corrupt-json'
  | 'missing-protocol'
  | 'signature-mismatch'
  | 'signature-required'
  | 'ok';

export interface StateReadResult {
  ok: boolean;
  tampered: boolean;
  data?: SignedStateFile;
  reason: StateReadReason;
}

// ─── Secret Management ──────────────────────────────────────────────

export function getStateSecretPath(): string {
  return process.env.BEHAVIOROS_STATE_KEY_PATH ?? join(homedir(), '.behavioros', 'state.key');
}

/**
 * Strict mode is enrolled the first time a secret is created (or supplied via env).
 * Before that, no key file exists anywhere and unsigned state is accepted (legacy/back-compat
 * for local tooling, tests, and hand-authored templates that never signed anything).
 */
export function isStrictModeEnrolled(): boolean {
  if (process.env.BEHAVIOROS_STATE_SECRET) return true;
  return existsSync(getStateSecretPath());
}

export function getOrCreateStateSecret(): string {
  const envSecret = process.env.BEHAVIOROS_STATE_SECRET;
  if (envSecret) return envSecret;

  const keyPath = getStateSecretPath();
  if (existsSync(keyPath)) {
    return readFileSync(keyPath, 'utf-8').trim();
  }

  const secret = randomBytes(32).toString('hex');
  mkdirSync(dirname(keyPath), { recursive: true });
  writeFileSync(keyPath, secret, 'utf-8');
  try {
    chmodSync(keyPath, 0o600);
  } catch {
    // chmod is best-effort (e.g. unsupported on some Windows filesystems)
  }
  return secret;
}

// ─── Signing ────────────────────────────────────────────────────────

function canonicalPayload(protocol: SignedProtocolFields, sessionId: string, issuedAt: string): string {
  return [
    protocol.dnaSelected,
    protocol.truthResolved,
    protocol.missionCreated,
    protocol.auditDone,
    protocol.learningRecorded,
    protocol.activeRole ?? '',
    sessionId,
    issuedAt,
  ].join('|');
}

export function signProtocolState(
  protocol: SignedProtocolFields,
  secret: string,
  sessionId: string,
  issuedAt: string,
): string {
  return createHmac('sha256', secret).update(canonicalPayload(protocol, sessionId, issuedAt)).digest('hex');
}

// ─── Atomic Write + Lock ────────────────────────────────────────────

function acquireLock(lockPath: string, timeoutMs = 3000, staleMs = 10000): void {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      writeFileSync(lockPath, String(process.pid), { flag: 'wx' });
      return;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
      // Stale-lock takeover: if the lock file is older than staleMs, assume its holder crashed.
      try {
        const stat = statSync(lockPath);
        if (Date.now() - stat.mtimeMs > staleMs) {
          try {
            unlinkSync(lockPath);
            continue;
          } catch {
            // race with another process cleaning up — just retry
          }
        }
      } catch {
        // lock disappeared between our check and stat — retry
      }
      if (Date.now() > deadline) {
        throw new Error(`Timed out waiting for lock: ${lockPath}`);
      }
      // Back off briefly instead of busy-spinning the CPU while waiting for the
      // other writer to release the lock (or to be declared stale above).
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
    }
  }
}

function releaseLock(lockPath: string): void {
  try {
    unlinkSync(lockPath);
  } catch {
    // already gone — fine
  }
}

/** Write content to `path` atomically (temp file + rename) under an exclusive lock. */
export function atomicWriteFileSync(path: string, content: string): void {
  const lockPath = `${path}.lock`;
  acquireLock(lockPath);
  try {
    const tmpPath = `${path}.tmp.${process.pid}.${randomBytes(4).toString('hex')}`;
    writeFileSync(tmpPath, content, 'utf-8');
    renameSync(tmpPath, path);
  } finally {
    releaseLock(lockPath);
  }
}

// ─── Public Read/Write API ──────────────────────────────────────────

export function writeSignedState(
  filePath: string,
  protocol: SignedProtocolFields,
  opts?: { sessionId?: string },
): void {
  const secret = getOrCreateStateSecret();
  const sessionId = opts?.sessionId ?? process.env.BEHAVIOROS_SESSION_ID ?? randomBytes(8).toString('hex');
  const issuedAt = new Date().toISOString();
  const signature = signProtocolState(protocol, secret, sessionId, issuedAt);

  const data: SignedStateFile = {
    version: '1.0',
    protocol,
    security: { sessionId, issuedAt, signature },
  };

  atomicWriteFileSync(filePath, JSON.stringify(data, null, 2));
}

export function readState(filePath: string): StateReadResult {
  if (!existsSync(filePath)) {
    return { ok: false, tampered: false, reason: 'not-found' };
  }

  let raw: string;
  try {
    raw = readFileSync(filePath, 'utf-8');
  } catch {
    return { ok: false, tampered: false, reason: 'read-error' };
  }

  let data: SignedStateFile;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, tampered: false, reason: 'corrupt-json' };
  }

  if (!data.protocol) {
    return { ok: false, tampered: false, reason: 'missing-protocol' };
  }

  if (data.security?.signature) {
    const secret = getOrCreateStateSecret();
    const expected = signProtocolState(
      data.protocol,
      secret,
      data.security.sessionId,
      data.security.issuedAt,
    );
    if (expected !== data.security.signature) {
      return { ok: false, tampered: true, data, reason: 'signature-mismatch' };
    }
    return { ok: true, tampered: false, data, reason: 'ok' };
  }

  // No signature present on disk.
  if (isStrictModeEnrolled()) {
    return { ok: false, tampered: true, data, reason: 'signature-required' };
  }
  return { ok: true, tampered: false, data, reason: 'ok' };
}
