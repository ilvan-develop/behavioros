export interface AttackDetectorConfig {
  rateThreshold: number;
  rateWindowMs: number;
  patternMatchEnabled: boolean;
  ipBlockDurationMs: number;
  maxBlockedIps: number;
}

export interface AttackPattern {
  id: string;
  name: string;
  regex: RegExp;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

export interface AttackDetectionResult {
  detected: boolean;
  attackType: string | null;
  severity: 'low' | 'medium' | 'high' | 'critical' | null;
  details: string;
  shouldBlock: boolean;
  blockedUntil?: string;
}

interface RequestRecord {
  timestamp: number;
  source: string;
}

const DEFAULT_PATTERNS: AttackPattern[] = [
  {
    id: 'sql-injection',
    name: 'SQL Injection',
    regex:
      /(\b(union\b.*\bselect|select\b.*\bfrom|insert\b.*\binto|delete\b.*\bfrom|drop\b.*\btable|exec\b.* xp_)\b)/i,
    severity: 'critical',
    description: 'SQL injection attempt detected',
  },
  {
    id: 'xss-attempt',
    name: 'Cross-Site Scripting',
    regex: /(<script\b[^>]*>[\s\S]*?<\/script|javascript:|on\w+\s*=)/i,
    severity: 'high',
    description: 'XSS attack pattern detected',
  },
  {
    id: 'path-traversal',
    name: 'Path Traversal',
    regex: /(\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e\/|\.%2e\/|%2e\.%2f)/i,
    severity: 'high',
    description: 'Path traversal attempt detected',
  },
  {
    id: 'command-injection',
    name: 'Command Injection',
    regex: /(\||;|`|&|&&|\$\(|\$\{)/,
    severity: 'critical',
    description: 'Command injection pattern detected',
  },
  {
    id: 'ssrf-attempt',
    name: 'SSRF Attempt',
    regex:
      /(127\.0\.0\.1|localhost|0\.0\.0\.0|169\.254|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+)/i,
    severity: 'medium',
    description: 'SSRF attempt to internal network',
  },
];

export class AttackDetector {
  private config: AttackDetectorConfig;
  private patterns: AttackPattern[];
  private requestLog: RequestRecord[] = [];
  private blockedSources: Map<string, number> = new Map();

  constructor(config?: Partial<AttackDetectorConfig>) {
    this.config = {
      rateThreshold: config?.rateThreshold ?? 100,
      rateWindowMs: config?.rateWindowMs ?? 60_000,
      patternMatchEnabled: config?.patternMatchEnabled ?? true,
      ipBlockDurationMs: config?.ipBlockDurationMs ?? 300_000,
      maxBlockedIps: config?.maxBlockedIps ?? 1_000,
    };
    this.patterns = [...DEFAULT_PATTERNS];
  }

  detect(input: string, source?: string): AttackDetectionResult {
    if (source && this.isSourceBlocked(source)) {
      return {
        detected: true,
        attackType: 'blocked-source',
        severity: 'critical',
        details: `Source ${source} is blocked`,
        shouldBlock: true,
        blockedUntil: new Date(this.blockedSources.get(source)!).toISOString(),
      };
    }

    if (this.config.patternMatchEnabled) {
      const patternResult = this.checkPatterns(input);
      if (patternResult.detected) {
        if (source) {
          this.blockSource(source, patternResult.severity!);
        }
        return patternResult;
      }
    }

    if (source) {
      this.recordRequest(source);
      const rateResult = this.checkRate(source);
      if (rateResult.detected) {
        this.blockSource(source, rateResult.severity!);
        return rateResult;
      }
    }

    return {
      detected: false,
      attackType: null,
      severity: null,
      details: 'No attack patterns detected',
      shouldBlock: false,
    };
  }

  private checkPatterns(input: string): AttackDetectionResult {
    for (const pattern of this.patterns) {
      if (pattern.regex.test(input)) {
        return {
          detected: true,
          attackType: pattern.id,
          severity: pattern.severity,
          details: pattern.description,
          shouldBlock: pattern.severity === 'critical' || pattern.severity === 'high',
        };
      }
    }

    return {
      detected: false,
      attackType: null,
      severity: null,
      details: 'No pattern match',
      shouldBlock: false,
    };
  }

  private checkRate(source: string): AttackDetectionResult {
    const now = Date.now();
    const windowStart = now - this.config.rateWindowMs;
    const recentRequests = this.requestLog.filter(
      (r) => r.source === source && r.timestamp >= windowStart,
    );

    if (recentRequests.length >= this.config.rateThreshold) {
      return {
        detected: true,
        attackType: 'rate-abuse',
        severity: 'high',
        details: `Rate threshold exceeded — ${recentRequests.length} requests in ${this.config.rateWindowMs}ms window (threshold: ${this.config.rateThreshold})`,
        shouldBlock: true,
      };
    }

    return {
      detected: false,
      attackType: null,
      severity: null,
      details: 'Rate within limits',
      shouldBlock: false,
    };
  }

  private recordRequest(source: string): void {
    this.requestLog.push({ timestamp: Date.now(), source });

    const cutoff = Date.now() - this.config.rateWindowMs * 2;
    this.requestLog = this.requestLog.filter((r) => r.timestamp >= cutoff);
  }

  private blockSource(source: string, severity: string): void {
    if (this.blockedSources.size >= this.config.maxBlockedIps) {
      const oldest = this.blockedSources.entries().next().value;
      if (oldest) this.blockedSources.delete(oldest[0]);
    }

    const durationMultiplier =
      severity === 'critical' ? 3 : severity === 'high' ? 2 : severity === 'medium' ? 1.5 : 1;
    const duration = this.config.ipBlockDurationMs * durationMultiplier;

    this.blockedSources.set(source, Date.now() + duration);
  }

  private isSourceBlocked(source: string): boolean {
    const blockedUntil = this.blockedSources.get(source);
    if (!blockedUntil) return false;

    if (Date.now() >= blockedUntil) {
      this.blockedSources.delete(source);
      return false;
    }

    return true;
  }

  addPattern(pattern: AttackPattern): void {
    this.patterns.push(pattern);
  }

  removePattern(patternId: string): boolean {
    const index = this.patterns.findIndex((p) => p.id === patternId);
    if (index !== -1) {
      this.patterns.splice(index, 1);
      return true;
    }
    return false;
  }

  getPatterns(): AttackPattern[] {
    return [...this.patterns];
  }

  getBlockedSources(): Array<{ source: string; blockedUntil: string }> {
    const now = Date.now();
    const result: Array<{ source: string; blockedUntil: string }> = [];

    for (const [source, until] of this.blockedSources) {
      if (now < until) {
        result.push({ source, blockedUntil: new Date(until).toISOString() });
      } else {
        this.blockedSources.delete(source);
      }
    }

    return result;
  }

  unblockSource(source: string): boolean {
    return this.blockedSources.delete(source);
  }

  reset(): void {
    this.requestLog = [];
    this.blockedSources.clear();
  }
}
