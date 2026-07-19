import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

// ============================================================
// Traffic Capture — Production traffic sampling & persistence
// ============================================================

/**
 * A single captured production traffic entry.
 */
export interface CapturedTraffic {
  /** Unique capture ID. */
  id: string;
  /** ISO-8601 timestamp of capture. */
  timestamp: string;
  /** Elapsed time of the original request in milliseconds. */
  latencyMs: number;
  /** HTTP method or RPC verb. */
  method: string;
  /** Request endpoint or topic. */
  path: string;
  /** Sanitized request payload (no secrets). */
  request: Record<string, unknown>;
  /** Original production response. */
  response: Record<string, unknown>;
  /** HTTP status code or gRPC status. */
  statusCode: number;
  /** Error message if the request failed. */
  error?: string;
  /** Agent or user identifier (hashed/anonymized). */
  agentId?: string;
  /** Sampling metadata. */
  sampling: SamplingMetadata;
  /** Arbitrary key-value pairs for traceability. */
  tags: Record<string, string>;
}

/**
 * Metadata about how this entry was sampled.
 */
export interface SamplingMetadata {
  /** Strategy used to capture this entry. */
  strategy: SamplingStrategy;
  /** Sample rate (0-1) that was active when captured. */
  sampleRate: number;
  /** Whether this entry was randomly selected. */
  selected: boolean;
  /** Bucket hash used for deterministic sampling (0-9999). */
  bucket?: number;
}

export type SamplingStrategy =
  | 'random'
  | 'deterministic'
  | 'head'
  | 'tail'
  | 'error-only'
  | 'slow-only';

export interface TrafficCaptureConfig {
  /** Sample rate between 0 and 1. Default: 0.1 (10%). */
  sampleRate: number;
  /** Sampling strategy. Default: 'random'. */
  strategy: SamplingStrategy;
  /** Maximum entries to keep in memory buffer. Default: 10000. */
  maxBufferSize: number;
  /** Persist path for captured traffic. If set, auto-flushes at buffer limit. */
  persistPath?: string;
  /** Sanitize fields to strip from requests (e.g., 'password', 'token'). Default: ['password','token','secret','authorization','cookie']. */
  sanitizeFields: string[];
  /** Minimum latency (ms) to consider "slow" for slow-only sampling. Default: 1000. */
  slowThresholdMs: number;
  /** Maximum request body size (bytes) to capture. Default: 65536. */
  maxBodyBytes: number;
}

interface PersistedState {
  entries: CapturedTraffic[];
  totalCaptured: number;
  totalDiscarded: number;
}

// --- Defaults ---

const DEFAULT_SANITIZE_FIELDS = ['password', 'token', 'secret', 'authorization', 'cookie'];

const DEFAULT_CONFIG: TrafficCaptureConfig = {
  sampleRate: 0.1,
  strategy: 'random',
  maxBufferSize: 10_000,
  sanitizeFields: DEFAULT_SANITIZE_FIELDS,
  slowThresholdMs: 1000,
  maxBodyBytes: 65_536,
};

// ============================================================
// TrafficCapture
// ============================================================

export class TrafficCapture {
  private buffer: CapturedTraffic[] = [];
  private config: TrafficCaptureConfig;
  private totalCaptured = 0;
  private totalDiscarded = 0;
  private bucketCounter = 0;

  constructor(config?: Partial<TrafficCaptureConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ── Core capture ─────────────────────────────────────────────

  /**
   * Evaluate and optionally capture a production traffic entry.
   * Returns the captured entry if sampled, or null if discarded.
   */
  capture(params: {
    method: string;
    path: string;
    request: Record<string, unknown>;
    response: Record<string, unknown>;
    statusCode: number;
    latencyMs: number;
    error?: string;
    agentId?: string;
    tags?: Record<string, string>;
  }): CapturedTraffic | null {
    const selected = this.shouldSample(params);
    if (!selected) {
      this.totalDiscarded++;
      return null;
    }

    const entry: CapturedTraffic = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      latencyMs: params.latencyMs,
      method: params.method,
      path: params.path,
      request: this.sanitize({ ...params.request }),
      response: { ...params.response },
      statusCode: params.statusCode,
      error: params.error,
      agentId: params.agentId,
      sampling: {
        strategy: this.config.strategy,
        sampleRate: this.config.sampleRate,
        selected: true,
      },
      tags: params.tags ?? {},
    };

    this.buffer.push(entry);
    this.totalCaptured++;

    if (this.buffer.length >= this.config.maxBufferSize && this.config.persistPath) {
      this.flushSync();
    }

    return entry;
  }

  // ── Query ────────────────────────────────────────────────────

  /** Get all buffered entries (copy). */
  getEntries(): CapturedTraffic[] {
    return [...this.buffer];
  }

  /** Get entries matching a path pattern. */
  getEntriesByPath(pathPattern: string | RegExp): CapturedTraffic[] {
    const regex =
      typeof pathPattern === 'string' ? new RegExp(pathPattern.replace(/\*/g, '.*')) : pathPattern;
    return this.buffer.filter((e) => regex.test(e.path));
  }

  /** Get entries with errors. */
  getErrorEntries(): CapturedTraffic[] {
    return this.buffer.filter((e) => e.statusCode >= 400 || e.error !== undefined);
  }

  /** Get entries exceeding a latency threshold. */
  getSlowEntries(thresholdMs?: number): CapturedTraffic[] {
    const threshold = thresholdMs ?? this.config.slowThresholdMs;
    return this.buffer.filter((e) => e.latencyMs > threshold);
  }

  /** Get a single entry by ID. */
  getEntryById(id: string): CapturedTraffic | undefined {
    return this.buffer.find((e) => e.id === id);
  }

  // ── Stats ────────────────────────────────────────────────────

  /** Capture statistics. */
  getStats(): {
    buffered: number;
    totalCaptured: number;
    totalDiscarded: number;
    sampleRate: number;
    strategy: SamplingStrategy;
  } {
    return {
      buffered: this.buffer.length,
      totalCaptured: this.totalCaptured,
      totalDiscarded: this.totalDiscarded,
      sampleRate: this.config.sampleRate,
      strategy: this.config.strategy,
    };
  }

  /** Get the active config (read-only). */
  getConfig(): Readonly<TrafficCaptureConfig> {
    return this.config;
  }

  // ── Persist / Load ───────────────────────────────────────────

  /** Flush buffer to disk and clear buffer. */
  async flush(path?: string): Promise<void> {
    const target = path ?? this.config.persistPath;
    if (!target) throw new Error('No persist path configured');
    if (this.buffer.length === 0) return;

    const dir = dirname(target);
    if (!existsSync(dir)) {
      const { mkdirSync } = await import('node:fs');
      mkdirSync(dir, { recursive: true });
    }

    let existing: CapturedTraffic[] = [];
    if (existsSync(target)) {
      try {
        const raw = await readFile(target, 'utf-8');
        const parsed = JSON.parse(raw) as PersistedState;
        existing = parsed.entries ?? [];
      } catch {
        existing = [];
      }
    }

    const state: PersistedState = {
      entries: [...existing, ...this.buffer],
      totalCaptured: this.totalCaptured,
      totalDiscarded: this.totalDiscarded,
    };

    await writeFile(target, JSON.stringify(state, null, 2), 'utf-8');
    this.buffer = [];
  }

  /** Load entries from a persistence file into the buffer. */
  async load(path: string): Promise<void> {
    if (!existsSync(path)) {
      throw new Error(`Persist file not found: ${path}`);
    }
    const raw = await readFile(path, 'utf-8');
    const state = JSON.parse(raw) as PersistedState;
    this.buffer = state.entries ?? [];
    this.totalCaptured = state.totalCaptured ?? this.buffer.length;
    this.totalDiscarded = state.totalDiscarded ?? 0;
  }

  /** Synchronous flush (used internally at buffer limit). */
  private flushSync(): void {
    if (!this.config.persistPath) return;
    try {
      const { writeFileSync, mkdirSync } = require('node:fs') as typeof import('node:fs');
      const dir = dirname(this.config.persistPath);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

      let existing: CapturedTraffic[] = [];
      if (existsSync(this.config.persistPath)) {
        try {
          const raw = readFileSync(this.config.persistPath, 'utf-8');
          const parsed = JSON.parse(raw) as PersistedState;
          existing = parsed.entries ?? [];
        } catch {
          existing = [];
        }
      }

      const state: PersistedState = {
        entries: [...existing, ...this.buffer],
        totalCaptured: this.totalCaptured,
        totalDiscarded: this.totalDiscarded,
      };

      writeFileSync(this.config.persistPath, JSON.stringify(state, null, 2), 'utf-8');
      this.buffer = [];
    } catch {
      // non-fatal — buffer stays in memory
    }
  }

  /** Clear the in-memory buffer. */
  clear(): void {
    this.buffer = [];
  }

  // ── Sampling logic ───────────────────────────────────────────

  private shouldSample(params: {
    statusCode: number;
    latencyMs: number;
    error?: string;
    method: string;
    path: string;
  }): boolean {
    switch (this.config.strategy) {
      case 'error-only':
        return params.statusCode >= 400 || params.error !== undefined;

      case 'slow-only':
        return params.latencyMs >= this.config.slowThresholdMs;

      case 'head':
        return this.totalCaptured < Math.ceil(this.config.sampleRate * this.config.maxBufferSize);

      case 'tail':
        return (
          this.totalCaptured + this.totalDiscarded >=
          Math.floor((1 - this.config.sampleRate) * this.config.maxBufferSize)
        );

      case 'deterministic': {
        this.bucketCounter = (this.bucketCounter + 1) % 10_000;
        return this.bucketCounter < Math.round(this.config.sampleRate * 10_000);
      }

      default:
        return Math.random() < this.config.sampleRate;
    }
  }

  // ── Sanitization ─────────────────────────────────────────────

  private sanitize(obj: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      if (this.config.sanitizeFields.some((f) => lowerKey.includes(f.toLowerCase()))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        sanitized[key] = this.sanitize(value as Record<string, unknown>);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }
}

/** Synchronous read for flushSync fallback. */
function readFileSync(path: string, encoding: BufferEncoding): string {
  const { readFileSync } = require('node:fs') as typeof import('node:fs');
  return readFileSync(path, encoding);
}
