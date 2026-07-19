import type {
  CanaryPromptBatchResult,
  CanaryPromptDefinition,
  CanaryPromptResult,
  DriftDetection,
} from './canary-prompt.schema';
import { CanaryPromptResultSchema, DriftDetectionSchema } from './canary-prompt.schema';

// ============================================================
// Canary Prompt Runner — Execute prompts and detect drift
// ============================================================

export interface CanaryPromptRunnerConfig {
  /** Model identifier to use for prompt execution. */
  defaultModel?: string;
  /** Timeout per prompt execution in ms. */
  timeoutMs?: number;
  /** Maximum parallel batch executions. */
  maxConcurrency?: number;
}

export interface LLMResponse {
  content: string;
  latencyMs: number;
  model: string;
  tokenUsage?: { prompt: number; completion: number };
}

export type LLMAdapter = (prompt: string, model: string) => Promise<LLMResponse>;

const DEFAULT_CONFIG: Required<CanaryPromptRunnerConfig> = {
  defaultModel: 'gpt-4',
  timeoutMs: 30_000,
  maxConcurrency: 5,
};

export class CanaryPromptRunner {
  private config: Required<CanaryPromptRunnerConfig>;
  private adapter: LLMAdapter;

  constructor(adapter: LLMAdapter, config?: Partial<CanaryPromptRunnerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.adapter = adapter;
  }

  async run(prompt: CanaryPromptDefinition, model?: string): Promise<CanaryPromptResult> {
    const useModel = model ?? this.config.defaultModel;
    const start = performance.now();

    try {
      const response = await this.withTimeout(this.adapter(prompt.prompt, useModel));
      const driftScore = this.evaluate(response.content, prompt.expectedBehavior);

      const result = CanaryPromptResultSchema.parse({
        promptId: prompt.id,
        model: useModel,
        response: response.content,
        driftScore,
        passed: driftScore <= prompt.driftThreshold,
        latencyMs: Math.round(performance.now() - start),
        timestamp: new Date().toISOString(),
      });

      return result;
    } catch (error) {
      return CanaryPromptResultSchema.parse({
        promptId: prompt.id,
        model: useModel,
        response: '',
        driftScore: 1,
        passed: false,
        latencyMs: Math.round(performance.now() - start),
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async runBatch(
    prompts: CanaryPromptDefinition[],
    model?: string,
  ): Promise<CanaryPromptBatchResult> {
    const useModel = model ?? this.config.defaultModel;
    const start = performance.now();

    const results: CanaryPromptResult[] = [];
    const chunks = this.chunk(prompts, this.config.maxConcurrency);

    for (const chunk of chunks) {
      const chunkResults = await Promise.all(chunk.map((p) => this.run(p, useModel)));
      results.push(...chunkResults);
    }

    const failedPrompts = results.filter((r) => !r.passed).map((r) => r.promptId);
    const overallDriftScore =
      results.length > 0 ? results.reduce((sum, r) => sum + r.driftScore, 0) / results.length : 0;

    return CanaryPromptResultSchema.array()
      .parse(results)
      .reduce<CanaryPromptBatchResult>((acc, _r) => acc, {
        results,
        overallDriftScore: Math.round(overallDriftScore * 1000) / 1000,
        overallPassed: failedPrompts.length === 0,
        failedPrompts,
        totalLatencyMs: Math.round(performance.now() - start),
        timestamp: new Date().toISOString(),
      });
  }

  evaluate(response: string, expected: string): number {
    const normalise = (s: string) =>
      s
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    const normalisedResponse = normalise(response);
    const normalisedExpected = normalise(expected);

    if (!normalisedExpected) return normalisedResponse ? 1 : 0;
    if (!normalisedResponse) return 1;

    if (normalisedResponse === normalisedExpected) return 0;

    const responseWords = new Set(normalisedResponse.split(' '));
    const expectedWords = new Set(normalisedExpected.split(' '));

    const intersection = new Set([...responseWords].filter((w) => expectedWords.has(w)));
    const union = new Set([...responseWords, ...expectedWords]);

    const jaccard = union.size > 0 ? intersection.size / union.size : 0;

    const responseLength = normalisedResponse.length;
    const expectedLength = normalisedExpected.length;
    const lengthRatio =
      Math.min(responseLength, expectedLength) / Math.max(responseLength, expectedLength);

    const containsBonus =
      normalisedExpected.split(' ').length > 2 &&
      normalisedResponse.includes(normalisedExpected.split(' ').slice(0, 3).join(' '))
        ? 0.15
        : 0;

    const driftScore = 1 - (jaccard * 0.5 + lengthRatio * 0.35 + containsBonus + 0.15);

    return Math.max(0, Math.min(1, Math.round(driftScore * 1000) / 1000));
  }

  detectDrift(results: CanaryPromptResult[]): DriftDetection {
    if (results.length === 0) {
      return DriftDetectionSchema.parse({
        detected: false,
        severity: 'none',
        affectedPrompts: [],
        averageDriftScore: 0,
        maxDriftScore: 0,
        recommendation: 'continue',
      });
    }

    const failedPrompts = results.filter((r) => !r.passed).map((r) => r.promptId);
    const driftScores = results.map((r) => r.driftScore);
    const averageDriftScore = driftScores.reduce((a, b) => a + b, 0) / driftScores.length;
    const maxDriftScore = Math.max(...driftScores);

    const severity = this.classifySeverity(
      averageDriftScore,
      maxDriftScore,
      failedPrompts.length,
      results.length,
    );
    const recommendation = this.recommend(severity, failedPrompts.length, results.length);

    return DriftDetectionSchema.parse({
      detected: failedPrompts.length > 0,
      severity,
      affectedPrompts: failedPrompts,
      averageDriftScore: Math.round(averageDriftScore * 1000) / 1000,
      maxDriftScore: Math.round(maxDriftScore * 1000) / 1000,
      recommendation,
      details: this.buildDetails(failedPrompts, averageDriftScore, maxDriftScore),
    });
  }

  private classifySeverity(
    avgDrift: number,
    maxDrift: number,
    failedCount: number,
    totalCount: number,
  ): 'none' | 'low' | 'medium' | 'high' | 'critical' {
    const failRatio = totalCount > 0 ? failedCount / totalCount : 0;

    if (maxDrift > 0.8 || failRatio > 0.5) return 'critical';
    if (maxDrift > 0.6 || failRatio > 0.3) return 'high';
    if (maxDrift > 0.4 || failRatio > 0.15) return 'medium';
    if (failedCount > 0) return 'low';
    return 'none';
  }

  private recommend(
    severity: 'none' | 'low' | 'medium' | 'high' | 'critical',
    failedCount: number,
    totalCount: number,
  ): 'continue' | 'investigate' | 'rollback' {
    if (severity === 'critical' || (severity === 'high' && failedCount / totalCount > 0.3)) {
      return 'rollback';
    }
    if (severity === 'high' || severity === 'medium') return 'investigate';
    return 'continue';
  }

  private buildDetails(failedPrompts: string[], avgDrift: number, maxDrift: number): string {
    if (failedPrompts.length === 0) return 'All prompts passed drift detection.';
    return (
      `${failedPrompts.length} prompt(s) exceeded drift threshold. ` +
      `Average drift: ${avgDrift.toFixed(3)}, max drift: ${maxDrift.toFixed(3)}. ` +
      `Affected: [${failedPrompts.join(', ')}]`
    );
  }

  private withTimeout<T>(promise: Promise<T>): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Prompt execution timed out')), this.config.timeoutMs),
      ),
    ]);
  }

  private chunk<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }
}
