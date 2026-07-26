import type { Bus, BusMessage } from './bus';

export type CommandValidator = (msg: Omit<BusMessage, 'id' | 'timestamp'>) => boolean;

export class CommandBus implements Bus {
  readonly name = 'command';
  private handlers: Map<string, (msg: BusMessage) => void | Promise<void>> = new Map();
  private idempotencyKeys: Set<string> = new Set();
  private validators: Map<string, CommandValidator> = new Map();

  registerHandler(
    commandType: string,
    handler: (msg: BusMessage) => void | Promise<void>,
    validator?: CommandValidator,
  ): void {
    this.handlers.set(commandType, handler);
    if (validator) {
      this.validators.set(commandType, validator);
    }
  }

  async send(msg: Omit<BusMessage, 'id' | 'timestamp'>): Promise<string> {
    const idempotencyKey = (msg.metadata?.idempotencyKey as string) ?? null;

    if (idempotencyKey && this.idempotencyKeys.has(idempotencyKey)) {
      throw new Error(`Idempotency key already processed: ${idempotencyKey}`);
    }

    const validator = this.validators.get(msg.type);
    if (validator && !validator(msg)) {
      throw new Error(`Command validation failed for type: ${msg.type}`);
    }

    const handler = this.handlers.get(msg.type);
    if (!handler) {
      throw new Error(`No handler registered for command type: ${msg.type}`);
    }

    const message: BusMessage = {
      ...msg,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };

    if (idempotencyKey) {
      this.idempotencyKeys.add(idempotencyKey);
    }

    await handler(message);
    return message.id;
  }

  subscribe(
    _handler: (msg: BusMessage) => void | Promise<void>,
    _filter?: (msg: BusMessage) => boolean,
  ): string {
    throw new Error('CommandBus does not support subscribe. Use registerHandler instead.');
  }

  unsubscribe(id: string): void {
    for (const [type, handler] of this.handlers) {
      if ((handler as unknown as { id: string }).id === id) {
        this.handlers.delete(type);
        this.validators.delete(type);
        return;
      }
    }
  }

  hasProcessed(key: string): boolean {
    return this.idempotencyKeys.has(key);
  }
}
