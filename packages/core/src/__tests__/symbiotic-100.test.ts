import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentBoundary } from '../domain/boundaries/agent-boundary';
import type { BoundaryResult } from '../domain/boundaries/boundary.interface';
import { DNABoundary } from '../domain/boundaries/dna-boundary';
import { AgentContext } from '../domain/contexts/agent-context';
import { DNAContext } from '../domain/contexts/dna-context';
import { ShopifyAdapter } from '../engines/adapters/shopify-adapter';

// ============================================================
// AGENT-CONTEXT (60 lines, 48.64% target → 100%)
// ============================================================

describe('AgentContext', () => {
  describe('constructor', () => {
    it('should create with agentId and authority', () => {
      const ctx = new AgentContext('agent-1', 'architect');
      expect(ctx.getAgentId()).toBe('agent-1');
      expect(ctx.getAuthority()).toBe('architect');
      expect(ctx.getBoundaries()).toEqual([]);
    });
  });

  describe('addBoundary', () => {
    it('should add a boundary', () => {
      const ctx = new AgentContext('agent-1', 'architect');
      const boundary = new AgentBoundary('agent-1', 'junior');
      ctx.addBoundary(boundary);
      expect(ctx.getBoundaries()).toHaveLength(1);
      expect(ctx.getBoundaries()[0].getAgentId()).toBe('agent-1');
    });

    it('should add multiple boundaries', () => {
      const ctx = new AgentContext('agent-1', 'architect');
      ctx.addBoundary(new AgentBoundary('agent-1', 'junior'));
      ctx.addBoundary(new AgentBoundary('agent-1', 'senior'));
      expect(ctx.getBoundaries()).toHaveLength(2);
    });
  });

  describe('validateAction', () => {
    it('should pass with no boundaries and valid action', () => {
      const ctx = new AgentContext('agent-1', 'architect');
      const result = ctx.validateAction('read', {});
      expect(result.passed).toBe(true);
      expect(result.boundaryResults).toEqual([]);
    });

    it('should pass with matching boundary and valid action', () => {
      const ctx = new AgentContext('agent-1', 'architect');
      ctx.addBoundary(new AgentBoundary('agent-1', 'junior'));
      const result = ctx.validateAction('read', {});
      expect(result.passed).toBe(true);
    });

    it('should fail when ACL blocks the action', () => {
      const ctx = new AgentContext('agent-1', 'architect');
      const result = ctx.validateAction('invalid-action', {});
      expect(result.passed).toBe(false);
      expect(result.aclResult.passed).toBe(false);
      expect(result.aclResult.reason).toContain('not in the allowlist');
    });

    it('should fail when ACL detects malicious payload', () => {
      const ctx = new AgentContext('agent-1', 'architect');
      const result = ctx.validateAction('read', { query: 'DROP TABLE' });
      expect(result.passed).toBe(false);
      expect(result.aclResult.passed).toBe(false);
      expect(result.aclResult.reason).toContain('Malicious patterns');
    });

    it('should fail when boundary validation fails', () => {
      const ctx = new AgentContext('agent-1', 'junior');
      ctx.addBoundary(new AgentBoundary('agent-1', 'architect'));
      const result = ctx.validateAction('read', {});
      expect(result.passed).toBe(false);
      expect(result.boundaryResults.some((r: BoundaryResult) => !r.passed)).toBe(true);
    });

    it('should fail when agentId does not match boundary', () => {
      const ctx = new AgentContext('agent-1', 'architect');
      ctx.addBoundary(new AgentBoundary('agent-2', 'junior'));
      const result = ctx.validateAction('read', {});
      expect(result.passed).toBe(false);
      expect(result.boundaryResults[0].reason).toContain('Agent mismatch');
    });

    it('should fail with empty agentId (ACL rejects)', () => {
      const ctx = new AgentContext('', 'architect');
      const result = ctx.validateAction('read', {});
      expect(result.passed).toBe(false);
    });

    it('should fail with empty action (ACL rejects)', () => {
      const ctx = new AgentContext('agent-1', 'architect');
      const result = ctx.validateAction('', {});
      expect(result.passed).toBe(false);
    });
  });

  describe('getters', () => {
    it('should return immutable boundaries copy', () => {
      const ctx = new AgentContext('agent-1', 'architect');
      ctx.addBoundary(new AgentBoundary('agent-1', 'junior'));
      const boundaries = ctx.getBoundaries();
      boundaries.push(new AgentBoundary('agent-2', 'senior'));
      expect(ctx.getBoundaries()).toHaveLength(1);
    });
  });
});

// ============================================================
// DNA-CONTEXT (49 lines, 44.44% target → 100%)
// ============================================================

describe('DNAContext', () => {
  describe('constructor', () => {
    it('should create with dnaId', () => {
      const ctx = new DNAContext('payments-dna');
      expect(ctx.getDnaId()).toBe('payments-dna');
      expect(ctx.getBoundaries()).toEqual([]);
    });
  });

  describe('addBoundary', () => {
    it('should add a boundary', () => {
      const ctx = new DNAContext('payments-dna');
      const boundary = new DNABoundary('payments-dna', ['read', 'write']);
      ctx.addBoundary(boundary);
      expect(ctx.getBoundaries()).toHaveLength(1);
      expect(ctx.getBoundaries()[0].getDnaId()).toBe('payments-dna');
    });

    it('should add multiple boundaries', () => {
      const ctx = new DNAContext('payments-dna');
      ctx.addBoundary(new DNABoundary('payments-dna', ['read']));
      ctx.addBoundary(new DNABoundary('payments-dna', ['write']));
      expect(ctx.getBoundaries()).toHaveLength(2);
    });
  });

  describe('validateAction', () => {
    it('should pass with no boundaries and valid action', () => {
      const ctx = new DNAContext('payments-dna');
      const result = ctx.validateAction('read', 'agent-1', {});
      expect(result.passed).toBe(true);
      expect(result.boundaryResults).toEqual([]);
    });

    it('should pass with matching boundary and valid action', () => {
      const ctx = new DNAContext('payments-dna');
      ctx.addBoundary(new DNABoundary('payments-dna', ['deploy']));
      const result = ctx.validateAction('deploy', 'agent-1', {});
      expect(result.passed).toBe(true);
    });

    it('should fail when ACL blocks the action', () => {
      const ctx = new DNAContext('payments-dna');
      const result = ctx.validateAction('invalid-action', 'agent-1', {});
      expect(result.passed).toBe(false);
      expect(result.aclResult.passed).toBe(false);
    });

    it('should fail when ACL detects malicious payload', () => {
      const ctx = new DNAContext('payments-dna');
      const result = ctx.validateAction('read', 'agent-1', { query: 'EXEC xp_cmdshell' });
      expect(result.passed).toBe(false);
      expect(result.aclResult.passed).toBe(false);
      expect(result.aclResult.reason).toContain('Malicious patterns');
    });

    it('should fail when boundary DNA does not match', () => {
      const ctx = new DNAContext('payments-dna');
      ctx.addBoundary(new DNABoundary('other-dna', ['read']));
      const result = ctx.validateAction('read', 'agent-1', {});
      expect(result.passed).toBe(false);
      expect(result.boundaryResults[0].reason).toContain('DNA mismatch');
    });

    it('should fail when action is not allowed in DNA boundary', () => {
      const ctx = new DNAContext('payments-dna');
      ctx.addBoundary(new DNABoundary('payments-dna', ['deploy']));
      const result = ctx.validateAction('delete', 'agent-1', {});
      expect(result.passed).toBe(false);
      expect(result.boundaryResults[0].reason).toContain("Action 'delete' not allowed");
    });

    it('should fail with empty agentId (ACL rejects)', () => {
      const ctx = new DNAContext('payments-dna');
      const result = ctx.validateAction('read', '', {});
      expect(result.passed).toBe(false);
    });

    it('should fail with empty action (ACL rejects)', () => {
      const ctx = new DNAContext('payments-dna');
      const result = ctx.validateAction('', 'agent-1', {});
      expect(result.passed).toBe(false);
    });
  });

  describe('getters', () => {
    it('should return immutable boundaries copy', () => {
      const ctx = new DNAContext('payments-dna');
      ctx.addBoundary(new DNABoundary('payments-dna', ['read']));
      const boundaries = ctx.getBoundaries();
      boundaries.push(new DNABoundary('other-dna', ['write']));
      expect(ctx.getBoundaries()).toHaveLength(1);
    });
  });
});

// ============================================================
// SHOPIFY-ADAPTER (182 lines, 7.27% target → 100%)
// ============================================================

describe('ShopifyAdapter', () => {
  let adapter: ShopifyAdapter;
  const mockFetch = vi.fn();

  const mockOrder = {
    id: 'gid://shopify/Order/123',
    orderNumber: 1001,
    email: 'test@example.com',
    currency: 'USD',
    totalPrice: '99.99',
    createdAt: '2024-01-15T10:00:00Z',
    lineItems: [{ title: 'Widget', quantity: 1, price: '99.99' }],
    status: 'active',
  };

  const mockOrder2 = {
    id: 'gid://shopify/Order/456',
    orderNumber: 1002,
    email: 'other@example.com',
    currency: 'USD',
    totalPrice: '49.99',
    createdAt: '2024-01-16T12:00:00Z',
    lineItems: [{ title: 'Gadget', quantity: 2, price: '24.99' }],
    status: 'active',
  };

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    adapter = new ShopifyAdapter('test-store.myshopify.com', 'test-token');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    mockFetch.mockReset();
  });

  // ── createOrder ──────────────────────────────────────────

  describe('createOrder', () => {
    it('should create an order successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ order: mockOrder }),
      });

      const result = await adapter.createOrder({
        email: 'test@example.com',
        lineItems: [{ title: 'Widget', quantity: 1, price: '99.99' }],
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockOrder);
    });

    it('should fail on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network failure'));

      const result = await adapter.createOrder({
        email: 'test@example.com',
        lineItems: [{ title: 'Widget', quantity: 1, price: '99.99' }],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network failure');
    });

    it('should fail on timeout', async () => {
      mockFetch.mockRejectedValueOnce(new Error('The operation was aborted'));

      const result = await adapter.createOrder({
        email: 'test@example.com',
        lineItems: [{ title: 'Widget', quantity: 1, price: '99.99' }],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('aborted');
    });

    it('should fail on invalid response (non-ok status)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        text: async () => 'Unprocessable Entity',
      });

      const result = await adapter.createOrder({
        email: 'test@example.com',
        lineItems: [],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('422');
      expect(result.error).toContain('Unprocessable Entity');
    });

    it('should handle non-Error rejection', async () => {
      mockFetch.mockRejectedValueOnce('string error');

      const result = await adapter.createOrder({
        email: 'test@example.com',
        lineItems: [],
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('string error');
    });
  });

  // ── getOrder ─────────────────────────────────────────────

  describe('getOrder', () => {
    it('should return order when found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ order: mockOrder }),
      });

      const result = await adapter.getOrder('123');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockOrder);
    });

    it('should return not found on 404', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 404,
        ok: false,
        text: async () => 'Not Found',
      });

      const result = await adapter.getOrder('999');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
      expect(result.error).toContain('999');
    });

    it('should fail on server error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      const result = await adapter.getOrder('123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('500');
    });

    it('should fail on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network failure'));

      const result = await adapter.getOrder('123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network failure');
    });
  });

  // ── listOrders ───────────────────────────────────────────

  describe('listOrders', () => {
    it('should return empty orders list', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ orders: [] }),
        headers: new Headers(),
      });

      const result = await adapter.listOrders();

      expect(result.success).toBe(true);
      expect(result.data!.orders).toEqual([]);
      expect(result.data!.nextPage).toBeUndefined();
    });

    it('should return paginated orders with next page', async () => {
      const linkHeader = '<https://.../orders.json?page=2>; rel="next"';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ orders: [mockOrder, mockOrder2] }),
        headers: new Headers({ Link: linkHeader }),
      });

      const result = await adapter.listOrders(1, 2);

      expect(result.success).toBe(true);
      expect(result.data!.orders).toHaveLength(2);
      expect(result.data!.nextPage).toBe('2');
    });

    it('should fail on server error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'Too Many Requests',
      });

      const result = await adapter.listOrders();

      expect(result.success).toBe(false);
      expect(result.error).toContain('429');
    });

    it('should fail on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network failure'));

      const result = await adapter.listOrders();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network failure');
    });
  });

  // ── cancelOrder ──────────────────────────────────────────

  describe('cancelOrder', () => {
    it('should cancel an active order successfully', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ order: { ...mockOrder, status: 'active' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ order: { ...mockOrder, status: 'cancelled' } }),
        });

      const result = await adapter.cancelOrder('123');

      expect(result.success).toBe(true);
      expect(result.data!.status).toBe('cancelled');
    });

    it('should fail if order is already cancelled', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ order: { ...mockOrder, status: 'cancelled' } }),
      });

      const result = await adapter.cancelOrder('123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('already cancelled');
      expect(result.error).toContain('123');
    });

    it('should fail if order is not found', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 404,
        ok: false,
        text: async () => 'Not Found',
      });

      const result = await adapter.cancelOrder('999');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should fail on cancel API error', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ order: { ...mockOrder, status: 'active' } }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          text: async () => 'Service Unavailable',
        });

      const result = await adapter.cancelOrder('123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('503');
    });

    it('should fail on network error during cancel', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ order: { ...mockOrder, status: 'active' } }),
        })
        .mockRejectedValueOnce(new Error('Network failure'));

      const result = await adapter.cancelOrder('123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network failure');
    });
  });
});
