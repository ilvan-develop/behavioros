import type { Bus, BusMessage } from './bus';

export interface ConsumerGroup {
  id: string;
  members: Array<{
    id: string;
    handler: (msg: BusMessage) => void | Promise<void>;
  }>;
  offset: number;
}

export class StreamBus implements Bus {
  readonly name = 'stream';
  private streams: Map<string, BusMessage[]> = new Map();
  private consumerGroups: Map<string, ConsumerGroup> = new Map();
  private offset: Map<string, number> = new Map();

  async send(msg: Omit<BusMessage, 'id' | 'timestamp'>): Promise<string> {
    const partition = (msg.metadata?.partition as string) ?? 'default';
    const stream = (msg.metadata?.stream as string) ?? partition;

    const message: BusMessage = {
      ...msg,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };

    if (!this.streams.has(stream)) {
      this.streams.set(stream, []);
    }
    this.streams.get(stream)!.push(message);

    this.deliverToConsumerGroups(stream, message);

    return message.id;
  }

  private deliverToConsumerGroups(stream: string, message: BusMessage): void {
    const streamMessages = this.streams.get(stream);
    if (!streamMessages) return;

    for (const group of this.consumerGroups.values()) {
      if (group.offset < streamMessages.length) {
        for (const member of group.members) {
          member.handler(message);
        }
        group.offset++;
      }
    }
  }

  subscribe(
    handler: (msg: BusMessage) => void | Promise<void>,
    filter?: (msg: BusMessage) => boolean,
  ): string {
    const id = crypto.randomUUID();
    const handlerWrapper = (msg: BusMessage): void | Promise<void> => {
      if (!filter || filter(msg)) {
        return handler(msg);
      }
    };

    if (!this.consumerGroups.has('default')) {
      this.consumerGroups.set('default', {
        id: 'default',
        members: [],
        offset: 0,
      });
    }

    this.consumerGroups.get('default')!.members.push({ id, handler: handlerWrapper });
    return id;
  }

  unsubscribe(id: string): void {
    for (const group of this.consumerGroups.values()) {
      group.members = group.members.filter((m) => m.id !== id);
    }
  }

  createConsumerGroup(
    groupId: string,
    memberHandler: (msg: BusMessage) => void | Promise<void>,
  ): string {
    const memberId = crypto.randomUUID();
    const existing = this.consumerGroups.get(groupId);

    if (existing) {
      existing.members.push({ id: memberId, handler: memberHandler });
      return memberId;
    }

    this.consumerGroups.set(groupId, {
      id: groupId,
      members: [{ id: memberId, handler: memberHandler }],
      offset: 0,
    });

    return memberId;
  }

  getStream(stream: string): BusMessage[] {
    return [...(this.streams.get(stream) ?? [])];
  }

  replay(stream: string, fromIndex = 0): BusMessage[] {
    const messages = this.streams.get(stream);
    if (!messages) return [];
    return messages.slice(fromIndex);
  }

  getStreams(): string[] {
    return [...this.streams.keys()];
  }
}
