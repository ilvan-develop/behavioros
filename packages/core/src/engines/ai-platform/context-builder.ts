const DEFAULT_MAX_TOKENS = 128_000;

const TOKEN_ESTIMATE_RATIO = 4;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / TOKEN_ESTIMATE_RATIO);
}

/**
 * ContextSource — Configuration and options interface.
 */
export interface ContextSource {
  type: 'system' | 'history' | 'document' | 'tool' | 'memory';
  content: string;
  priority: number;
  maxTokens?: number;
}

/**
 * ContextSegment — Configuration and options interface.
 */
export interface ContextSegment {
  source: string;
  content: string;
  tokens: number;
}

/**
 * BuiltContext — Configuration and options interface.
 */
export interface BuiltContext {
  segments: ContextSegment[];
  totalTokens: number;
  truncated: boolean;
}

/**
 * ContextBuilder — context builder.
 *
 * Methods: add, build, clear.
 */
export class ContextBuilder {
  private sources: ContextSource[] = [];
  private maxTokens: number;

  constructor(maxTokens?: number) {
    this.maxTokens = maxTokens ?? DEFAULT_MAX_TOKENS;
  }

  add(source: ContextSource): void {
    this.sources.push(source);
  }

  build(): BuiltContext {
    const sorted = [...this.sources].sort((a, b) => b.priority - a.priority);
    const segments: ContextSegment[] = [];
    let totalTokens = 0;
    let truncated = false;

    for (const source of sorted) {
      const rawTokens = estimateTokens(source.content);
      let content = source.content;
      let tokens = rawTokens;

      if (source.maxTokens && rawTokens > source.maxTokens) {
        const maxChars = source.maxTokens * TOKEN_ESTIMATE_RATIO;
        content = source.content.slice(0, maxChars);
        tokens = source.maxTokens;
      }

      if (totalTokens + tokens > this.maxTokens) {
        const remaining = this.maxTokens - totalTokens;
        if (remaining > 0) {
          const maxChars = remaining * TOKEN_ESTIMATE_RATIO;
          content = source.content.slice(0, maxChars);
          tokens = remaining;
          segments.push({
            source: source.type,
            content,
            tokens,
          });
          totalTokens += tokens;
        }
        truncated = true;
        break;
      }

      segments.push({ source: source.type, content, tokens });
      totalTokens += tokens;
    }

    return { segments, totalTokens, truncated };
  }

  clear(): void {
    this.sources = [];
  }
}
