import type { Bus, BusMessage, BusSubscription } from './bus';

export class NotificationBus implements Bus {
  readonly name = 'notification';
  private subscriptions: Map<string, BusSubscription> = new Map();

  async send(msg: Omit<BusMessage, 'id' | 'timestamp'>): Promise<string> {
    const message: BusMessage = {
      ...msg,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };

    for (const sub of this.subscriptions.values()) {
      if (!sub.filter || sub.filter(message)) {
        try {
          const result = sub.handler(message);
          if (result instanceof Promise) {
            result.catch(() => {});
          }
        } catch {
          // Best-effort: silently ignore subscriber errors
        }
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

  subscriberCount(): number {
    return this.subscriptions.size;
  }
}
