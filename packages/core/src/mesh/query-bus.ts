import type { Bus, BusMessage } from './bus';

export class QueryBus implements Bus {
  readonly name = 'query';
  private handlers: Map<string, (msg: BusMessage) => unknown | Promise<unknown>> = new Map();

  registerHandler(
    queryType: string,
    handler: (msg: BusMessage) => unknown | Promise<unknown>,
  ): void {
    this.handlers.set(queryType, handler);
  }

  async send(msg: Omit<BusMessage, 'id' | 'timestamp'>): Promise<string> {
    const handler = this.handlers.get(msg.type);
    if (!handler) {
      throw new Error(`No handler registered for query type: ${msg.type}`);
    }

    const message: BusMessage = {
      ...msg,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };

    const result = await handler(message);
    this.results.set(message.id, result);
    return message.id;
  }

  async query<T = unknown>(msg: Omit<BusMessage, 'id' | 'timestamp'>): Promise<T> {
    const handler = this.handlers.get(msg.type);
    if (!handler) {
      throw new Error(`No handler registered for query type: ${msg.type}`);
    }

    const message: BusMessage = {
      ...msg,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };

    return (await handler(message)) as T;
  }

  private results: Map<string, unknown> = new Map();

  getResult<T = unknown>(id: string): T | undefined {
    return this.results.get(id) as T | undefined;
  }

  subscribe(
    _handler: (msg: BusMessage) => void | Promise<void>,
    _filter?: (msg: BusMessage) => boolean,
  ): string {
    throw new Error('QueryBus does not support subscribe. Use registerHandler instead.');
  }

  unsubscribe(id: string): void {
    for (const [type, handler] of this.handlers) {
      if ((handler as unknown as { id: string }).id === id) {
        this.handlers.delete(type);
        return;
      }
    }
  }
}
