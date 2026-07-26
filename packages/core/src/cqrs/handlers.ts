import type { Command, Event, Query, QueryResult } from './interfaces';

export interface CommandHandler<T extends Command = Command> {
  commandType: string;
  handle(command: T): Promise<void>;
}

export interface QueryHandler<T extends Query = Query, R = unknown> {
  queryType: string;
  handle(query: T): Promise<QueryResult<R>>;
}

export interface EventHandler<T extends Event = Event> {
  eventType: string;
  handle(event: T): Promise<void>;
}
