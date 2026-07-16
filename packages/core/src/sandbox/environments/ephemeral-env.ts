// ============================================================
// Ephemeral Environment — Memory-only, auto-volatile sandbox
// ============================================================

export interface EphemeralConfig {
  memoryOnly: boolean;
  maxMemoryMB: number;
  timeout: number;
}

const DEFAULT_CONFIG: EphemeralConfig = {
  memoryOnly: true,
  maxMemoryMB: 128,
  timeout: 5000,
};

export class EphemeralEnvironment {
  private data: Map<string, unknown> = new Map();
  private config: EphemeralConfig;

  constructor(config?: Partial<EphemeralConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  set(key: string, value: unknown): void {
    if (this.data.size >= this.config.maxMemoryMB * 1024 * 1024) {
      throw new Error('Memory limit exceeded');
    }
    this.data.set(key, value);
  }

  get<T = unknown>(key: string): T | undefined {
    return this.data.get(key) as T | undefined;
  }

  has(key: string): boolean {
    return this.data.has(key);
  }

  delete(key: string): boolean {
    return this.data.delete(key);
  }

  clear(): void {
    this.data.clear();
  }

  getSize(): number {
    return this.data.size;
  }

  getConfig(): EphemeralConfig {
    return { ...this.config };
  }
}
