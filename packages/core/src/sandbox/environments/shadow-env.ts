// ============================================================
// Shadow Environment — Traffic replay + diff analysis sandbox
// ============================================================

export interface ShadowConfig {
  replaySpeed: number;
  captureTraffic: boolean;
  diffAnalysis: boolean;
}

export interface TrafficCaptureEntry {
  timestamp: number;
  request: unknown;
  response: unknown;
}

export interface DiffEntry {
  timestamp: number;
  original: unknown;
  shadow: unknown;
  diff: unknown;
}

export class ShadowEnvironment {
  private trafficCapture: TrafficCaptureEntry[] = [];
  private diffResults: DiffEntry[] = [];
  private config: ShadowConfig;

  constructor(config: ShadowConfig) {
    this.config = config;
  }

  captureTraffic(request: unknown, response: unknown): void {
    if (this.config.captureTraffic) {
      this.trafficCapture.push({
        timestamp: Date.now(),
        request,
        response,
      });
    }
  }

  replayTraffic(request: unknown): { status: string; request: unknown } {
    return { status: 'replayed', request };
  }

  analyzeDiff(original: unknown, shadow: unknown): unknown | null {
    if (!this.config.diffAnalysis) return null;

    const diff = this.computeDiff(original, shadow);
    this.diffResults.push({
      timestamp: Date.now(),
      original,
      shadow,
      diff,
    });

    return diff;
  }

  private computeDiff(original: unknown, shadow: unknown): unknown {
    if (typeof original !== 'object' || typeof shadow !== 'object') {
      return { original, shadow };
    }

    const diff: Record<string, unknown> = {};
    const orig = original as Record<string, unknown>;
    const shad = shadow as Record<string, unknown>;

    for (const key of Object.keys(orig)) {
      if (JSON.stringify(orig[key]) !== JSON.stringify(shad[key])) {
        diff[key] = { original: orig[key], shadow: shad[key] };
      }
    }

    return diff;
  }

  getTrafficCapture(): TrafficCaptureEntry[] {
    return [...this.trafficCapture];
  }

  getDiffResults(): DiffEntry[] {
    return [...this.diffResults];
  }

  getConfig(): ShadowConfig {
    return { ...this.config };
  }

  clear(): void {
    this.trafficCapture = [];
    this.diffResults = [];
  }
}
