import { randomUUID } from 'node:crypto';

// ============================================================
// Traffic Replay — Capture and replay request/response pairs
// ============================================================

export interface TrafficCapture {
  id: string;
  timestamp: number;
  request: unknown;
  response: unknown;
  metadata: Record<string, unknown>;
}

export class TrafficReplay {
  private captures: TrafficCapture[] = [];

  capture(
    request: unknown,
    response: unknown,
    metadata: Record<string, unknown> = {},
  ): TrafficCapture {
    const capture: TrafficCapture = {
      id: `capture-${Date.now()}-${randomUUID().slice(0, 9)}`,
      timestamp: Date.now(),
      request,
      response,
      metadata,
    };

    this.captures.push(capture);
    return capture;
  }

  replay(captureId: string): { status: string; capture: TrafficCapture } {
    const capture = this.captures.find((c) => c.id === captureId);
    if (!capture) {
      throw new Error(`Capture ${captureId} not found`);
    }

    return { status: 'replayed', capture };
  }

  getCaptures(): TrafficCapture[] {
    return [...this.captures];
  }

  getCapturesByTimeRange(start: number, end: number): TrafficCapture[] {
    return this.captures.filter((c) => c.timestamp >= start && c.timestamp <= end);
  }

  clear(): void {
    this.captures = [];
  }

  get count(): number {
    return this.captures.length;
  }
}
