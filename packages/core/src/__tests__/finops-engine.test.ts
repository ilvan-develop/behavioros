import { describe, expect, it } from 'vitest';
import { type Budget, FinOpsEngine } from '../engines/observability/finops-engine';

describe('FinOpsEngine', () => {
  const createEngine = () => {
    const engine = new FinOpsEngine();
    const budget: Budget = {
      id: 'bgt-001',
      name: 'Q3 Infrastructure',
      amount: 10000,
      period: 'quarterly',
      spent: 0,
      alerts: [50, 80, 90, 100],
      notified: [],
    };
    engine.setBudget(budget);
    return { engine, budget };
  };

  it('sets and gets a budget', () => {
    const { engine } = createEngine();
    const retrieved = engine.getBudget('bgt-001');
    expect(retrieved).toBeDefined();
    expect(retrieved!.id).toBe('bgt-001');
    expect(retrieved!.name).toBe('Q3 Infrastructure');
    expect(retrieved!.amount).toBe(10000);
    expect(retrieved!.period).toBe('quarterly');
  });

  it('returns undefined for nonexistent budget', () => {
    const engine = new FinOpsEngine();
    expect(engine.getBudget('nonexistent')).toBeUndefined();
  });

  it('tracks costs and returns total', () => {
    const engine = new FinOpsEngine();
    engine.trackCost('compute', 500);
    engine.trackCost('storage', 300);
    engine.trackCost('compute', 200);
    expect(engine.getTotalCost()).toBe(1000);
  });

  it('returns costs by category', () => {
    const engine = new FinOpsEngine();
    engine.trackCost('compute', 500);
    engine.trackCost('storage', 300);
    engine.trackCost('compute', 200);
    expect(engine.getCostByCategory()).toEqual({
      compute: 700,
      storage: 300,
    });
  });

  it('triggers alerts at 50% threshold', () => {
    const { engine } = createEngine();
    const bgt = engine.getBudget('bgt-001')!;
    bgt.spent = 5000;
    engine.setBudget(bgt);
    const alerts = engine.checkBudgetAlerts('bgt-001');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toContain('50%');
  });

  it('triggers alerts at multiple thresholds sequentially', () => {
    const { engine } = createEngine();

    const bgt50: Budget = {
      id: 'bgt-multi',
      name: 'Multi',
      amount: 1000,
      period: 'monthly',
      spent: 500,
      alerts: [50, 80, 90, 100],
      notified: [],
    };
    engine.setBudget(bgt50);
    let alerts = engine.checkBudgetAlerts('bgt-multi');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toContain('50%');

    const bgt80: Budget = {
      id: 'bgt-multi',
      name: 'Multi',
      amount: 1000,
      period: 'monthly',
      spent: 800,
      alerts: [50, 80, 90, 100],
      notified: [50],
    };
    engine.setBudget(bgt80);
    alerts = engine.checkBudgetAlerts('bgt-multi');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toContain('80%');
  });

  it('does not re-trigger already notified thresholds', () => {
    const { engine } = createEngine();
    const bgt: Budget = {
      id: 'bgt-no-repeat',
      name: 'NoRepeat',
      amount: 1000,
      period: 'monthly',
      spent: 900,
      alerts: [50, 80, 90],
      notified: [50, 80],
    };
    engine.setBudget(bgt);
    const alerts = engine.checkBudgetAlerts('bgt-no-repeat');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toContain('90%');
  });

  it('returns no alerts when under all thresholds', () => {
    const { engine } = createEngine();
    const bgt: Budget = {
      id: 'bgt-safe',
      name: 'Safe',
      amount: 1000,
      period: 'monthly',
      spent: 100,
      alerts: [50, 80, 90],
      notified: [],
    };
    engine.setBudget(bgt);
    expect(engine.checkBudgetAlerts('bgt-safe')).toEqual([]);
  });

  it('allocates cost to a team and retrieves chargeback', () => {
    const engine = new FinOpsEngine();
    engine.allocateCost('platform-team', 'Kubernetes', 2500, [
      { type: 'compute', cost: 1500 },
      { type: 'network', cost: 1000 },
    ]);

    const chargebacks = engine.getChargeback('platform-team');
    expect(chargebacks).toHaveLength(1);
    expect(chargebacks[0].team).toBe('platform-team');
    expect(chargebacks[0].project).toBe('Kubernetes');
    expect(chargebacks[0].amount).toBe(2500);
    expect(chargebacks[0].resources).toHaveLength(2);
  });

  it('returns all chargebacks when no team filter', () => {
    const engine = new FinOpsEngine();
    engine.allocateCost('team-a', 'Project A', 1000);
    engine.allocateCost('team-b', 'Project B', 2000);
    expect(engine.getChargeback()).toHaveLength(2);
  });

  it('returns optimization recommendations', () => {
    const engine = new FinOpsEngine();
    const recommendations = engine.optimize();
    expect(recommendations).toHaveLength(3);
    expect(recommendations[0]).toHaveProperty('resourceId');
    expect(recommendations[0]).toHaveProperty('currentCost');
    expect(recommendations[0]).toHaveProperty('projectedCost');
    expect(recommendations[0]).toHaveProperty('savings');
    expect(recommendations[0]).toHaveProperty('recommendation');
    expect(recommendations[0]).toHaveProperty('effort');
    expect(recommendations[0].savings).toBeGreaterThan(0);
  });

  it('forecasts cost projection for given months', () => {
    const engine = new FinOpsEngine();
    engine.trackCost('compute', 3000);
    const forecast = engine.forecast(3);
    expect(forecast).toHaveLength(3);
    for (const entry of forecast) {
      expect(entry).toHaveProperty('month');
      expect(entry).toHaveProperty('projected');
      expect(entry.projected).toBeGreaterThan(0);
    }
    // Each subsequent month should have growth
    expect(forecast[1].projected).toBeGreaterThanOrEqual(forecast[0].projected);
  });

  it('forecast returns entries with correct month format', () => {
    const engine = new FinOpsEngine();
    const forecast = engine.forecast(2);
    for (const entry of forecast) {
      expect(entry.month).toMatch(/^\d{4}-\d{2}$/);
    }
  });

  it('handles cost with metadata', () => {
    const engine = new FinOpsEngine();
    engine.trackCost('compute', 500, { region: 'us-east-1', env: 'prod' });
    expect(engine.getTotalCost()).toBe(500);
    expect(engine.getCostByCategory()).toEqual({ compute: 500 });
  });
});
