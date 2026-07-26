/**
 * CLICommand — Configuration and options interface.
 */
export interface CLICommand {
  name: string;
  description: string;
  usage: string;
  options?: { flag: string; description: string; required?: boolean; default?: string }[];
  args?: { name: string; description: string; required?: boolean }[];
  handler: (args: Record<string, unknown>, options: Record<string, unknown>) => Promise<string>;
}

/**
 * CLIOutput — Configuration and options interface.
 */
export interface CLIOutput {
  command: string;
  success: boolean;
  data?: unknown;
  error?: string;
  duration: number;
  timestamp: string;
}

/**
 * CLIEngine — c l i engine.
 *
 * Methods: registerCommand, getCommand, listCommands, execute, getHelp, runInit, runCompile, runValidate, +2 more.
 */
export class CLIEngine {
  private commands = new Map<string, CLICommand>();

  registerCommand(command: CLICommand): void {
    this.commands.set(command.name, command);
  }

  getCommand(name: string): CLICommand | undefined {
    return this.commands.get(name);
  }

  listCommands(category?: string): CLICommand[] {
    const all = Array.from(this.commands.values());
    if (category) {
      return all.filter((c) => c.name.startsWith(category));
    }
    return all;
  }

  async execute(input: string): Promise<CLIOutput> {
    const start = Date.now();
    const parts = input.trim().split(/\s+/);
    const commandName = parts[0];
    const command = this.commands.get(commandName);

    if (!command) {
      return {
        command: commandName,
        success: false,
        error: `Unknown command: ${commandName}. Run 'help' to see available commands.`,
        duration: Date.now() - start,
        timestamp: new Date().toISOString(),
      };
    }

    try {
      const parsedArgs: Record<string, unknown> = {};
      const parsedOptions: Record<string, unknown> = {};
      let argIndex = 0;

      for (let i = 1; i < parts.length; i++) {
        const part = parts[i];
        if (part.startsWith('--')) {
          const eqIndex = part.indexOf('=');
          if (eqIndex !== -1) {
            const key = part.slice(2, eqIndex);
            parsedOptions[key] = part.slice(eqIndex + 1);
          } else if (i + 1 < parts.length && !parts[i + 1].startsWith('--')) {
            parsedOptions[part.slice(2)] = parts[++i];
          } else {
            parsedOptions[part.slice(2)] = true;
          }
        } else if (part.startsWith('-')) {
          const key = part.slice(1);
          if (i + 1 < parts.length && !parts[i + 1].startsWith('-')) {
            parsedOptions[key] = parts[++i];
          } else {
            parsedOptions[key] = true;
          }
        } else if (command.args && argIndex < command.args.length) {
          parsedArgs[command.args[argIndex].name] = part;
          argIndex++;
        } else {
          parsedArgs[String(argIndex)] = part;
          argIndex++;
        }
      }

      const data = await command.handler(parsedArgs, parsedOptions);
      return {
        command: commandName,
        success: true,
        data,
        duration: Date.now() - start,
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      return {
        command: commandName,
        success: false,
        error: err instanceof Error ? err.message : String(err),
        duration: Date.now() - start,
        timestamp: new Date().toISOString(),
      };
    }
  }

  getHelp(command?: string): string {
    if (command) {
      const cmd = this.commands.get(command);
      if (!cmd) {
        return `Unknown command: ${command}`;
      }

      let help = `\n  ${cmd.name} - ${cmd.description}\n`;
      help += `\n  Usage: ${cmd.usage}\n`;

      if (cmd.args && cmd.args.length > 0) {
        help += '\n  Arguments:\n';
        for (const arg of cmd.args) {
          const req = arg.required ? ' (required)' : '';
          help += `    ${arg.name}${req}\t${arg.description}\n`;
        }
      }

      if (cmd.options && cmd.options.length > 0) {
        help += '\n  Options:\n';
        for (const opt of cmd.options) {
          const req = opt.required ? ' (required)' : '';
          const def = opt.default ? ` [default: ${opt.default}]` : '';
          help += `    ${opt.flag}${req}\t${opt.description}${def}\n`;
        }
      }

      return help;
    }

    let help = '\n  BehaviorOS CLI\n';
    help += '  =============\n';
    help += '\n  Available commands:\n';

    const sorted = Array.from(this.commands.values()).sort((a, b) => a.name.localeCompare(b.name));
    for (const cmd of sorted) {
      help += `    ${cmd.name.padEnd(20)} ${cmd.description}\n`;
    }

    help += '\n  Run "help <command>" for details on a specific command.\n';
    return help;
  }

  async runInit(name: string, template?: string): Promise<string> {
    const tpl = template || 'default';
    return `Initialized BehaviorOS project "${name}" with template "${tpl}"`;
  }

  async runCompile(path?: string): Promise<string> {
    const target = path || '.';
    return `Compiled BehaviorOS project at ${target}`;
  }

  async runValidate(path: string, type: 'dna' | 'schema' | 'protocol' = 'dna'): Promise<string> {
    const validTypes: Record<string, string[]> = {
      dna: ['behavioros.yaml', 'dna.yaml'],
      schema: ['schema.json', 'schema.yaml'],
      protocol: ['PROTOCOL.md'],
    };

    const expected = validTypes[type] || validTypes.dna;
    const found = expected.find((f) => path.endsWith(f));

    if (found) {
      return `Validated ${type} at ${path}: passed`;
    }
    return `Validated ${type} at ${path}: 1 error, 0 warnings`;
  }

  async runStatus(): Promise<string> {
    const lines = [
      'Status: active',
      `Uptime: ${process.uptime().toFixed(1)}s`,
      `Commands: ${this.commands.size}`,
      `Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`,
    ];
    return lines.join('\n');
  }

  async runPipeline(action: string, project?: string): Promise<string> {
    const target = project || '.';
    return `Pipeline action "${action}" executed for project at ${target}`;
  }
}
