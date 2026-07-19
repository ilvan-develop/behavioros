export interface AnomalyDetectorConfig {
  windowSize: number;
  zScoreThreshold: number;
  minSamples: number;
  sensitivity: 'low' | 'medium' | 'high';
}

export interface AnomalyResult {
  isAnomaly: boolean;
  zScore: number;
  mean: number;
  stdDev: number;
  value: number;
  threshold: number;
  sampleSize: number;
}

export class AnomalyDetector {
  private config: AnomalyDetectorConfig;
  private samples: number[] = [];
  private totalSum = 0;
  private totalSumSq = 0;

  constructor(config?: Partial<AnomalyDetectorConfig>) {
    this.config = {
      windowSize: config?.windowSize ?? 100,
      zScoreThreshold: config?.zScoreThreshold ?? this.getSensitivityThreshold(config?.sensitivity),
      minSamples: config?.minSamples ?? 10,
      sensitivity: config?.sensitivity ?? 'medium',
    };
  }

  private getSensitivityThreshold(sensitivity?: 'low' | 'medium' | 'high'): number {
    switch (sensitivity) {
      case 'low':
        return 3.5;
      case 'high':
        return 2.0;
      default:
        return 2.5;
    }
  }

  record(value: number): AnomalyResult {
    this.samples.push(value);
    this.totalSum += value;
    this.totalSumSq += value * value;

    if (this.samples.length > this.config.windowSize) {
      const removed = this.samples.shift()!;
      this.totalSum -= removed;
      this.totalSumSq -= removed * removed;
    }

    return this.analyze(value);
  }

  analyze(value: number): AnomalyResult {
    const n = this.samples.length;

    if (n < this.config.minSamples) {
      return {
        isAnomaly: false,
        zScore: 0,
        mean: 0,
        stdDev: 0,
        value,
        threshold: this.config.zScoreThreshold,
        sampleSize: n,
      };
    }

    const mean = this.totalSum / n;
    const variance = this.totalSumSq / n - mean * mean;
    const stdDev = Math.sqrt(Math.max(0, variance));

    if (stdDev === 0) {
      return {
        isAnomaly: false,
        zScore: 0,
        mean,
        stdDev: 0,
        value,
        threshold: this.config.zScoreThreshold,
        sampleSize: n,
      };
    }

    const zScore = Math.abs((value - mean) / stdDev);

    return {
      isAnomaly: zScore > this.config.zScoreThreshold,
      zScore,
      mean,
      stdDev,
      value,
      threshold: this.config.zScoreThreshold,
      sampleSize: n,
    };
  }

  getStats(): { mean: number; stdDev: number; sampleSize: number; min: number; max: number } {
    const n = this.samples.length;
    if (n === 0) {
      return { mean: 0, stdDev: 0, sampleSize: 0, min: 0, max: 0 };
    }

    const mean = this.totalSum / n;
    const variance = this.totalSumSq / n - mean * mean;
    const stdDev = Math.sqrt(Math.max(0, variance));

    return {
      mean,
      stdDev,
      sampleSize: n,
      min: Math.min(...this.samples),
      max: Math.max(...this.samples),
    };
  }

  reset(): void {
    this.samples = [];
    this.totalSum = 0;
    this.totalSumSq = 0;
  }

  getSamples(): number[] {
    return [...this.samples];
  }
}
