import { randomUUID } from 'node:crypto';

/**
 * DistributedEvent — Configuration and options interface.
 */
export interface DistributedEvent {
  id: string;
  topic: string;
  payload: unknown;
  source: string;
  timestamp: string;
  ttl?: number;
}

/**
 * Subscription — Configuration and options interface.
 */
export interface Subscription {
  id: string;
  topic: string;
  nodeId: string;
  handler: (event: DistributedEvent) => void;
  filter?: (event: DistributedEvent) => boolean;
}

/**
 * DistributedEventBus — distributed event bus.
 *
 * Methods: publish, subscribe, unsubscribe, getSubscriptions, getEvents, forwardToNode.
 */
export class DistributedEventBus {
  private subscriptions: Map<string, Subscription> = new Map();
  private events: DistributedEvent[] = [];

  publish(event: Omit<DistributedEvent, 'id' | 'timestamp'>): void {
    const fullEvent: DistributedEvent = {
      ...event,
      id: randomUUID(),
      timestamp: new Date().toISOString(),
    };

    this.events.push(fullEvent);

    for (const [, sub] of this.subscriptions) {
      if (sub.topic !== event.topic) continue;
      if (sub.filter && !sub.filter(fullEvent)) continue;
      sub.handler(fullEvent);
    }
  }

  subscribe(
    topic: string,
    nodeId: string,
    handler: (event: DistributedEvent) => void,
    filter?: (e: DistributedEvent) => boolean,
  ): string {
    const id = randomUUID();
    this.subscriptions.set(id, { id, topic, nodeId, handler, filter });
    return id;
  }

  unsubscribe(subscriptionId: string): boolean {
    return this.subscriptions.delete(subscriptionId);
  }

  getSubscriptions(topic?: string): Subscription[] {
    const results: Subscription[] = [];
    for (const [, sub] of this.subscriptions) {
      if (topic && sub.topic !== topic) continue;
      results.push({ ...sub, handler: sub.handler });
    }
    return results;
  }

  getEvents(topic?: string, since?: string): DistributedEvent[] {
    const sinceTime = since ? new Date(since).getTime() : 0;
    return this.events.filter((e) => {
      if (topic && e.topic !== topic) return false;
      if (since && new Date(e.timestamp).getTime() <= sinceTime) return false;
      return true;
    });
  }

  forwardToNode(nodeId: string, events: DistributedEvent[]): void {
    for (const event of events) {
      const forwarded: DistributedEvent = {
        ...event,
        id: randomUUID(),
        timestamp: new Date().toISOString(),
      };

      this.events.push(forwarded);

      for (const [, sub] of this.subscriptions) {
        if (sub.topic !== event.topic) continue;
        if (sub.nodeId !== nodeId) continue;
        if (sub.filter && !sub.filter(forwarded)) continue;
        sub.handler(forwarded);
      }
    }
  }
}
