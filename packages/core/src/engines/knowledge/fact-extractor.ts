import { randomUUID } from 'node:crypto';

/**
 * ExtractedFact — Configuration and options interface.
 */
export interface ExtractedFact {
  id: string;
  subject: string;
  predicate: string;
  object: string;
  confidence: number;
  source: string;
  entities: NamedEntity[];
  temporal?: TemporalExpression;
  extractedAt: string;
}

/**
 * NamedEntity — Configuration and options interface.
 */
export interface NamedEntity {
  text: string;
  type: 'person' | 'organization' | 'location' | 'date' | 'technology' | 'concept';
  confidence: number;
}

/**
 * TemporalExpression — Configuration and options interface.
 */
export interface TemporalExpression {
  text: string;
  type: 'absolute' | 'relative' | 'duration';
  resolved?: string;
}

const TRIPLE_PATTERNS = [
  { regex: /\b([\w.]+)\s+is\s+(?:a\s+|an\s+|the\s+)?([\w.]+)\b/gi, predicate: 'is' },
  { regex: /\b([\w.]+)\s+has\s+([\w.]+)\b/gi, predicate: 'has' },
  { regex: /\b([\w.]+)\s+uses\s+([\w.]+)\b/gi, predicate: 'uses' },
  { regex: /\b([\w.]+)\s+was\s+(?:a\s+|an\s+|the\s+)?([\w.]+)\b/gi, predicate: 'was' },
  { regex: /\b([\w.]+)\s+created\s+([\w.]+)\b/gi, predicate: 'created' },
  { regex: /\b([\w.]+)\s+owns\s+([\w.]+)\b/gi, predicate: 'owns' },
  { regex: /\b([\w.]+)\s+manages\s+([\w.]+)\b/gi, predicate: 'manages' },
];

const DATE_PATTERNS = [
  { regex: /\bin\s+(\d{4})\b/gi, type: 'absolute' as const, resolve: (m: string) => m },
  {
    regex: /\bon\s+(\w+\s+\d{1,2},?\s+\d{4})\b/gi,
    type: 'absolute' as const,
    resolve: (m: string) => m,
  },
  {
    regex: /\b(\w+\s+\d{1,2},?\s+\d{4})\b/gi,
    type: 'absolute' as const,
    resolve: (m: string) => m,
  },
  { regex: /\byesterday\b/gi, type: 'relative' as const, resolve: () => undefined },
  { regex: /\btoday\b/gi, type: 'relative' as const, resolve: () => undefined },
  { regex: /\btomorrow\b/gi, type: 'relative' as const, resolve: () => undefined },
  { regex: /\blast\s+(\w+)\b/gi, type: 'relative' as const, resolve: () => undefined },
  { regex: /\bnext\s+(\w+)\b/gi, type: 'relative' as const, resolve: () => undefined },
  { regex: /\bfor\s+(\d+\s+\w+)\b/gi, type: 'duration' as const, resolve: () => undefined },
  { regex: /\bduring\s+(\w+\s+\d{4})\b/gi, type: 'absolute' as const, resolve: (m: string) => m },
];

const ENTITY_DICTIONARY: Record<
  string,
  'person' | 'organization' | 'location' | 'date' | 'technology' | 'concept'
> = {
  'node.js': 'technology',
  typescript: 'technology',
  javascript: 'technology',
  python: 'technology',
  react: 'technology',
  postgresql: 'technology',
  mongodb: 'technology',
  redis: 'technology',
  docker: 'technology',
  kubernetes: 'technology',
  aws: 'organization',
  google: 'organization',
  microsoft: 'organization',
  github: 'organization',
  openai: 'organization',
  'new york': 'location',
  london: 'location',
  'san francisco': 'location',
  berlin: 'location',
  tokyo: 'location',
  authentication: 'concept',
  authorization: 'concept',
  encryption: 'concept',
  'machine learning': 'concept',
  'artificial intelligence': 'concept',
  api: 'concept',
  database: 'concept',
  microservices: 'concept',
};

const SENTENCE_SPLIT = /(?<=[.!?])\s+/;

/**
 * FactExtractor — fact extractor.
 *
 * Methods: extract, extractTriples, extractEntities, extractTemporal, getFacts, clear.
 */
export class FactExtractor {
  private facts: ExtractedFact[] = [];

  extract(text: string, source: string): ExtractedFact[] {
    if (!text || text.trim().length === 0) return [];

    const sentences = text.split(SENTENCE_SPLIT).filter((s) => s.trim().length > 0);
    const extracted: ExtractedFact[] = [];

    for (const sentence of sentences) {
      const triples = this.extractTriples(sentence);
      const entities = this.extractEntities(sentence);
      const temporal = this.extractTemporal(sentence);

      for (const triple of triples) {
        let confidence = triple.confidence;

        if (entities.length > 0) {
          confidence = Math.min(1, confidence + 0.1);
        }
        if (temporal) {
          confidence = Math.min(1, confidence + 0.05);
        }

        const fact: ExtractedFact = {
          id: randomUUID(),
          subject: triple.subject,
          predicate: triple.predicate,
          object: triple.object,
          confidence: Math.round(confidence * 100) / 100,
          source,
          entities: entities.filter(
            (e) =>
              triple.subject.toLowerCase().includes(e.text.toLowerCase()) ||
              triple.object.toLowerCase().includes(e.text.toLowerCase()),
          ),
          temporal,
          extractedAt: new Date().toISOString(),
        };

        extracted.push(fact);
      }
    }

    this.facts.push(...extracted);
    return extracted;
  }

  extractTriples(
    sentence: string,
  ): { subject: string; predicate: string; object: string; confidence: number }[] {
    const results: { subject: string; predicate: string; object: string; confidence: number }[] =
      [];

    for (const pattern of TRIPLE_PATTERNS) {
      pattern.regex.lastIndex = 0;

      for (;;) {
        const match = pattern.regex.exec(sentence);
        if (!match) break;

        const subject = match[1].trim();
        const object = match[2].trim();

        if (!subject || !object) continue;

        const wordCount = subject.split(/\s+/).length + object.split(/\s+/).length;
        const confidence = Math.min(0.9, 0.5 + wordCount * 0.05);

        results.push({ subject, predicate: pattern.predicate, object, confidence });
      }
    }

    return results;
  }

  extractEntities(text: string): NamedEntity[] {
    const entities: NamedEntity[] = [];
    const lower = text.toLowerCase();
    const seen = new Set<string>();

    const sortedEntries = Object.entries(ENTITY_DICTIONARY).sort(
      (a, b) => b[0].split(/\s+/).length - a[0].split(/\s+/).length,
    );

    for (const [key, type] of sortedEntries) {
      if (lower.includes(key) && !seen.has(key)) {
        seen.add(key);
        entities.push({
          text: key,
          type,
          confidence: 0.9,
        });
      }
    }

    return entities;
  }

  extractTemporal(text: string): TemporalExpression | undefined {
    for (const pattern of DATE_PATTERNS) {
      pattern.regex.lastIndex = 0;
      const match = pattern.regex.exec(text);
      if (match) {
        const resolved = pattern.resolve?.(match[1] ?? match[0]);
        return {
          text: match[0],
          type: pattern.type,
          resolved,
        };
      }
    }

    return undefined;
  }

  getFacts(source?: string): ExtractedFact[] {
    if (source) {
      return this.facts.filter((f) => f.source === source);
    }
    return [...this.facts];
  }

  clear(): void {
    this.facts = [];
  }
}
