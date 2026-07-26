import type { Bus } from './bus';
import { CommandBus } from './command-bus';
import { EventBus } from './event-bus';
import { NotificationBus } from './notification-bus';
import { QueryBus } from './query-bus';
import { StreamBus } from './stream-bus';

export class MeshHub {
  event: EventBus;
  command: CommandBus;
  query: QueryBus;
  notification: NotificationBus;
  stream: StreamBus;

  constructor() {
    this.event = new EventBus();
    this.command = new CommandBus();
    this.query = new QueryBus();
    this.notification = new NotificationBus();
    this.stream = new StreamBus();
  }

  getBus(name: string): Bus {
    switch (name) {
      case 'event':
        return this.event;
      case 'command':
        return this.command;
      case 'query':
        return this.query;
      case 'notification':
        return this.notification;
      case 'stream':
        return this.stream;
      default:
        throw new Error(`Unknown bus: ${name}`);
    }
  }

  allBuses(): Bus[] {
    return [this.event, this.command, this.query, this.notification, this.stream];
  }

  reset(): void {
    this.event = new EventBus();
    this.command = new CommandBus();
    this.query = new QueryBus();
    this.notification = new NotificationBus();
    this.stream = new StreamBus();
  }
}
