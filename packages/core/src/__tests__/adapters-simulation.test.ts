import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OpenDesignAdapter } from '../engines/adapters/open-design-adapter';
import { UIUXProMaxAdapter } from '../engines/adapters/ui-ux-adapter';
import { AdapterFramework, MockAdapter } from '../engines/integration/adapters';
import { PromptSimulator } from '../sandbox/simulation/prompt-simulator';
import { ResponseCollector } from '../sandbox/simulation/response-collector';
import { TrafficReplay } from '../sandbox/simulation/traffic-replay';

const mockAccess = vi.fn();
const mockReaddir = vi.fn();
const mockReadFile = vi.fn();

vi.mock('node:fs/promises', () => ({
  access: (...args: unknown[]) => mockAccess(...args),
  readdir: (...args: unknown[]) => mockReaddir(...args),
  readFile: (...args: unknown[]) => mockReadFile(...args),
}));

const mockExecSync = vi.fn();

vi.mock('node:child_process', () => ({
  execSync: (...args: unknown[]) => mockExecSync(...args),
}));

describe('UIUXProMaxAdapter', () => {
  let adapter: UIUXProMaxAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new UIUXProMaxAdapter();
  });

  describe('detect', () => {
    it('should return false when skill path does not exist', async () => {
      mockAccess.mockRejectedValue(new Error('ENOENT'));
      const result = await adapter.detect();
      expect(result).toBe(false);
    });

    it('should return true when skill path exists', async () => {
      mockAccess.mockResolvedValue(undefined);
      const result = await adapter.detect();
      expect(result).toBe(true);
    });
  });

  describe('getPalettes', () => {
    it('should return empty array when skill not detected', async () => {
      mockAccess.mockRejectedValue(new Error('ENOENT'));
      const palettes = await adapter.getPalettes();
      expect(palettes).toEqual([]);
    });

    it('should parse palettes from CSV files', async () => {
      mockAccess.mockResolvedValue(undefined);
      mockReaddir.mockResolvedValue([{ name: 'palettes.csv', isFile: () => true }]);
      mockReadFile.mockResolvedValue(
        'name,colors,category\nSunset,#ff0000;#00ff00,warm\nOcean,#0000ff;#0088ff,cool\n',
      );

      const palettes = await adapter.getPalettes();
      expect(palettes).toHaveLength(2);
      expect(palettes[0].name).toBe('Sunset');
      expect(palettes[0].colors).toEqual(['#ff0000', '#00ff00']);
      expect(palettes[0].category).toBe('warm');
      expect(palettes[1].name).toBe('Ocean');
      expect(palettes[1].category).toBe('cool');
    });

    it('should parse palettes from JSON files', async () => {
      mockAccess.mockResolvedValue(undefined);
      mockReaddir.mockResolvedValue([{ name: 'color-palettes.json', isFile: () => true }]);
      mockReadFile.mockResolvedValue(
        JSON.stringify([
          { name: 'Forest', colors: ['#228B22', '#32CD32'], category: 'nature' },
          { name: 'Sky', colors: ['#87CEEB', '#4682B4'], category: 'nature' },
        ]),
      );

      const palettes = await adapter.getPalettes();
      expect(palettes).toHaveLength(2);
      expect(palettes[0].name).toBe('Forest');
      expect(palettes[1].colors).toEqual(['#87CEEB', '#4682B4']);
    });

    it('should parse palettes from JSON with palettes property', async () => {
      mockAccess.mockResolvedValue(undefined);
      mockReaddir.mockResolvedValue([{ name: 'colors.json', isFile: () => true }]);
      mockReadFile.mockResolvedValue(
        JSON.stringify({
          palettes: [{ name: 'Mono', colors: ['#000', '#fff'], category: 'neutral' }],
        }),
      );

      const palettes = await adapter.getPalettes();
      expect(palettes).toHaveLength(1);
      expect(palettes[0].name).toBe('Mono');
    });

    it('should skip non-csv/json files', async () => {
      mockAccess.mockResolvedValue(undefined);
      mockReaddir.mockResolvedValue([
        { name: 'readme.txt', isFile: () => true },
        { name: 'palettes.csv', isFile: () => true },
      ]);
      mockReadFile.mockResolvedValue('name,colors,category\nTest,#fff,general\n');

      const palettes = await adapter.getPalettes();
      expect(palettes).toHaveLength(1);
    });

    it('should handle read errors gracefully', async () => {
      mockAccess.mockResolvedValue(undefined);
      mockReaddir.mockRejectedValue(new Error('permission denied'));
      const palettes = await adapter.getPalettes();
      expect(palettes).toEqual([]);
    });
  });

  describe('getFonts', () => {
    it('should return empty array when skill not detected', async () => {
      mockAccess.mockRejectedValue(new Error('ENOENT'));
      const fonts = await adapter.getFonts();
      expect(fonts).toEqual([]);
    });

    it('should parse fonts from CSV files', async () => {
      mockAccess.mockResolvedValue(undefined);
      mockReaddir.mockResolvedValue([{ name: 'fonts.csv', isFile: () => true }]);
      mockReadFile.mockResolvedValue(
        'name,headings,body,category\nModern,Inter,Roboto,sans\nClassic,Serif,Merriweather,serif\n',
      );

      const fonts = await adapter.getFonts();
      expect(fonts).toHaveLength(2);
      expect(fonts[0].name).toBe('Modern');
      expect(fonts[0].headings).toBe('Inter');
      expect(fonts[0].body).toBe('Roboto');
    });

    it('should parse fonts from JSON files', async () => {
      mockAccess.mockResolvedValue(undefined);
      mockReaddir.mockResolvedValue([{ name: 'typography.json', isFile: () => true }]);
      mockReadFile.mockResolvedValue(
        JSON.stringify([
          { name: 'System', headings: 'SF Pro', body: 'SF Text', category: 'apple' },
        ]),
      );

      const fonts = await adapter.getFonts();
      expect(fonts).toHaveLength(1);
      expect(fonts[0].headings).toBe('SF Pro');
    });

    it('should parse fonts from JSON with fonts property', async () => {
      mockAccess.mockResolvedValue(undefined);
      mockReaddir.mockResolvedValue([{ name: 'fonts.json', isFile: () => true }]);
      mockReadFile.mockResolvedValue(
        JSON.stringify({
          fonts: [{ name: 'Google', headings: 'Open Sans', body: 'Lato', category: 'web' }],
        }),
      );

      const fonts = await adapter.getFonts();
      expect(fonts).toHaveLength(1);
      expect(fonts[0].headings).toBe('Open Sans');
    });

    it('should handle read errors gracefully', async () => {
      mockAccess.mockResolvedValue(undefined);
      mockReaddir.mockRejectedValue(new Error('permission denied'));
      const fonts = await adapter.getFonts();
      expect(fonts).toEqual([]);
    });
  });

  describe('getStyles', () => {
    it('should return empty array when skill not detected', async () => {
      mockAccess.mockRejectedValue(new Error('ENOENT'));
      const styles = await adapter.getStyles();
      expect(styles).toEqual([]);
    });

    it('should parse styles from CSV files', async () => {
      mockAccess.mockResolvedValue(undefined);
      mockReaddir.mockResolvedValue([{ name: 'styles.csv', isFile: () => true }]);
      mockReadFile.mockResolvedValue(
        'name,description,characteristics\nModern,Clean design,minimal;flat;responsive\n',
      );

      const styles = await adapter.getStyles();
      expect(styles).toHaveLength(1);
      expect(styles[0].name).toBe('Modern');
      expect(styles[0].characteristics).toEqual(['minimal', 'flat', 'responsive']);
    });

    it('should parse styles from JSON files', async () => {
      mockAccess.mockResolvedValue(undefined);
      mockReaddir.mockResolvedValue([{ name: 'design-styles.json', isFile: () => true }]);
      mockReadFile.mockResolvedValue(
        JSON.stringify([
          { name: 'Neumorphism', description: 'Soft UI', characteristics: ['soft', 'embossed'] },
        ]),
      );

      const styles = await adapter.getStyles();
      expect(styles).toHaveLength(1);
      expect(styles[0].description).toBe('Soft UI');
    });

    it('should parse styles from JSON with styles property', async () => {
      mockAccess.mockResolvedValue(undefined);
      mockReaddir.mockResolvedValue([{ name: 'ui-styles.json', isFile: () => true }]);
      mockReadFile.mockResolvedValue(
        JSON.stringify({
          styles: [
            {
              name: 'Flat',
              description: 'Flat design 2.0',
              characteristics: ['minimal', 'colorful'],
            },
          ],
        }),
      );

      const styles = await adapter.getStyles();
      expect(styles).toHaveLength(1);
      expect(styles[0].name).toBe('Flat');
    });

    it('should skip files that do not match style/design/ui patterns', async () => {
      mockAccess.mockResolvedValue(undefined);
      mockReaddir.mockResolvedValue([
        { name: 'fonts.csv', isFile: () => true },
        { name: 'styles.csv', isFile: () => true },
      ]);
      mockReadFile.mockResolvedValue('name,description,characteristics\nTest,desc,feature\n');

      const styles = await adapter.getStyles();
      expect(styles).toHaveLength(1);
    });
  });

  describe('getGuidelines', () => {
    it('should return empty array when skill not detected', async () => {
      mockAccess.mockRejectedValue(new Error('ENOENT'));
      const guidelines = await adapter.getGuidelines('ecommerce');
      expect(guidelines).toEqual([]);
    });

    it('should return guidelines for matching product type from CSV', async () => {
      mockAccess.mockResolvedValue(undefined);
      mockReaddir.mockResolvedValue([{ name: 'guidelines.csv', isFile: () => true }]);
      mockReadFile.mockResolvedValue(
        'type,guideline\necommerce,Show cart count\necommerce,Simplify checkout\nblog,Use readable fonts\n',
      );

      const guidelines = await adapter.getGuidelines('ecommerce');
      expect(guidelines).toHaveLength(2);
      expect(guidelines[0]).toBe('Show cart count');
    });

    it('should return guidelines from JSON with nested structure', async () => {
      mockAccess.mockResolvedValue(undefined);
      mockReaddir.mockResolvedValue([{ name: 'ux-guidelines.json', isFile: () => true }]);
      mockReadFile.mockResolvedValue(
        JSON.stringify([
          {
            productType: 'ecommerce',
            guidelines: ['Show cart', '1-click checkout'],
          },
        ]),
      );

      const guidelines = await adapter.getGuidelines('ecommerce');
      expect(guidelines).toHaveLength(2);
      expect(guidelines).toContain('Show cart');
    });

    it('should return guidelines from JSON with top-level guidelines', async () => {
      mockAccess.mockResolvedValue(undefined);
      mockReaddir.mockResolvedValue([{ name: 'ux.json', isFile: () => true }]);
      mockReadFile.mockResolvedValue(
        JSON.stringify({
          guidelines: ['Use breadcrumbs', 'Show progress'],
        }),
      );

      const guidelines = await adapter.getGuidelines('ecommerce');
      expect(guidelines).toContain('Use breadcrumbs');
    });

    it('should return empty array when no matching product type', async () => {
      mockAccess.mockResolvedValue(undefined);
      mockReaddir.mockResolvedValue([{ name: 'guidelines.csv', isFile: () => true }]);
      mockReadFile.mockResolvedValue('productType,guideline\nblog,Use readable fonts\n');

      const guidelines = await adapter.getGuidelines('ecommerce');
      expect(guidelines).toEqual([]);
    });
  });
});

describe('AdapterFramework', () => {
  let framework: AdapterFramework;

  beforeEach(() => {
    framework = new AdapterFramework();
  });

  it('should register and retrieve an adapter', () => {
    const adapter = new MockAdapter('test-adapter');
    framework.registerAdapter(adapter);

    expect(framework.getAdapter('test-adapter')).toBe(adapter);
  });

  it('should return undefined for unknown adapter', () => {
    expect(framework.getAdapter('unknown')).toBeUndefined();
  });

  it('should connect all adapters', async () => {
    const adapter = new MockAdapter('test');
    framework.registerAdapter(adapter);

    await framework.connectAll();
    const health = await adapter.healthCheck();
    expect(health.connected).toBe(true);
  });

  it('should disconnect all adapters', async () => {
    const adapter = new MockAdapter('test');
    framework.registerAdapter(adapter);
    await framework.connectAll();
    await framework.disconnectAll();

    const health = await adapter.healthCheck();
    expect(health.connected).toBe(false);
  });

  it('should health check all adapters', async () => {
    const adapter = new MockAdapter('test');
    framework.registerAdapter(adapter);
    await framework.connectAll();

    const results = await framework.healthCheckAll();
    expect(results.test).toBeDefined();
    expect(results.test.connected).toBe(true);
    expect(results.test.latency).toBe(0);
  });

  it('should track and untrack connections', () => {
    framework.trackConnection('adapter-1', 'topic-a');
    framework.trackConnection('adapter-1', 'topic-b');

    const connections = framework.getActiveConnections();
    expect(connections).toHaveLength(1);
    expect(connections[0].name).toBe('adapter-1');
    expect(connections[0].topics).toContain('topic-a');

    framework.untrackConnection('adapter-1', 'topic-a');
    expect(framework.getActiveConnections()[0].topics).not.toContain('topic-a');
  });
});

describe('MockAdapter', () => {
  let adapter: MockAdapter;

  beforeEach(() => {
    adapter = new MockAdapter('test');
  });

  it('should connect and disconnect', async () => {
    await adapter.connect({ type: 'nats', host: 'localhost', port: 4222 });
    const health = await adapter.healthCheck();
    expect(health.connected).toBe(true);

    await adapter.disconnect();
    expect((await adapter.healthCheck()).connected).toBe(false);
  });

  it('should publish messages when connected', async () => {
    await adapter.connect({ type: 'nats', host: 'localhost', port: 4222 });
    const id = await adapter.publish('test-topic', { hello: 'world' });

    expect(id).toBeTruthy();
    expect(typeof id).toBe('string');
  });

  it('should subscribe and receive published messages', async () => {
    await adapter.connect({ type: 'nats', host: 'localhost', port: 4222 });

    const handler = vi.fn();
    await adapter.subscribe('test-topic', handler);
    await adapter.publish('test-topic', { data: 42 });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: 'test-topic',
        payload: { data: 42 },
      }),
    );
  });

  it('should throw when publishing while disconnected', async () => {
    await expect(adapter.publish('test', 'msg')).rejects.toThrow('Adapter not connected');
  });

  it('should throw when subscribing while disconnected', async () => {
    await expect(adapter.subscribe('test', vi.fn())).rejects.toThrow('Adapter not connected');
  });

  it('should unsubscribe a subscription', async () => {
    await adapter.connect({ type: 'nats', host: 'localhost', port: 4222 });

    const subId = await adapter.subscribe('test', vi.fn());
    await adapter.unsubscribe(subId);

    await adapter.publish('test', 'msg');
  });

  it('should throw when unsubscribing unknown subscription', async () => {
    await adapter.connect({ type: 'nats', host: 'localhost', port: 4222 });

    await expect(adapter.unsubscribe('unknown-id')).rejects.toThrow(
      'Subscription unknown-id not found',
    );
  });
});

describe('TrafficReplay', () => {
  let replay: TrafficReplay;

  beforeEach(() => {
    replay = new TrafficReplay();
  });

  it('should capture request/response pairs', () => {
    const capture = replay.capture({ query: 'hello' }, { reply: 'world' }, { source: 'test' });

    expect(capture.id).toBeTruthy();
    expect(capture.request).toEqual({ query: 'hello' });
    expect(capture.response).toEqual({ reply: 'world' });
    expect(capture.metadata.source).toBe('test');
    expect(replay.count).toBe(1);
  });

  it('should replay a captured request', () => {
    const capture = replay.capture('req', 'res');

    const result = replay.replay(capture.id);
    expect(result.status).toBe('replayed');
    expect(result.capture.id).toBe(capture.id);
  });

  it('should throw when replaying unknown capture', () => {
    expect(() => replay.replay('unknown-id')).toThrow('Capture unknown-id not found');
  });

  it('should return all captures', () => {
    replay.capture('req1', 'res1');
    replay.capture('req2', 'res2');

    const captures = replay.getCaptures();
    expect(captures).toHaveLength(2);
  });

  it('should filter captures by time range', () => {
    const now = Date.now();
    const c1 = replay.capture('req1', 'res1');
    const _c2 = replay.capture('req2', 'res2');

    const results = replay.getCapturesByTimeRange(now - 1000, now + 10000);
    expect(results).toHaveLength(2);
    expect(results[0].id).toBe(c1.id);
  });

  it('should return empty array when no captures in time range', () => {
    replay.capture('req', 'res');

    const results = replay.getCapturesByTimeRange(0, 1);
    expect(results).toHaveLength(0);
  });

  it('should clear all captures', () => {
    replay.capture('req1', 'res1');
    replay.capture('req2', 'res2');
    expect(replay.count).toBe(2);

    replay.clear();
    expect(replay.count).toBe(0);
    expect(replay.getCaptures()).toHaveLength(0);
  });
});

describe('OpenDesignAdapter', () => {
  let adapter: OpenDesignAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new OpenDesignAdapter();
  });

  it('should detect when CLI is available', async () => {
    mockExecSync.mockReturnValue('od v1.0.0');
    const result = await adapter.detect();
    expect(result).toBe(true);
  });

  it('should detect when CLI is not available', async () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('not found');
    });
    const result = await adapter.detect();
    expect(result).toBe(false);
  });

  it('should install MCP successfully', async () => {
    mockExecSync.mockReturnValue('');
    const result = await adapter.installMCP('shadcn');
    expect(result.success).toBe(true);
  });

  it('should return error when MCP install fails', async () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('CLI error');
    });
    const result = await adapter.installMCP('shadcn');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to install');
  });

  it('should list design systems from JSON output', async () => {
    mockExecSync.mockReturnValue(
      JSON.stringify([
        { id: 'shadcn-ui', name: 'shadcn/ui', tokens: 250 },
        { id: 'radix-ui', name: 'Radix UI', tokens: 180 },
      ]),
    );
    const systems = await adapter.listDesignSystems();
    expect(systems).toHaveLength(2);
    expect(systems[0].id).toBe('shadcn-ui');
    expect(systems[1].tokens).toBe(180);
  });

  it('should list design systems from tabular output', async () => {
    mockExecSync.mockReturnValue('ID\tNAME\tTOKENS\nshadcn\tshadcn/ui\t250\n');
    const systems = await adapter.listDesignSystems();
    expect(systems).toHaveLength(1);
    expect(systems[0].id).toBe('shadcn');
    expect(systems[0].name).toBe('shadcn/ui');
    expect(systems[0].tokens).toBe(250);
  });

  it('should return empty array on list failure', async () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('CLI error');
    });
    const systems = await adapter.listDesignSystems();
    expect(systems).toEqual([]);
  });

  it('should import a design system', async () => {
    mockAccess.mockResolvedValue(undefined);
    mockReadFile.mockResolvedValue(
      '# My System\n\n## Description\nA great design system\n\n## Design Tokens\ncolor: red\nspacing: 4px\n',
    );
    const result = await adapter.importDesignSystem('/fake/design.md');
    expect(result.success).toBe(true);
    expect(result.system?.name).toBe('My System');
    expect(result.system?.metadata?.tokenCount).toBe(2);
  });

  it('should return error on import failure', async () => {
    mockAccess.mockRejectedValue(new Error('ENOENT'));
    const result = await adapter.importDesignSystem('/fake/missing.md');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to import');
  });
});

describe('ResponseCollector', () => {
  let collector: ResponseCollector;

  beforeEach(() => {
    collector = new ResponseCollector();
  });

  it('should collect responses', () => {
    const collected = collector.collect('scenario-1', { result: 'ok' }, { env: 'test' });

    expect(collected.id).toBeTruthy();
    expect(collected.scenarioId).toBe('scenario-1');
    expect(collector.count).toBe(1);
  });

  it('should get responses by scenario', () => {
    collector.collect('scenario-1', 'res1');
    collector.collect('scenario-1', 'res2');
    collector.collect('scenario-2', 'res3');

    const results = collector.getResponsesByScenario('scenario-1');
    expect(results).toHaveLength(2);
  });

  it('should return empty array for unknown scenario', () => {
    expect(collector.getResponsesByScenario('unknown')).toEqual([]);
  });

  it('should list all responses', () => {
    collector.collect('s1', 'r1');
    collector.collect('s2', 'r2');

    expect(collector.getResponses()).toHaveLength(2);
  });

  it('should clear all responses', () => {
    collector.collect('s1', 'r1');
    collector.clear();

    expect(collector.count).toBe(0);
    expect(collector.getResponses()).toHaveLength(0);
  });
});

describe('PromptSimulator', () => {
  let simulator: PromptSimulator;

  beforeEach(() => {
    simulator = new PromptSimulator();
  });

  it('should add and list scenarios', () => {
    simulator.addScenario({
      id: 'scenario-1',
      name: 'Test Greeting',
      prompt: 'Say hello',
      expectedBehavior: 'Responds with greeting',
      metadata: {},
    });

    expect(simulator.count).toBe(1);
    expect(simulator.getScenarios()).toHaveLength(1);
  });

  it('should simulate a scenario and return the prompt', () => {
    simulator.addScenario({
      id: 'scenario-1',
      name: 'Test Greeting',
      prompt: 'Say hello',
      expectedBehavior: 'Responds with greeting',
      metadata: {},
    });

    const result = simulator.simulate('scenario-1');
    expect(result.prompt).toBe('Say hello');
    expect(result.simulated).toBe(true);
  });

  it('should throw when simulating unknown scenario', () => {
    expect(() => simulator.simulate('unknown')).toThrow('Scenario unknown not found');
  });

  it('should clear all scenarios', () => {
    simulator.addScenario({
      id: 's1',
      name: 'Test',
      prompt: 'Hi',
      expectedBehavior: 'Reply',
      metadata: {},
    });
    simulator.addScenario({
      id: 's2',
      name: 'Test 2',
      prompt: 'Bye',
      expectedBehavior: 'Reply',
      metadata: {},
    });

    expect(simulator.count).toBe(2);
    simulator.clear();
    expect(simulator.count).toBe(0);
  });
});
