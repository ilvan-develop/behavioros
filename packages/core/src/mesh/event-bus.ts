import type { Bus, BusMessage, BusSubscription } from './bus';

export class EventBus implements Bus {
  readonly name = 'event';
  private history: BusMessage[] = [];
  private subscriptions: Map<string, BusSubscription> = new Map();

  async send(msg: Omit<BusMessage, 'id' | 'timestamp'>): Promise<string> {
    const message: BusMessage = {
      ...msg,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };

    this.history.push(message);

    for (const sub of this.subscriptions.values()) {
      if (!sub.filter || sub.filter(message)) {
        await sub.handler(message);
      }
    }

    return message.id;
  }

  subscribe(
    handler: (msg: BusMessage) => void | Promise<void>,
    filter?: (msg: BusMessage) => boolean,
  ): string {
    const id = crypto.randomUUID();
    this.subscriptions.set(id, { id, handler, filter });
    return id;
  }

  unsubscribe(id: string): void {
    this.subscriptions.delete(id);
  }

  getHistory(): BusMessage[] {
    return [...this.history];
  }

  replay(): BusMessage[] {
    return this.getHistory();
  }

  replayFrom(timestamp: string): BusMessage[] {
    return this.history.filter((m) => m.timestamp > timestamp);
  }
}
