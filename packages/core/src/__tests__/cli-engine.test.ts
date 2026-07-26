import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CLICommand } from '../engines/ecosystem/cli-engine';
import { CLIEngine } from '../engines/ecosystem/cli-engine';

function makeCommand(overrides: Partial<CLICommand> = {}): CLICommand {
  return {
    name: 'test',
    description: 'Test command',
    usage: 'test [options]',
    handler: async () => 'test ok',
    ...overrides,
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('CLIEngine — registerCommand / getCommand / listCommands', () => {
  it('should register and retrieve a command', () => {
    const engine = new CLIEngine();
    const cmd = makeCommand({ name: 'build' });
    engine.registerCommand(cmd);
    expect(engine.getCommand('build')).toBe(cmd);
  });

  it('should return undefined for unknown command', () => {
    const engine = new CLIEngine();
    expect(engine.getCommand('nonexistent')).toBeUndefined();
  });

  it('should list all registered commands', () => {
    const engine = new CLIEngine();
    engine.registerCommand(makeCommand({ name: 'build' }));
    engine.registerCommand(makeCommand({ name: 'deploy' }));
    engine.registerCommand(makeCommand({ name: 'init' }));
    expect(engine.listCommands()).toHaveLength(3);
  });

  it('should filter commands by category prefix', () => {
    const engine = new CLIEngine();
    engine.registerCommand(makeCommand({ name: 'build:ts' }));
    engine.registerCommand(makeCommand({ name: 'build:js' }));
    engine.registerCommand(makeCommand({ name: 'deploy:prod' }));
    expect(engine.listCommands('build')).toHaveLength(2);
    expect(engine.listCommands('deploy')).toHaveLength(1);
  });

  it('should not overwrite on duplicate registration — allows it', () => {
    const engine = new CLIEngine();
    const cmd1 = makeCommand({ name: 'same', description: 'first' });
    const cmd2 = makeCommand({ name: 'same', description: 'second' });
    engine.registerCommand(cmd1);
    engine.registerCommand(cmd2);
    expect(engine.getCommand('same')?.description).toBe('second');
  });
});

describe('CLIEngine — execute', () => {
  it('should execute a command and return success', async () => {
    const engine = new CLIEngine();
    engine.registerCommand(makeCommand({ name: 'greet', handler: async () => 'Hello!' }));
    const output = await engine.execute('greet');
    expect(output.success).toBe(true);
    expect(output.data).toBe('Hello!');
    expect(output.command).toBe('greet');
  });

  it('should pass arguments to the handler', async () => {
    const engine = new CLIEngine();
    const handler = vi.fn(async () => 'done');
    engine.registerCommand(
      makeCommand({
        name: 'echo',
        args: [{ name: 'message', description: 'Message to echo', required: true }],
        handler,
      }),
    );
    await engine.execute('echo hello');
    expect(handler).toHaveBeenCalledWith({ message: 'hello' }, {});
  });

  it('should pass options to the handler', async () => {
    const engine = new CLIEngine();
    const handler = vi.fn(async () => 'done');
    engine.registerCommand(
      makeCommand({
        name: 'render',
        options: [{ flag: '--format', description: 'Output format' }],
        handler,
      }),
    );
    await engine.execute('render --format=json');
    expect(handler).toHaveBeenCalledWith({}, { format: 'json' });
  });

  it('should parse boolean flags', async () => {
    const engine = new CLIEngine();
    const handler = vi.fn(async () => 'done');
    engine.registerCommand(makeCommand({ name: 'lint', handler }));
    await engine.execute('lint --fix');
    expect(handler).toHaveBeenCalledWith({}, { fix: true });
  });

  it('should return error for unknown command', async () => {
    const engine = new CLIEngine();
    const output = await engine.execute('bogus');
    expect(output.success).toBe(false);
    expect(output.error).toContain('Unknown command: bogus');
  });

  it('should capture handler errors', async () => {
    const engine = new CLIEngine();
    engine.registerCommand(
      makeCommand({
        name: 'fail',
        handler: async () => {
          throw new Error('something broke');
        },
      }),
    );
    const output = await engine.execute('fail');
    expect(output.success).toBe(false);
    expect(output.error).toBe('something broke');
  });

  it('should measure duration', async () => {
    const engine = new CLIEngine();
    engine.registerCommand(
      makeCommand({
        name: 'slow',
        handler: async () => {
          await new Promise((r) => setTimeout(r, 20));
          return 'done';
        },
      }),
    );
    const output = await engine.execute('slow');
    expect(output.duration).toBeGreaterThanOrEqual(15);
  });

  it('should include ISO timestamp in output', async () => {
    const engine = new CLIEngine();
    engine.registerCommand(makeCommand({ name: 'now' }));
    const output = await engine.execute('now');
    expect(output.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe('CLIEngine — getHelp', () => {
  it('should return help for a specific command', () => {
    const engine = new CLIEngine();
    engine.registerCommand(
      makeCommand({
        name: 'build',
        description: 'Build the project',
        usage: 'build [--watch]',
        args: [{ name: 'target', description: 'Build target', required: false }],
        options: [{ flag: '--watch', description: 'Watch for changes' }],
      }),
    );
    const help = engine.getHelp('build');
    expect(help).toContain('build');
    expect(help).toContain('Build the project');
    expect(help).toContain('--watch');
    expect(help).toContain('target');
  });

  it('should return general help with all commands', () => {
    const engine = new CLIEngine();
    engine.registerCommand(makeCommand({ name: 'alpha', description: 'First command' }));
    engine.registerCommand(makeCommand({ name: 'beta', description: 'Second command' }));
    const help = engine.getHelp();
    expect(help).toContain('BehaviorOS CLI');
    expect(help).toContain('alpha');
    expect(help).toContain('beta');
    expect(help).toContain('First command');
    expect(help).toContain('Second command');
    expect(help).toContain('help <command>');
  });

  it('should report unknown command in help', () => {
    const engine = new CLIEngine();
    expect(engine.getHelp('nope')).toBe('Unknown command: nope');
  });
});

describe('CLIEngine — runInit', () => {
  it('should return init message with project name and template', async () => {
    const engine = new CLIEngine();
    const result = await engine.runInit('my-app', 'fullstack');
    expect(result).toBe('Initialized BehaviorOS project "my-app" with template "fullstack"');
  });

  it('should default to "default" template', async () => {
    const engine = new CLIEngine();
    const result = await engine.runInit('my-app');
    expect(result).toContain('template "default"');
  });
});

describe('CLIEngine — runCompile', () => {
  it('should return compilation result with default path', async () => {
    const engine = new CLIEngine();
    const result = await engine.runCompile();
    expect(result).toBe('Compiled BehaviorOS project at .');
  });

  it('should accept custom path', async () => {
    const engine = new CLIEngine();
    const result = await engine.runCompile('src/');
    expect(result).toBe('Compiled BehaviorOS project at src/');
  });
});

describe('CLIEngine — runValidate', () => {
  it('should pass when path matches expected dna file', async () => {
    const engine = new CLIEngine();
    const result = await engine.runValidate('./behavioros.yaml', 'dna');
    expect(result).toContain('passed');
  });

  it('should report errors when path does not match expected', async () => {
    const engine = new CLIEngine();
    const result = await engine.runValidate('./random.txt', 'dna');
    expect(result).toContain('1 error');
  });

  it('should validate schema type', async () => {
    const engine = new CLIEngine();
    const result = await engine.runValidate('./schema.json', 'schema');
    expect(result).toContain('passed');
  });

  it('should validate protocol type', async () => {
    const engine = new CLIEngine();
    const result = await engine.runValidate('./PROTOCOL.md', 'protocol');
    expect(result).toContain('passed');
  });
});

describe('CLIEngine — runStatus', () => {
  it('should return formatted status string', async () => {
    const engine = new CLIEngine();
    engine.registerCommand(makeCommand({ name: 'build' }));
    const result = await engine.runStatus();
    expect(result).toContain('Status: active');
    expect(result).toContain('Commands: 1');
    expect(result).toContain('Uptime:');
  });
});

describe('CLIEngine — runPipeline', () => {
  it('should trigger pipeline action with default path', async () => {
    const engine = new CLIEngine();
    const result = await engine.runPipeline('validate');
    expect(result).toBe('Pipeline action "validate" executed for project at .');
  });

  it('should accept custom project path', async () => {
    const engine = new CLIEngine();
    const result = await engine.runPipeline('deploy', 'packages/core');
    expect(result).toBe('Pipeline action "deploy" executed for project at packages/core');
  });
});
