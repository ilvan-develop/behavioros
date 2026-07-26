/**
 * Message — Configuration and options interface.
 */
export interface Message {
  id: string;
  topic: string;
  payload: unknown;
  headers: Record<string, string>;
  timestamp: string;
}

/**
 * AdapterConfig — Configuration and options interface.
 */
export interface AdapterConfig {
  type: 'kafka' | 'rabbitmq' | 'nats' | 'redis';
  host: string;
  port: number;
  credentials?: { username: string; password: string };
  options?: Record<string, unknown>;
}

/**
 * MessageAdapter — Configuration and options interface.
 */
export interface MessageAdapter {
  readonly name: string;
  connect(config: AdapterConfig): Promise<void>;
  disconnect(): Promise<void>;
  publish(topic: string, message: unknown, headers?: Record<string, string>): Promise<string>;
  subscribe(topic: string, handler: (msg: Message) => void): Promise<string>;
  unsubscribe(subscriptionId: string): Promise<void>;
  healthCheck(): Promise<{ connected: boolean; latency: number }>;
}

/**
 * AdapterFramework — adapter framework.
 *
 * Methods: registerAdapter, getAdapter, connectAll, disconnectAll, healthCheckAll, getActiveConnections, trackConnection, untrackConnection, +6 more.
 */
export class AdapterFramework {
  private adapters = new Map<string, MessageAdapter>();
  private activeConnections = new Map<string, Set<string>>();

  registerAdapter(adapter: MessageAdapter): void {
    this.adapters.set(adapter.name, adapter);
  }

  getAdapter(name: string): MessageAdapter | undefined {
    return this.adapters.get(name);
  }

  async connectAll(): Promise<void> {
    for (const adapter of this.adapters.values()) {
      await adapter.connect({ type: 'nats', host: 'localhost', port: 4222 });
    }
  }

  async disconnectAll(): Promise<void> {
    for (const adapter of this.adapters.values()) {
      await adapter.disconnect();
    }
    this.activeConnections.clear();
  }

  async healthCheckAll(): Promise<Record<string, { connected: boolean; latency: number }>> {
    const results: Record<string, { connected: boolean; latency: number }> = {};
    for (const [name, adapter] of this.adapters) {
      results[name] = await adapter.healthCheck();
    }
    return results;
  }

  getActiveConnections(): { name: string; topics: string[] }[] {
    const result: { name: string; topics: string[] }[] = [];
    for (const [name, topics] of this.activeConnections) {
      result.push({ name, topics: [...topics] });
    }
    return result;
  }

  trackConnection(name: string, topic: string): void {
    if (!this.activeConnections.has(name)) {
      this.activeConnections.set(name, new Set());
    }
    this.activeConnections.get(name)!.add(topic);
  }

  untrackConnection(name: string, topic: string): void {
    this.activeConnections.get(name)?.delete(topic);
  }
}

/**
 * MockAdapter — Provides constructor, connect, disconnect, publish, ... operations.
 * @implements {MessageAdapter}
 */
export class MockAdapter implements MessageAdapter {
  readonly name: string;
  private connected = false;
  private subscriptions = new Map<string, { topic: string; handler: (msg: Message) => void }>();

  constructor(name: string) {
    this.name = name;
  }

  async connect(_config: AdapterConfig): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.subscriptions.clear();
  }

  async publish(
    topic: string,
    message: unknown,
    headers?: Record<string, string>,
  ): Promise<string> {
    if (!this.connected) throw new Error('Adapter not connected');
    const id = crypto.randomUUID();
    const msg: Message = {
      id,
      topic,
      payload: message,
      headers: headers ?? {},
      timestamp: new Date().toISOString(),
    };
    for (const sub of this.subscriptions.values()) {
      if (sub.topic === topic) {
        sub.handler(msg);
      }
    }
    return id;
  }

  async subscribe(topic: string, handler: (msg: Message) => void): Promise<string> {
    if (!this.connected) throw new Error('Adapter not connected');
    const id = crypto.randomUUID();
    this.subscriptions.set(id, { topic, handler });
    return id;
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    if (!this.subscriptions.has(subscriptionId)) {
      throw new Error(`Subscription ${subscriptionId} not found`);
    }
    this.subscriptions.delete(subscriptionId);
  }

  async healthCheck(): Promise<{ connected: boolean; latency: number }> {
    return { connected: this.connected, latency: 0 };
  }
}
