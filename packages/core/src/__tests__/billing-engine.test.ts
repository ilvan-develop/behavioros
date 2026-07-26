import { beforeEach, describe, expect, it } from 'vitest';
import { BillingEngine } from '../engines/ecosystem/billing-engine';

describe('BillingEngine', () => {
  let engine: BillingEngine;

  beforeEach(() => {
    engine = new BillingEngine();
  });

  describe('createPlan / getPlan', () => {
    it('should create a flat fee plan and retrieve it', () => {
      const plan = engine.createPlan({
        name: 'Basic',
        model: 'flat',
        flatFee: 99,
        billingPeriod: 'monthly',
      });
      expect(plan.id).toMatch(/^plan_\d+$/);
      expect(plan.name).toBe('Basic');
      expect(plan.flatFee).toBe(99);
      const retrieved = engine.getPlan(plan.id);
      expect(retrieved).toEqual(plan);
    });

    it('should create a per-unit plan with included units', () => {
      const plan = engine.createPlan({
        name: 'API Pro',
        model: 'per-unit',
        unitPrice: 0.05,
        billingPeriod: 'monthly',
        includedUnits: { api_calls: 10000 },
      });
      expect(plan.model).toBe('per-unit');
      expect(plan.unitPrice).toBe(0.05);
      expect(plan.includedUnits?.api_calls).toBe(10000);
    });

    it('should create a tiered pricing plan', () => {
      const plan = engine.createPlan({
        name: 'Storage',
        model: 'tiered',
        billingPeriod: 'monthly',
        tiers: [
          { from: 0, to: 100, unitPrice: 0.1 },
          { from: 101, to: 1000, unitPrice: 0.08 },
          { from: 1001, unitPrice: 0.05 },
        ],
      });
      expect(plan.model).toBe('tiered');
      expect(plan.tiers).toHaveLength(3);
    });

    it('should return undefined for unknown plan', () => {
      expect(engine.getPlan('nonexistent')).toBeUndefined();
    });
  });

  describe('assignPlan', () => {
    it('should assign a plan to a tenant', () => {
      const plan = engine.createPlan({
        name: 'Basic',
        model: 'flat',
        flatFee: 99,
        billingPeriod: 'monthly',
      });
      engine.assignPlan('tenant-1', plan.id);
    });

    it('should throw when assigning an unknown plan', () => {
      expect(() => engine.assignPlan('tenant-1', 'plan_unknown')).toThrow(
        'Plan plan_unknown not found',
      );
    });
  });

  describe('recordUsage / getUsage', () => {
    it('should record and retrieve usage records', () => {
      engine.recordUsage('tenant-1', 'api_calls', 500);
      engine.recordUsage('tenant-1', 'api_calls', 300);
      const usage = engine.getUsage('tenant-1');
      expect(usage).toHaveLength(2);
      expect(usage[0].quantity).toBe(500);
      expect(usage[1].quantity).toBe(300);
    });

    it('should return empty array for tenant with no usage', () => {
      expect(engine.getUsage('unknown')).toEqual([]);
    });

    it('should filter usage by time range', () => {
      engine.recordUsage('tenant-1', 'api_calls', 100);
      const filtered = engine.getUsage('tenant-1', '2099-01-01', '2099-12-31');
      expect(filtered).toHaveLength(0);
    });
  });

  describe('generateInvoice — flat model', () => {
    it('should generate an invoice with flat fee', () => {
      const plan = engine.createPlan({
        name: 'Basic',
        model: 'flat',
        flatFee: 99,
        billingPeriod: 'monthly',
      });
      engine.assignPlan('tenant-1', plan.id);
      const invoice = engine.generateInvoice('tenant-1', {
        start: '2026-01-01',
        end: '2026-01-31',
      });
      expect(invoice.planId).toBe(plan.id);
      expect(invoice.items).toHaveLength(1);
      expect(invoice.items[0].total).toBe(99);
      expect(invoice.subtotal).toBe(99);
      expect(invoice.total).toBe(99);
      expect(invoice.status).toBe('draft');
      expect(invoice.dueDate).toBeDefined();
    });

    it('should throw for tenant with no plan', () => {
      expect(() =>
        engine.generateInvoice('tenant-1', { start: '2026-01-01', end: '2026-01-31' }),
      ).toThrow('No plan assigned for tenant tenant-1');
    });
  });

  describe('generateInvoice — per-unit model', () => {
    it('should bill overage beyond included units', () => {
      const plan = engine.createPlan({
        name: 'API Pro',
        model: 'per-unit',
        unitPrice: 0.05,
        billingPeriod: 'monthly',
        includedUnits: { api_calls: 1000 },
      });
      engine.assignPlan('tenant-1', plan.id);
      engine.recordUsage('tenant-1', 'api_calls', 1500);
      const invoice = engine.generateInvoice('tenant-1', {
        start: '2026-01-01',
        end: '2026-01-31',
      });
      expect(invoice.items).toHaveLength(1);
      expect(invoice.items[0].quantity).toBe(500);
      expect(invoice.items[0].unitPrice).toBe(0.05);
      expect(invoice.items[0].total).toBe(25);
      expect(invoice.total).toBe(25);
    });

    it('should generate zero-cost invoice when usage within included units', () => {
      const plan = engine.createPlan({
        name: 'API Pro',
        model: 'per-unit',
        unitPrice: 0.05,
        billingPeriod: 'monthly',
        includedUnits: { api_calls: 2000 },
      });
      engine.assignPlan('tenant-1', plan.id);
      engine.recordUsage('tenant-1', 'api_calls', 500);
      const invoice = engine.generateInvoice('tenant-1', {
        start: '2026-01-01',
        end: '2026-01-31',
      });
      expect(invoice.total).toBe(0);
    });
  });

  describe('generateInvoice — tiered model', () => {
    it('should calculate tiered pricing correctly', () => {
      const plan = engine.createPlan({
        name: 'Storage',
        model: 'tiered',
        billingPeriod: 'monthly',
        tiers: [
          { from: 0, to: 100, unitPrice: 0.1 },
          { from: 100, to: 1000, unitPrice: 0.08 },
          { from: 1000, unitPrice: 0.05 },
        ],
      });
      engine.assignPlan('tenant-1', plan.id);
      engine.recordUsage('tenant-1', 'storage_gb', 500);
      const invoice = engine.generateInvoice('tenant-1', {
        start: '2026-01-01',
        end: '2026-01-31',
      });
      // Tier 1: 100 * 0.10 = 10, Tier 2: 400 * 0.08 = 32 — total 42
      expect(invoice.items[0].total).toBe(42);
      expect(invoice.total).toBe(42);
    });

    it('should handle usage that spans all tiers', () => {
      const plan = engine.createPlan({
        name: 'Storage',
        model: 'tiered',
        billingPeriod: 'monthly',
        tiers: [
          { from: 0, to: 100, unitPrice: 0.1 },
          { from: 100, to: 1000, unitPrice: 0.08 },
          { from: 1000, unitPrice: 0.05 },
        ],
      });
      engine.assignPlan('tenant-1', plan.id);
      engine.recordUsage('tenant-1', 'storage_gb', 2000);
      const invoice = engine.generateInvoice('tenant-1', {
        start: '2026-01-01',
        end: '2026-01-31',
      });
      // 100*0.10 + 900*0.08 + 1000*0.05 = 10 + 72 + 50 = 132
      expect(invoice.total).toBe(132);
    });
  });

  describe('generateInvoice — mixed model', () => {
    it('should include flat fee plus overage', () => {
      const plan = engine.createPlan({
        name: 'Mixed',
        model: 'mixed',
        flatFee: 50,
        unitPrice: 0.1,
        billingPeriod: 'monthly',
        includedUnits: { calls: 500 },
      });
      engine.assignPlan('tenant-1', plan.id);
      engine.recordUsage('tenant-1', 'calls', 1200);
      const invoice = engine.generateInvoice('tenant-1', {
        start: '2026-01-01',
        end: '2026-01-31',
      });
      expect(invoice.items).toHaveLength(2);
      // Base fee: 50, overage: 700 * 0.10 = 70 — total 120
      expect(invoice.total).toBe(120);
    });
  });

  describe('markPaid / getOutstanding', () => {
    it('should mark an invoice as paid', () => {
      const plan = engine.createPlan({
        name: 'Basic',
        model: 'flat',
        flatFee: 99,
        billingPeriod: 'monthly',
      });
      engine.assignPlan('tenant-1', plan.id);
      const invoice = engine.generateInvoice('tenant-1', {
        start: '2026-01-01',
        end: '2026-01-31',
      });
      engine.markPaid(invoice.id);
      expect(invoice.status).toBe('paid');
    });

    it('should throw when marking unknown invoice', () => {
      expect(() => engine.markPaid('inv_unknown')).toThrow('Invoice inv_unknown not found');
    });

    it('should return unpaid invoices for a tenant', () => {
      const plan = engine.createPlan({
        name: 'Basic',
        model: 'flat',
        flatFee: 99,
        billingPeriod: 'monthly',
      });
      engine.assignPlan('tenant-1', plan.id);
      const inv1 = engine.generateInvoice('tenant-1', {
        start: '2026-01-01',
        end: '2026-01-31',
      });
      const inv2 = engine.generateInvoice('tenant-1', {
        start: '2026-02-01',
        end: '2026-02-28',
      });
      engine.markPaid(inv1.id);
      const outstanding = engine.getOutstanding('tenant-1');
      expect(outstanding).toHaveLength(1);
      expect(outstanding[0].id).toBe(inv2.id);
    });

    it('should return empty list when no outstanding invoices', () => {
      expect(engine.getOutstanding('tenant-1')).toEqual([]);
    });
  });

  describe('calculateCost', () => {
    it('should calculate flat cost', () => {
      const plan = engine.createPlan({
        name: 'Basic',
        model: 'flat',
        flatFee: 99,
        billingPeriod: 'monthly',
      });
      engine.assignPlan('tenant-1', plan.id);
      const cost = engine.calculateCost('tenant-1', []);
      expect(cost).toBe(99);
    });

    it('should calculate per-unit cost with included units deducted', () => {
      const plan = engine.createPlan({
        name: 'API Pro',
        model: 'per-unit',
        unitPrice: 0.05,
        billingPeriod: 'monthly',
        includedUnits: { api_calls: 1000 },
      });
      engine.assignPlan('tenant-1', plan.id);
      const usage = [
        { tenantId: 'tenant-1', resource: 'api_calls', quantity: 3000, timestamp: '2026-01-15' },
      ];
      const cost = engine.calculateCost('tenant-1', usage);
      expect(cost).toBe(100); // 2000 * 0.05
    });

    it('should calculate tiered cost', () => {
      const plan = engine.createPlan({
        name: 'Storage',
        model: 'tiered',
        billingPeriod: 'monthly',
        tiers: [
          { from: 0, to: 100, unitPrice: 0.1 },
          { from: 100, unitPrice: 0.05 },
        ],
      });
      engine.assignPlan('tenant-1', plan.id);
      const usage = [
        { tenantId: 'tenant-1', resource: 'storage_gb', quantity: 300, timestamp: '2026-01-15' },
      ];
      const cost = engine.calculateCost('tenant-1', usage);
      expect(cost).toBeCloseTo(20, 10); // 100*0.10 + 200*0.05
    });

    it('should calculate mixed cost with fee plus overage', () => {
      const plan = engine.createPlan({
        name: 'Mixed',
        model: 'mixed',
        flatFee: 50,
        unitPrice: 0.1,
        billingPeriod: 'monthly',
        includedUnits: { calls: 500 },
      });
      engine.assignPlan('tenant-1', plan.id);
      const usage = [
        { tenantId: 'tenant-1', resource: 'calls', quantity: 1500, timestamp: '2026-01-15' },
      ];
      const cost = engine.calculateCost('tenant-1', usage);
      expect(cost).toBe(150); // 50 + 1000*0.10
    });

    it('should throw for tenant with no plan', () => {
      expect(() => engine.calculateCost('tenant-1', [])).toThrow(
        'No plan assigned for tenant tenant-1',
      );
    });
  });
});
