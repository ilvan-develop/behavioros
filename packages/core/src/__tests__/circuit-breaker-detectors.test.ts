import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnomalyDetector } from '../resilience/circuit-breaker/detectors/anomaly-detector';
import { AttackDetector } from '../resilience/circuit-breaker/detectors/attack-detector';
import { FailureDetector } from '../resilience/circuit-breaker/detectors/failure-detector';

describe('FailureDetector', () => {
  let detector: FailureDetector;

  beforeEach(() => {
    vi.useFakeTimers();
    detector = new FailureDetector({
      windowMs: 60_000,
      failureRateThreshold: 50,
      minRequests: 10,
      successRateThreshold: 80,
      degradationThreshold: 20,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('recordRequest', () => {
    it('should record successful requests', () => {
      detector.recordRequest(true, 50);
      detector.recordRequest(true, 30);
      const stats = detector.getStats();
      expect(stats.totalRequests).toBe(2);
      expect(stats.totalSuccesses).toBe(2);
      expect(stats.totalFailures).toBe(0);
    });

    it('should record failed requests', () => {
      detector.recordRequest(true, 50);
      detector.recordRequest(false, 100);
      detector.recordRequest(false, 200);
      const stats = detector.getStats();
      expect(stats.totalRequests).toBe(3);
      expect(stats.totalSuccesses).toBe(1);
      expect(stats.totalFailures).toBe(2);
    });

    it('should reset consecutive failures on success', () => {
      detector.recordRequest(false, 100);
      detector.recordRequest(false, 100);
      detector.recordRequest(false, 100);
      expect(detector.getConsecutiveFailures()).toBe(3);
      detector.recordRequest(true, 50);
      expect(detector.getConsecutiveFailures()).toBe(0);
    });

    it('should track consecutive failures', () => {
      detector.recordRequest(false, 100);
      detector.recordRequest(false, 100);
      expect(detector.getConsecutiveFailures()).toBe(2);
    });

    it('should prune old entries outside window', () => {
      detector.recordRequest(true, 50);
      detector.recordRequest(true, 50);
      vi.advanceTimersByTime(61_000);
      detector.recordRequest(true, 50);
      const stats = detector.getStats();
      expect(stats.totalRequests).toBe(1);
    });
  });

  describe('getStats', () => {
    it('should return zero stats when no requests', () => {
      const stats = detector.getStats();
      expect(stats.totalRequests).toBe(0);
      expect(stats.failureRate).toBe(0);
      expect(stats.successRate).toBe(0);
      expect(stats.averageResponseTime).toBe(0);
      expect(stats.p95ResponseTime).toBe(0);
      expect(stats.p99ResponseTime).toBe(0);
    });

    it('should calculate failure rate correctly', () => {
      for (let i = 0; i < 10; i++) {
        detector.recordRequest(i < 4, 50);
      }
      const stats = detector.getStats();
      expect(stats.failureRate).toBe(60);
      expect(stats.successRate).toBe(40);
    });

    it('should calculate average response time', () => {
      detector.recordRequest(true, 100);
      detector.recordRequest(true, 200);
      detector.recordRequest(true, 300);
      const stats = detector.getStats();
      expect(stats.averageResponseTime).toBe(200);
    });

    it('should calculate percentiles', () => {
      for (let i = 1; i <= 100; i++) {
        detector.recordRequest(true, i);
      }
      const stats = detector.getStats();
      expect(stats.p95ResponseTime).toBe(95);
      expect(stats.p99ResponseTime).toBe(99);
    });

    it('should return stable trend with fewer than 20 samples', () => {
      for (let i = 0; i < 15; i++) {
        detector.recordRequest(true, 50);
      }
      const stats = detector.getStats();
      expect(stats.trend).toBe('stable');
    });
  });

  describe('shouldTrip', () => {
    it('should not trip with fewer than minRequests', () => {
      for (let i = 0; i < 9; i++) {
        detector.recordRequest(false, 100);
      }
      expect(detector.shouldTrip()).toBe(false);
    });

    it('should trip when failure rate exceeds threshold', () => {
      for (let i = 0; i < 10; i++) {
        detector.recordRequest(i < 3, 100);
      }
      expect(detector.shouldTrip()).toBe(true);
    });

    it('should trip with 5+ consecutive failures', () => {
      for (let i = 0; i < 9; i++) {
        detector.recordRequest(true, 50);
      }
      for (let i = 0; i < 5; i++) {
        detector.recordRequest(false, 100);
      }
      expect(detector.shouldTrip()).toBe(true);
    });

    it('should not trip when failure rate is below threshold', () => {
      for (let i = 0; i < 10; i++) {
        detector.recordRequest(true, 50);
      }
      expect(detector.shouldTrip()).toBe(false);
    });

    it('should not trip with 4 consecutive failures', () => {
      for (let i = 0; i < 10; i++) {
        detector.recordRequest(true, 50);
      }
      for (let i = 0; i < 4; i++) {
        detector.recordRequest(false, 100);
      }
      expect(detector.shouldTrip()).toBe(false);
    });
  });

  describe('reset', () => {
    it('should clear all data', () => {
      detector.recordRequest(false, 100);
      detector.recordRequest(false, 100);
      detector.reset();
      expect(detector.getConsecutiveFailures()).toBe(0);
      const stats = detector.getStats();
      expect(stats.totalRequests).toBe(0);
    });
  });
});

describe('AttackDetector', () => {
  let detector: AttackDetector;

  beforeEach(() => {
    vi.useFakeTimers();
    detector = new AttackDetector({
      rateThreshold: 6,
      rateWindowMs: 60_000,
      patternMatchEnabled: true,
      ipBlockDurationMs: 300_000,
      maxBlockedIps: 3,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('pattern detection', () => {
    it('should detect SQL injection via UNION SELECT', () => {
      const result = detector.detect('1 UNION SELECT * FROM users');
      expect(result.detected).toBe(true);
      expect(result.attackType).toBe('sql-injection');
      expect(result.severity).toBe('critical');
      expect(result.shouldBlock).toBe(true);
    });

    it('should detect SQL injection via DROP TABLE', () => {
      const result = detector.detect('DROP TABLE users');
      expect(result.detected).toBe(true);
      expect(result.attackType).toBe('sql-injection');
      expect(result.severity).toBe('critical');
    });

    it('should detect SQL injection via INSERT INTO', () => {
      const result = detector.detect('INSERT INTO users VALUES (1)');
      expect(result.detected).toBe(true);
      expect(result.attackType).toBe('sql-injection');
    });

    it('should detect XSS attempt', () => {
      const result = detector.detect('<script>alert("xss")</script>');
      expect(result.detected).toBe(true);
      expect(result.attackType).toBe('xss-attempt');
      expect(result.severity).toBe('high');
    });

    it('should detect path traversal', () => {
      const result = detector.detect('../../../etc/passwd');
      expect(result.detected).toBe(true);
      expect(result.attackType).toBe('path-traversal');
      expect(result.severity).toBe('high');
    });

    it('should detect command injection', () => {
      const result = detector.detect('file.txt; rm -rf /');
      expect(result.detected).toBe(true);
      expect(result.attackType).toBe('command-injection');
    });

    it('should detect SSRF attempt', () => {
      const result = detector.detect('http://127.0.0.1/admin');
      expect(result.detected).toBe(true);
      expect(result.attackType).toBe('ssrf-attempt');
      expect(result.severity).toBe('medium');
    });

    it('should detect localhost SSRF', () => {
      const result = detector.detect('http://localhost:8080/internal');
      expect(result.detected).toBe(true);
      expect(result.attackType).toBe('ssrf-attempt');
    });

    it('should not detect normal input', () => {
      const result = detector.detect('Hello world, this is normal text');
      expect(result.detected).toBe(false);
      expect(result.attackType).toBeNull();
      expect(result.shouldBlock).toBe(false);
    });
  });

  describe('source blocking', () => {
    it('should block source on critical attack', () => {
      detector.detect('DROP TABLE users', 'attacker-1');
      const blocked = detector.getBlockedSources();
      expect(blocked.length).toBe(1);
      expect(blocked[0].source).toBe('attacker-1');
    });

    it('should block source on high severity attack', () => {
      detector.detect('<script>alert(1)</script>', 'attacker-2');
      const blocked = detector.getBlockedSources();
      expect(blocked.length).toBe(1);
    });

    it('should reject requests from blocked source', () => {
      detector.detect('DROP TABLE users', 'attacker-1');
      const result = detector.detect('normal request', 'attacker-1');
      expect(result.detected).toBe(true);
      expect(result.attackType).toBe('blocked-source');
      expect(result.severity).toBe('critical');
    });

    it('should unblock source', () => {
      detector.detect('DROP TABLE users', 'attacker-1');
      expect(detector.getBlockedSources().length).toBe(1);
      detector.unblockSource('attacker-1');
      expect(detector.getBlockedSources().length).toBe(0);
    });

    it('should clean expired blocks', () => {
      detector.detect('DROP TABLE users', 'attacker-1');
      vi.advanceTimersByTime(900_001);
      const blocked = detector.getBlockedSources();
      expect(blocked.length).toBe(0);
    });

    it('should enforce max blocked IPs', () => {
      detector.detect('<script>1</script>', 'ip-1');
      detector.detect('../../../etc', 'ip-2');
      detector.detect('<script>2</script>', 'ip-3');
      const blocked1 = detector.getBlockedSources();
      expect(blocked1.length).toBe(3);
      detector.detect('<script>3</script>', 'ip-4');
      const blocked2 = detector.getBlockedSources();
      expect(blocked2.length).toBe(3);
    });
  });

  describe('rate limiting', () => {
    it('should detect rate abuse when threshold exceeded', () => {
      for (let i = 0; i < 5; i++) {
        detector.detect('normal request', 'spam-source');
      }
      const result = detector.detect('another', 'spam-source');
      expect(result.detected).toBe(true);
      expect(result.attackType).toBe('rate-abuse');
      expect(result.severity).toBe('high');
    });

    it('should block source on rate abuse', () => {
      for (let i = 0; i < 5; i++) {
        detector.detect('normal request', 'spam-source');
      }
      detector.detect('another', 'spam-source');
      expect(detector.getBlockedSources().length).toBe(1);
    });
  });

  describe('pattern management', () => {
    it('should return default patterns', () => {
      const patterns = detector.getPatterns();
      expect(patterns.length).toBe(5);
      expect(patterns.map((p) => p.id)).toContain('sql-injection');
    });

    it('should add custom pattern', () => {
      detector.addPattern({
        id: 'custom',
        name: 'Custom Attack',
        regex: /evil-pattern/,
        severity: 'low',
        description: 'Custom detection',
      });
      expect(detector.getPatterns().length).toBe(6);
    });

    it('should remove pattern by id', () => {
      const removed = detector.removePattern('sql-injection');
      expect(removed).toBe(true);
      expect(detector.getPatterns().length).toBe(4);
    });

    it('should return false when removing non-existent pattern', () => {
      expect(detector.removePattern('nonexistent')).toBe(false);
    });

    it('should detect custom pattern', () => {
      detector.addPattern({
        id: 'custom-evil',
        name: 'Evil Pattern',
        regex: /evil-pattern/,
        severity: 'critical',
        description: 'Custom evil',
      });
      const result = detector.detect('this has evil-pattern in it');
      expect(result.detected).toBe(true);
      expect(result.attackType).toBe('custom-evil');
    });
  });

  describe('pattern matching disabled', () => {
    it('should skip pattern matching when disabled', () => {
      const noPatternDetector = new AttackDetector({ patternMatchEnabled: false });
      const result = noPatternDetector.detect('DROP TABLE users');
      expect(result.detected).toBe(false);
    });
  });

  describe('reset', () => {
    it('should clear all data', () => {
      detector.detect('DROP TABLE users', 'attacker');
      detector.detect('normal', 'normal-source');
      detector.reset();
      expect(detector.getBlockedSources().length).toBe(0);
    });
  });
});

describe('AnomalyDetector', () => {
  let detector: AnomalyDetector;

  beforeEach(() => {
    detector = new AnomalyDetector({
      windowSize: 100,
      zScoreThreshold: 2.5,
      minSamples: 10,
      sensitivity: 'medium',
    });
  });

  describe('record', () => {
    it('should not detect anomaly with fewer than minSamples', () => {
      for (let i = 0; i < 9; i++) {
        const result = detector.record(100);
        expect(result.isAnomaly).toBe(false);
      }
    });

    it('should detect outlier as anomaly', () => {
      for (let i = 0; i < 20; i++) {
        detector.record(100);
      }
      const result = detector.record(500);
      expect(result.isAnomaly).toBe(true);
      expect(result.zScore).toBeGreaterThan(2.5);
    });

    it('should not detect normal value as anomaly', () => {
      for (let i = 0; i < 20; i++) {
        detector.record(90 + Math.random() * 20);
      }
      const result = detector.record(100);
      expect(result.isAnomaly).toBe(false);
    });

    it('should track sample count', () => {
      detector.record(100);
      detector.record(200);
      const stats = detector.getStats();
      expect(stats.sampleSize).toBe(2);
    });

    it('should enforce window size', () => {
      for (let i = 0; i < 150; i++) {
        detector.record(i);
      }
      const stats = detector.getStats();
      expect(stats.sampleSize).toBe(100);
    });

    it('should return accurate zScore', () => {
      for (let i = 0; i < 20; i++) {
        detector.record(100);
      }
      const result = detector.record(200);
      expect(result.zScore).toBeGreaterThan(0);
      expect(result.mean).toBeCloseTo(105, 0);
    });
  });

  describe('analyze', () => {
    it('should return zero stats with no samples', () => {
      const result = detector.analyze(100);
      expect(result.isAnomaly).toBe(false);
      expect(result.sampleSize).toBe(0);
    });

    it('should handle zero standard deviation', () => {
      for (let i = 0; i < 10; i++) {
        detector.record(100);
      }
      const result = detector.analyze(100);
      expect(result.isAnomaly).toBe(false);
      expect(result.stdDev).toBe(0);
    });

    it('should calculate correct mean and stdDev', () => {
      for (let i = 0; i < 10; i++) {
        detector.record(100 + i);
      }
      const stats = detector.getStats();
      expect(stats.mean).toBeCloseTo(104.5, 1);
      expect(stats.stdDev).toBeGreaterThan(0);
    });
  });

  describe('sensitivity levels', () => {
    it('should use low sensitivity threshold (3.5)', () => {
      const low = new AnomalyDetector({ sensitivity: 'low', minSamples: 5, windowSize: 100 });
      for (let i = 0; i < 10; i++) {
        low.record(100);
      }
      const result = low.analyze(150);
      expect(result.threshold).toBe(3.5);
    });

    it('should use high sensitivity threshold (2.0)', () => {
      const high = new AnomalyDetector({ sensitivity: 'high', minSamples: 5, windowSize: 100 });
      for (let i = 0; i < 10; i++) {
        high.record(100);
      }
      const result = high.analyze(150);
      expect(result.threshold).toBe(2.0);
    });

    it('should use medium sensitivity threshold (2.5) by default', () => {
      expect(detector.analyze(0).threshold).toBe(2.5);
    });
  });

  describe('getStats', () => {
    it('should return zero stats for empty detector', () => {
      const stats = detector.getStats();
      expect(stats.sampleSize).toBe(0);
      expect(stats.mean).toBe(0);
      expect(stats.stdDev).toBe(0);
    });

    it('should track min and max', () => {
      detector.record(10);
      detector.record(50);
      detector.record(30);
      const stats = detector.getStats();
      expect(stats.min).toBe(10);
      expect(stats.max).toBe(50);
    });
  });

  describe('reset', () => {
    it('should clear all samples', () => {
      detector.record(100);
      detector.record(200);
      detector.reset();
      const stats = detector.getStats();
      expect(stats.sampleSize).toBe(0);
    });
  });

  describe('getSamples', () => {
    it('should return a copy of samples', () => {
      detector.record(100);
      detector.record(200);
      const samples = detector.getSamples();
      expect(samples).toEqual([100, 200]);
      samples.push(300);
      expect(detector.getSamples().length).toBe(2);
    });
  });
});
