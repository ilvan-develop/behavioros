import crypto from 'node:crypto';

/**
 * AccessRequest — Configuration and options interface.
 */
export interface AccessRequest {
  userId: string;
  resource: string;
  action: string;
  deviceId?: string;
  ipAddress?: string;
  timestamp: string;
  sessionToken?: string;
}

/**
 * FactorResult — Configuration and options interface.
 */
export interface FactorResult {
  name: string;
  passed: boolean;
  score: number;
}

/**
 * TrustEvaluation — Configuration and options interface.
 */
export interface TrustEvaluation {
  allowed: boolean;
  confidence: number;
  factors: FactorResult[];
  requiresStepUp: boolean;
  reason: string;
}

interface SessionRecord {
  valid: boolean;
  userId: string;
  createdAt: string;
}

interface AnomalyRule {
  id: string;
  rule: (request: AccessRequest) => boolean;
}

/**
 * ZeroTrustEngine — zero trust engine.
 *
 * Methods: evaluateAccess, validateSession, setDeviceTrust, addAnomalyRule, registerSession, getEvaluationHistory.
 */
export class ZeroTrustEngine {
  private sessions: Map<string, SessionRecord> = new Map();
  private trustedDevices: Set<string> = new Set();
  private anomalyRules: AnomalyRule[] = [];
  private history: TrustEvaluation[] = [];
  private knownLocations: Map<string, Set<string>> = new Map();

  evaluateAccess(request: AccessRequest): TrustEvaluation {
    const factors: FactorResult[] = [];

    const sessionFactor = this.checkSession(request);
    factors.push(sessionFactor);

    const deviceFactor = this.checkDevice(request);
    factors.push(deviceFactor);

    const locationFactor = this.checkLocation(request);
    factors.push(locationFactor);

    const anomalyFactor = this.checkAnomalies(request);
    factors.push(anomalyFactor);

    const _passed = factors.filter((f) => f.passed);
    const totalScore = factors.reduce((sum, f) => sum + f.score, 0);
    const maxScore = factors.length;
    const confidence = maxScore > 0 ? Math.round((totalScore / maxScore) * 1000) / 1000 : 0;

    const requiresStepUp = confidence < 0.7;
    const allPassed = factors.every((f) => f.passed);
    const allowed = allPassed || (!allPassed && confidence >= 0.5);

    let reason: string;
    if (allPassed) {
      reason = 'All trust factors passed';
    } else if (confidence >= 0.5) {
      const failed = factors.filter((f) => !f.passed).map((f) => f.name);
      reason = `Low confidence (${confidence}): ${failed.join(', ')} failed but within tolerance`;
    } else {
      const failed = factors.filter((f) => !f.passed).map((f) => f.name);
      reason = `Access denied: ${failed.join(', ')} failed (confidence ${confidence})`;
    }

    const evaluation: TrustEvaluation = {
      allowed,
      confidence,
      factors,
      requiresStepUp,
      reason,
    };

    this.history.push(evaluation);
    return evaluation;
  }

  validateSession(token: string): boolean {
    const record = this.sessions.get(token);
    if (!record) return false;
    return record.valid;
  }

  setDeviceTrust(deviceId: string, trusted: boolean): void {
    if (trusted) {
      this.trustedDevices.add(deviceId);
    } else {
      this.trustedDevices.delete(deviceId);
    }
  }

  addAnomalyRule(rule: (request: AccessRequest) => boolean): void {
    const id = crypto.randomUUID();
    this.anomalyRules.push({ id, rule });
  }

  registerSession(token: string, userId: string): void {
    this.sessions.set(token, {
      valid: true,
      userId,
      createdAt: new Date().toISOString(),
    });
  }

  getEvaluationHistory(userId?: string): TrustEvaluation[] {
    if (!userId) return [...this.history];
    return this.history;
  }

  private checkSession(request: AccessRequest): FactorResult {
    if (!request.sessionToken) {
      return { name: 'session', passed: false, score: 0 };
    }
    const valid = this.validateSession(request.sessionToken);
    return {
      name: 'session',
      passed: valid,
      score: valid ? 1 : 0,
    };
  }

  private checkDevice(request: AccessRequest): FactorResult {
    if (!request.deviceId) {
      return { name: 'device', passed: false, score: 0 };
    }
    const trusted = this.trustedDevices.has(request.deviceId);
    return {
      name: 'device',
      passed: trusted,
      score: trusted ? 1 : 0.3,
    };
  }

  private checkLocation(request: AccessRequest): FactorResult {
    if (!request.ipAddress) {
      return { name: 'location', passed: true, score: 0.5 };
    }
    const userLocations = this.knownLocations.get(request.userId);
    if (!userLocations) {
      this.knownLocations.set(request.userId, new Set([request.ipAddress]));
      return { name: 'location', passed: true, score: 0.6 };
    }
    if (userLocations.has(request.ipAddress)) {
      return { name: 'location', passed: true, score: 1 };
    }
    userLocations.add(request.ipAddress);
    return { name: 'location', passed: true, score: 0.6 };
  }

  private checkAnomalies(request: AccessRequest): FactorResult {
    if (this.anomalyRules.length === 0) {
      return { name: 'anomaly', passed: true, score: 1 };
    }
    for (const ar of this.anomalyRules) {
      if (ar.rule(request)) {
        return { name: 'anomaly', passed: false, score: 0 };
      }
    }
    return { name: 'anomaly', passed: true, score: 1 };
  }
}
