import { describe, test, expect } from 'vitest';

const BASE_URL = 'http://localhost:3001';

// NOTE: These tests require a running Next.js server on port 3001.
// Originally auto-started via Playwright's webServer config (playwright.config.ts).
// To run: start the server first with `pnpm --filter @behavioros/web dev`, then run these tests.
// Skipped by default in Vitest since no server is auto-started.
describe.skip('Ecosystem Pages', () => {
  describe('API Routes', () => {
    test('GET /api/ecosystem returns ecosystem status', async () => {
      const response = await fetch(`${BASE_URL}/api/ecosystem`);
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data).toBeDefined();
      expect(typeof data.totalSkills).toBe('number');
      expect(typeof data.totalMCPs).toBe('number');
      expect(typeof data.activeAgents).toBe('number');
      expect(Array.isArray(data.skills)).toBe(true);
      expect(Array.isArray(data.mcps)).toBe(true);
      expect(Array.isArray(data.designSystems)).toBe(true);
    });

    test('GET /api/ecosystem/skills returns skills list', async () => {
      const response = await fetch(`${BASE_URL}/api/ecosystem/skills`);
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(Array.isArray(data.skills)).toBe(true);
      expect(typeof data.total).toBe('number');
      expect(Array.isArray(data.categories)).toBe(true);
      expect(Array.isArray(data.sources)).toBe(true);

      if (data.skills.length > 0) {
        const skill = data.skills[0];
        expect(skill).toHaveProperty('id');
        expect(skill).toHaveProperty('name');
        expect(skill).toHaveProperty('source');
        expect(skill).toHaveProperty('status');
      }
    });

    test('GET /api/ecosystem/skills filters by category', async () => {
      const response = await fetch(`${BASE_URL}/api/ecosystem/skills?category=design`);
      expect(response.ok).toBe(true);

      const data = await response.json();
      for (const skill of data.skills) {
        expect(skill.category).toBe('design');
      }
    });

    test('GET /api/ecosystem/mcps returns MCP list', async () => {
      const response = await fetch(`${BASE_URL}/api/ecosystem/mcps`);
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(Array.isArray(data.mcps)).toBe(true);
      expect(typeof data.connected).toBe('number');
      expect(typeof data.offline).toBe('number');

      if (data.mcps.length > 0) {
        const mcp = data.mcps[0];
        expect(mcp).toHaveProperty('id');
        expect(mcp).toHaveProperty('name');
        expect(mcp).toHaveProperty('status');
        expect(mcp).toHaveProperty('toolsCount');
      }
    });

    test('POST /api/ecosystem/install installs a component', async () => {
      const response = await fetch(`${BASE_URL}/api/ecosystem/install`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'skill', id: 'test-skill', source: 'aitmpl' }),
      });
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.type).toBe('skill');
      expect(data.id).toBe('test-skill');
    });

    test('POST /api/ecosystem/sync triggers sync', async () => {
      const response = await fetch(`${BASE_URL}/api/ecosystem/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'aitmpl' }),
      });
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(typeof data.skillsFound).toBe('number');
    });

    test('POST /api/ecosystem/doctor runs diagnostics', async () => {
      const response = await fetch(`${BASE_URL}/api/ecosystem/doctor`, {
        method: 'POST',
      });
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(typeof data.success).toBe('boolean');
      expect(Array.isArray(data.checks)).toBe(true);

      if (data.checks.length > 0) {
        const check = data.checks[0];
        expect(check).toHaveProperty('name');
        expect(check).toHaveProperty('status');
        expect(check).toHaveProperty('message');
      }
    });

    test('GET /api/protocol returns protocol status', async () => {
      const response = await fetch(`${BASE_URL}/api/protocol`);
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data).toHaveProperty('enforcementLevel');
      expect(['strict', 'standard', 'audit']).toContain(data.enforcementLevel);
      expect(Array.isArray(data.steps)).toBe(true);
      expect(Array.isArray(data.violations)).toBe(true);

      expect(data.steps.length).toBe(7);
      expect(data.steps[0].name).toBe('Select DNA');
      expect(data.steps[6].name).toBe('Record Learning');
    });
  });

  describe('HTML Pages', () => {
    test('ecosystem page renders with stats', async () => {
      const response = await fetch(`${BASE_URL}/ecosystem`);
      const html = await response.text();

      expect(html).toContain('Total Skills');
      expect(html).toContain('Connected MCPs');
      expect(html).toContain('Active Agents');
      expect(html).toContain('Design Systems');

      expect(html).toContain('Install');
      expect(html).toContain('Sync');
      expect(html).toContain('Doctor');
    });

    test('skills page renders with filters', async () => {
      const response = await fetch(`${BASE_URL}/ecosystem/skills`);
      const html = await response.text();

      expect(html).toContain('All Categories');
      expect(html).toContain('All Sources');
    });

    test('mcps page renders with status cards', async () => {
      const response = await fetch(`${BASE_URL}/ecosystem/mcps`);
      const html = await response.text();

      expect(html).toContain('Connected');
      expect(html).toContain('Offline');
      expect(html).toContain('Error');
    });

    test('report page renders with tabs', async () => {
      const response = await fetch(`${BASE_URL}/ecosystem/report`);
      const html = await response.text();

      expect(html).toContain('Summary');
      expect(html).toContain('Skills');
      expect(html).toContain('MCPs');
      expect(html).toContain('Design Systems');
    });

    test('protocol page renders with enforcement level', async () => {
      const response = await fetch(`${BASE_URL}/protocol`);
      const html = await response.text();

      expect(html).toContain('Enforcement Level');
      expect(html).toContain('7-Step Protocol Checklist');
      expect(html).toContain('Recent Violations');
    });
  });
});
