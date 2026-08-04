import { existsSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import {
  atomicWriteFileSync,
  getOrCreateStateSecret,
  isStrictModeEnrolled,
  readState,
  writeSignedState,
} from '../agent-state-store';

const BASE_PROTOCOL = {
  dnaSelected: false,
  truthResolved: false,
  missionCreated: false,
  auditDone: false,
  learningRecorded: false,
  lastStep: null,
  lastUpdated: new Date().toISOString(),
};

describe('AgentStateStore', () => {
  let testDir: string;
  let statePath: string;
  let keyPath: string;
  const originalKeyPathEnv = process.env.BEHAVIOROS_STATE_KEY_PATH;
  const originalSecretEnv = process.env.BEHAVIOROS_STATE_SECRET;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'bos-state-store-'));
    statePath = join(testDir, '.agent_state.json');
    keyPath = join(testDir, 'state.key');
    process.env.BEHAVIOROS_STATE_KEY_PATH = keyPath;
    delete process.env.BEHAVIOROS_STATE_SECRET;
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
    if (originalKeyPathEnv === undefined) delete process.env.BEHAVIOROS_STATE_KEY_PATH;
    else process.env.BEHAVIOROS_STATE_KEY_PATH = originalKeyPathEnv;
    if (originalSecretEnv === undefined) delete process.env.BEHAVIOROS_STATE_SECRET;
    else process.env.BEHAVIOROS_STATE_SECRET = originalSecretEnv;
  });

  test('round-trips a signed state file', () => {
    writeSignedState(statePath, { ...BASE_PROTOCOL, dnaSelected: true, activeRole: 'engineer' });
    const result = readState(statePath);
    expect(result.ok).toBe(true);
    expect(result.tampered).toBe(false);
    expect(result.data?.protocol.dnaSelected).toBe(true);
    expect(result.data?.protocol.activeRole).toBe('engineer');
    expect(result.data?.security?.signature).toBeTruthy();
  });

  test('detects tampering when boolean flags are hand-edited without resigning', () => {
    writeSignedState(statePath, BASE_PROTOCOL);
    const raw = JSON.parse(readFileSync(statePath, 'utf-8'));
    raw.protocol.dnaSelected = true;
    raw.protocol.truthResolved = true;
    raw.protocol.missionCreated = true;
    writeFileSync(statePath, JSON.stringify(raw, null, 2));

    const result = readState(statePath);
    expect(result.ok).toBe(false);
    expect(result.tampered).toBe(true);
    expect(result.reason).toBe('signature-mismatch');
  });

  test('reports missing state file distinctly from tampering', () => {
    const result = readState(statePath);
    expect(result.ok).toBe(false);
    expect(result.tampered).toBe(false);
    expect(result.reason).toBe('not-found');
  });

  test('handles corrupted JSON gracefully', () => {
    writeFileSync(statePath, 'not-json-at-all{{{');
    const result = readState(statePath);
    expect(result.ok).toBe(false);
    expect(result.tampered).toBe(false);
    expect(result.reason).toBe('corrupt-json');
  });

  test('accepts a legacy unsigned file when strict mode has never been enrolled', () => {
    expect(isStrictModeEnrolled()).toBe(false);
    writeFileSync(
      statePath,
      JSON.stringify({ version: '1.0', protocol: { ...BASE_PROTOCOL, dnaSelected: true } }),
    );
    const result = readState(statePath);
    expect(result.ok).toBe(true);
    expect(result.tampered).toBe(false);
  });

  test('rejects an unsigned file once strict mode is enrolled (secret exists)', () => {
    getOrCreateStateSecret(); // enrolls strict mode by creating the key file
    expect(isStrictModeEnrolled()).toBe(true);
    writeFileSync(
      statePath,
      JSON.stringify({ version: '1.0', protocol: { ...BASE_PROTOCOL, dnaSelected: true } }),
    );
    const result = readState(statePath);
    expect(result.ok).toBe(false);
    expect(result.tampered).toBe(true);
    expect(result.reason).toBe('signature-required');
  });

  test('BEHAVIOROS_STATE_SECRET env override is honored and enrolls strict mode', () => {
    process.env.BEHAVIOROS_STATE_SECRET = 'explicit-test-secret';
    expect(isStrictModeEnrolled()).toBe(true);
    writeSignedState(statePath, BASE_PROTOCOL);
    const result = readState(statePath);
    expect(result.ok).toBe(true);
  });

  test('atomicWriteFileSync never leaves a partial file across many rapid writes', () => {
    for (let i = 0; i < 25; i++) {
      atomicWriteFileSync(statePath, JSON.stringify({ i }));
      const content = readFileSync(statePath, 'utf-8');
      expect(() => JSON.parse(content)).not.toThrow();
    }
    expect(existsSync(`${statePath}.lock`)).toBe(false);
  });

  test('cleans up the lock file after a successful write', () => {
    writeSignedState(statePath, BASE_PROTOCOL);
    expect(existsSync(`${statePath}.lock`)).toBe(false);
  });

  test('takes over a stale lock instead of hanging indefinitely', () => {
    const lockPath = `${statePath}.lock`;
    writeFileSync(lockPath, '99999999'); // simulate a crashed holder's PID
    const oldTime = new Date(Date.now() - 60_000);
    utimesSync(lockPath, oldTime, oldTime);

    const start = Date.now();
    atomicWriteFileSync(statePath, 'recovered');
    const elapsed = Date.now() - start;

    expect(readFileSync(statePath, 'utf-8')).toBe('recovered');
    expect(elapsed).toBeLessThan(2000); // should take over almost immediately, not wait out the full timeout
  });

  test('a fresh (non-stale) lock blocks a concurrent writer until it times out', () => {
    const lockPath = `${statePath}.lock`;
    writeFileSync(lockPath, String(process.pid)); // fresh lock, held by "another process"

    expect(() => atomicWriteFileSync(statePath, 'should-not-write')).toThrow(
      /Timed out waiting for lock/,
    );
    expect(existsSync(statePath)).toBe(false);
  }, 10000);
});
