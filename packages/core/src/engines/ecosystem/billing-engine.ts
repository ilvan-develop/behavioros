/**
 * PricingModel — Union type: flat, per-unit, tiered, mixed;.
 */
export type PricingModel = 'flat' | 'per-unit' | 'tiered' | 'mixed';

/**
 * PricingPlan — Configuration and options interface.
 */
export interface PricingPlan {
  id: string;
  name: string;
  model: PricingModel;
  flatFee?: number;
  unitPrice?: number;
  tiers?: { from: number; to?: number; unitPrice: number }[];
  billingPeriod: 'monthly' | 'annual';
  includedUnits?: Record<string, number>;
}

/**
 * UsageRecord — Configuration and options interface.
 */
export interface UsageRecord {
  tenantId: string;
  resource: string;
  quantity: number;
  timestamp: string;
}

/**
 * Invoice — Configuration and options interface.
 */
export interface Invoice {
  id: string;
  tenantId: string;
  planId: string;
  period: { start: string; end: string };
  items: { description: string; quantity: number; unitPrice: number; total: number }[];
  subtotal: number;
  discounts: number;
  total: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  dueDate: string;
  createdAt: string;
}

/**
 * BillingEngine — billing engine.
 *
 * Methods: createPlan, getPlan, assignPlan, recordUsage, getUsage, generateInvoice, markPaid, getOutstanding, +1 more.
 */
export class BillingEngine {
  private plans = new Map<string, PricingPlan>();
  private tenantPlans = new Map<string, string>();
  private usageRecords = new Map<string, UsageRecord[]>();
  private invoices = new Map<string, Invoice>();
  private nextPlanId = 1;

  createPlan(plan: Omit<PricingPlan, 'id'>): PricingPlan {
    const id = `plan_${this.nextPlanId++}`;
    const full: PricingPlan = { id, ...plan };
    this.plans.set(id, full);
    return full;
  }

  getPlan(id: string): PricingPlan | undefined {
    return this.plans.get(id);
  }

  assignPlan(tenantId: string, planId: string): void {
    if (!this.plans.has(planId)) {
      throw new Error(`Plan ${planId} not found`);
    }
    this.tenantPlans.set(tenantId, planId);
  }

  recordUsage(tenantId: string, resource: string, quantity: number): void {
    const key = this.usageKey(tenantId);
    const records = this.usageRecords.get(key) ?? [];
    records.push({
      tenantId,
      resource,
      quantity,
      timestamp: new Date().toISOString(),
    });
    this.usageRecords.set(key, records);
  }

  getUsage(tenantId: string, since?: string, until?: string): UsageRecord[] {
    const key = this.usageKey(tenantId);
    const records = this.usageRecords.get(key) ?? [];
    if (!since && !until) return [...records];
    return records.filter((r) => {
      if (since && r.timestamp < since) return false;
      if (until && r.timestamp > until) return false;
      return true;
    });
  }

  generateInvoice(tenantId: string, period: { start: string; end: string }): Invoice {
    const planId = this.tenantPlans.get(tenantId);
    if (!planId) throw new Error(`No plan assigned for tenant ${tenantId}`);
    const plan = this.plans.get(planId);
    if (!plan) throw new Error(`Plan ${planId} not found`);

    const usage = this.getUsage(tenantId);
    const _totalCost = this.calculateCost(tenantId, usage);

    const invoiceId = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const items: Invoice['items'] = [];

    if (plan.model === 'flat') {
      items.push({
        description: `${plan.name} — ${plan.billingPeriod} flat fee`,
        quantity: 1,
        unitPrice: plan.flatFee ?? 0,
        total: plan.flatFee ?? 0,
      });
    } else if (plan.model === 'per-unit') {
      const includedUnits = plan.includedUnits ?? {};
      const usageByResource = this.aggregateUsage(usage);
      for (const [resource, qty] of Object.entries(usageByResource)) {
        const free = includedUnits[resource] ?? 0;
        const billable = Math.max(0, qty - free);
        if (billable > 0) {
          items.push({
            description: `${resource} @ ${plan.unitPrice}/unit`,
            quantity: billable,
            unitPrice: plan.unitPrice ?? 0,
            total: billable * (plan.unitPrice ?? 0),
          });
        }
      }
      if (items.length === 0) {
        items.push({
          description: `${plan.name} — no overage`,
          quantity: 0,
          unitPrice: 0,
          total: 0,
        });
      }
    } else if (plan.model === 'tiered') {
      const usageByResource = this.aggregateUsage(usage);
      for (const [resource, qty] of Object.entries(usageByResource)) {
        const tiers = (plan.tiers ?? []).sort((a, b) => a.from - b.from);
        let remaining = qty;
        let tierTotal = 0;
        for (const tier of tiers) {
          if (remaining <= 0) break;
          const tierQty =
            tier.to !== undefined ? Math.min(remaining, tier.to - tier.from) : remaining;
          tierTotal += tierQty * tier.unitPrice;
          remaining -= tierQty;
        }
        items.push({
          description: `${resource} (tiered)`,
          quantity: qty,
          unitPrice: qty > 0 ? Math.round((tierTotal / qty) * 100) / 100 : 0,
          total: tierTotal,
        });
      }
    } else if (plan.model === 'mixed') {
      if (plan.flatFee) {
        items.push({
          description: `${plan.name} — base fee`,
          quantity: 1,
          unitPrice: plan.flatFee,
          total: plan.flatFee,
        });
      }
      const includedUnits = plan.includedUnits ?? {};
      const usageByResource = this.aggregateUsage(usage);
      for (const [resource, qty] of Object.entries(usageByResource)) {
        const free = includedUnits[resource] ?? 0;
        const billable = Math.max(0, qty - free);
        if (billable > 0) {
          items.push({
            description: `${resource} overage @ ${plan.unitPrice}/unit`,
            quantity: billable,
            unitPrice: plan.unitPrice ?? 0,
            total: billable * (plan.unitPrice ?? 0),
          });
        }
      }
    }

    const subtotal = items.reduce((s, i) => s + i.total, 0);
    const dueDate = new Date(period.end);
    dueDate.setDate(dueDate.getDate() + 30);

    const invoice: Invoice = {
      id: invoiceId,
      tenantId,
      planId,
      period,
      items,
      subtotal,
      discounts: 0,
      total: subtotal,
      status: 'draft',
      dueDate: dueDate.toISOString(),
      createdAt: new Date().toISOString(),
    };

    this.invoices.set(invoiceId, invoice);
    return invoice;
  }

  markPaid(invoiceId: string): void {
    const inv = this.invoices.get(invoiceId);
    if (!inv) throw new Error(`Invoice ${invoiceId} not found`);
    inv.status = 'paid';
  }

  getOutstanding(tenantId: string): Invoice[] {
    const result: Invoice[] = [];
    for (const inv of this.invoices.values()) {
      if (inv.tenantId === tenantId && inv.status !== 'paid') {
        result.push(inv);
      }
    }
    return result;
  }

  calculateCost(tenantId: string, usage: UsageRecord[]): number {
    const planId = this.tenantPlans.get(tenantId);
    if (!planId) throw new Error(`No plan assigned for tenant ${tenantId}`);
    const plan = this.plans.get(planId);
    if (!plan) throw new Error(`Plan ${planId} not found`);

    const usageByResource = this.aggregateUsage(usage);
    const includedUnits = plan.includedUnits ?? {};
    let total = 0;

    if (plan.model === 'flat') {
      total = plan.flatFee ?? 0;
    } else if (plan.model === 'per-unit') {
      for (const [resource, qty] of Object.entries(usageByResource)) {
        const free = includedUnits[resource] ?? 0;
        const billable = Math.max(0, qty - free);
        total += billable * (plan.unitPrice ?? 0);
      }
    } else if (plan.model === 'tiered') {
      const tiers = (plan.tiers ?? []).sort((a, b) => a.from - b.from);
      for (const qty of Object.values(usageByResource)) {
        let remaining = qty;
        for (const tier of tiers) {
          if (remaining <= 0) break;
          const tierQty =
            tier.to !== undefined ? Math.min(remaining, tier.to - tier.from) : remaining;
          total += tierQty * tier.unitPrice;
          remaining -= tierQty;
        }
      }
    } else if (plan.model === 'mixed') {
      total += plan.flatFee ?? 0;
      for (const [resource, qty] of Object.entries(usageByResource)) {
        const free = includedUnits[resource] ?? 0;
        const billable = Math.max(0, qty - free);
        total += billable * (plan.unitPrice ?? 0);
      }
    }

    return total;
  }

  private usageKey(tenantId: string): string {
    return `usage:${tenantId}`;
  }

  private aggregateUsage(usage: UsageRecord[]): Record<string, number> {
    const aggregated: Record<string, number> = {};
    for (const r of usage) {
      aggregated[r.resource] = (aggregated[r.resource] ?? 0) + r.quantity;
    }
    return aggregated;
  }
}
