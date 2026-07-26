import { describe, expect, it } from 'vitest';
import { type AccessRequest, ZeroTrustEngine } from '../engines/security/zero-trust-engine';

function makeRequest(overrides: Partial<AccessRequest> = {}): AccessRequest {
  return {
    userId: 'user-1',
    resource: '/api/payments',
    action: 'write',
    sessionToken: 'valid-token',
    deviceId: 'device-1',
    ipAddress: '192.168.1.1',
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe('ZeroTrustEngine', () => {
  it('should grant access with all valid factors', () => {
    const engine = new ZeroTrustEngine();
    engine.registerSession('valid-token', 'user-1');
    engine.setDeviceTrust('device-1', true);
    const request = makeRequest();

    const result = engine.evaluateAccess(request);

    expect(result.allowed).toBe(true);
    expect(result.confidence).toBeGreaterThan(0.7);
    expect(result.requiresStepUp).toBe(false);
    expect(result.factors).toHaveLength(4);
  });

  it('should deny access with invalid session token', () => {
    const engine = new ZeroTrustEngine();
    const request = makeRequest({ sessionToken: 'invalid-token' });

    const result = engine.evaluateAccess(request);

    expect(result.allowed).toBe(false);
    const sessionFactor = result.factors.find((f) => f.name === 'session');
    expect(sessionFactor?.passed).toBe(false);
    expect(sessionFactor?.score).toBe(0);
  });

  it('should return low score when session token is missing', () => {
    const engine = new ZeroTrustEngine();
    const request = makeRequest({ sessionToken: undefined });

    const result = engine.evaluateAccess(request);

    const sessionFactor = result.factors.find((f) => f.name === 'session');
    expect(sessionFactor?.passed).toBe(false);
    expect(sessionFactor?.score).toBe(0);
  });

  it('should respect device trust setting', () => {
    const engine = new ZeroTrustEngine();
    engine.setDeviceTrust('device-1', true);

    const request = makeRequest({ deviceId: 'device-1' });
    const result = engine.evaluateAccess(request);

    const deviceFactor = result.factors.find((f) => f.name === 'device');
    expect(deviceFactor?.passed).toBe(true);
    expect(deviceFactor?.score).toBe(1);
  });

  it('should mark device factor as failed when device is untrusted', () => {
    const engine = new ZeroTrustEngine();
    engine.setDeviceTrust('device-1', false);

    const request = makeRequest({ deviceId: 'device-1' });
    const result = engine.evaluateAccess(request);

    const deviceFactor = result.factors.find((f) => f.name === 'device');
    expect(deviceFactor?.passed).toBe(false);
  });

  it('should trigger anomaly rule and fail anomaly factor', () => {
    const engine = new ZeroTrustEngine();
    engine.addAnomalyRule((req) => req.ipAddress === '10.0.0.1');

    const request = makeRequest({ ipAddress: '10.0.0.1' });
    const result = engine.evaluateAccess(request);

    const anomalyFactor = result.factors.find((f) => f.name === 'anomaly');
    expect(anomalyFactor?.passed).toBe(false);
    expect(anomalyFactor?.score).toBe(0);
  });

  it('should require step-up auth when confidence < 0.7', () => {
    const engine = new ZeroTrustEngine();
    const request = makeRequest({
      sessionToken: 'invalid-token',
      deviceId: 'untrusted-device',
      ipAddress: '10.0.0.1',
    });

    engine.addAnomalyRule((req) => req.ipAddress === '10.0.0.1');

    const result = engine.evaluateAccess(request);

    expect(result.confidence).toBeLessThan(0.7);
    expect(result.requiresStepUp).toBe(true);
  });

  it('should validate known session tokens', () => {
    const engine = new ZeroTrustEngine();
    engine.registerSession('known-token', 'user-1');

    const isValid = engine.validateSession('known-token');

    expect(isValid).toBe(true);
  });

  it('should return false for unknown session tokens', () => {
    const engine = new ZeroTrustEngine();

    const isValid = engine.validateSession('nonexistent-token');

    expect(isValid).toBe(false);
  });

  it('should return evaluation history', () => {
    const engine = new ZeroTrustEngine();

    engine.evaluateAccess(makeRequest({ userId: 'user-1' }));
    engine.evaluateAccess(makeRequest({ userId: 'user-2' }));

    const history = engine.getEvaluationHistory();
    expect(history).toHaveLength(2);
  });

  it('should return evaluation history without userId filter', () => {
    const engine = new ZeroTrustEngine();

    engine.evaluateAccess(makeRequest({ userId: 'user-a' }));
    engine.evaluateAccess(makeRequest({ userId: 'user-b' }));

    const history = engine.getEvaluationHistory();
    expect(history).toHaveLength(2);
  });

  it('should not fail anomaly detection when no rules defined', () => {
    const engine = new ZeroTrustEngine();
    const request = makeRequest();

    const result = engine.evaluateAccess(request);

    const anomalyFactor = result.factors.find((f) => f.name === 'anomaly');
    expect(anomalyFactor?.passed).toBe(true);
    expect(anomalyFactor?.score).toBe(1);
  });
});
