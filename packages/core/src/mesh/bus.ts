export interface BusMessage {
  id: string;
  type: string;
  payload: unknown;
  metadata: Record<string, unknown>;
  timestamp: string;
}

export interface BusSubscription {
  id: string;
  handler: (msg: BusMessage) => void | Promise<void>;
  filter?: (msg: BusMessage) => boolean;
}

export interface Bus {
  readonly name: string;
  send(msg: Omit<BusMessage, 'id' | 'timestamp'>): Promise<string>;
  subscribe(
    handler: (msg: BusMessage) => void | Promise<void>,
    filter?: (msg: BusMessage) => boolean,
  ): string;
  unsubscribe(id: string): void;
}
