import { randomUUID } from 'node:crypto';

/**
 * LogLevel — Union type: debug, info, warn, error, fatal;.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * LogEntry — Configuration and options interface.
 */
export interface LogEntry {
  id: string;
  level: LogLevel;
  message: string;
  source: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

/**
 * LoggingEngine — logging engine.
 *
 * Methods: log, debug, info, warn, error, fatal, and 3 more.
 */
export class LoggingEngine {
  private entries: LogEntry[] = [];
  private currentLevel: LogLevel = 'debug';

  log(level: LogLevel, message: string, source: string, metadata?: Record<string, unknown>): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.currentLevel]) return;
    this.entries.push({
      id: randomUUID(),
      level,
      message,
      source,
      timestamp: new Date().toISOString(),
      metadata,
    });
  }

  debug(msg: string, src?: string, meta?: Record<string, unknown>): void {
    this.log('debug', msg, src ?? 'system', meta);
  }

  info(msg: string, src?: string, meta?: Record<string, unknown>): void {
    this.log('info', msg, src ?? 'system', meta);
  }

  warn(msg: string, src?: string, meta?: Record<string, unknown>): void {
    this.log('warn', msg, src ?? 'system', meta);
  }

  error(msg: string, src?: string, meta?: Record<string, unknown>): void {
    this.log('error', msg, src ?? 'system', meta);
  }

  fatal(msg: string, src?: string, meta?: Record<string, unknown>): void {
    this.log('fatal', msg, src ?? 'system', meta);
  }

  query(options: {
    level?: LogLevel;
    source?: string;
    since?: string;
    until?: string;
    limit?: number;
  }): LogEntry[] {
    let results = [...this.entries];

    if (options.level) {
      results = results.filter((e) => e.level === options.level);
    }

    if (options.source) {
      results = results.filter((e) => e.source === options.source);
    }

    if (options.since) {
      const since = new Date(options.since).getTime();
      results = results.filter((e) => new Date(e.timestamp).getTime() >= since);
    }

    if (options.until) {
      const until = new Date(options.until).getTime();
      results = results.filter((e) => new Date(e.timestamp).getTime() <= until);
    }

    if (options.limit !== undefined && options.limit >= 0) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  setLevel(level: LogLevel): void {
    this.currentLevel = level;
  }

  export(format: 'json' | 'text' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify(this.entries, null, 2);
    }
    return this.entries
      .map((e) => `[${e.timestamp}] [${e.level.toUpperCase()}] [${e.source}] ${e.message}`)
      .join('\n');
  }
}
