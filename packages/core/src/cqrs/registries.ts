import type { CommandHandler, EventHandler, QueryHandler } from './handlers';
import type { Command, Event, Query, QueryResult } from './interfaces';

export class CommandRegistry {
  private handlers = new Map<string, CommandHandler>();

  register(handler: CommandHandler): void {
    this.handlers.set(handler.commandType, handler);
  }

  dispatch(command: Command): Promise<void> {
    const handler = this.handlers.get(command.type);
    if (!handler) {
      return Promise.reject(new Error(`No command handler registered for type: ${command.type}`));
    }
    return handler.handle(command);
  }

  hasHandler(commandType: string): boolean {
    return this.handlers.has(commandType);
  }
}

export class QueryRegistry {
  private handlers = new Map<string, QueryHandler>();

  register(handler: QueryHandler): void {
    this.handlers.set(handler.queryType, handler);
  }

  dispatch<T = unknown>(query: Query): Promise<QueryResult<T>> {
    const handler = this.handlers.get(query.type);
    if (!handler) {
      return Promise.reject(new Error(`No query handler registered for type: ${query.type}`));
    }
    return handler.handle(query) as Promise<QueryResult<T>>;
  }

  hasHandler(queryType: string): boolean {
    return this.handlers.has(queryType);
  }
}

export class EventRegistry {
  private handlers = new Map<string, Set<EventHandler>>();

  register(handler: EventHandler): void {
    const existing = this.handlers.get(handler.eventType);
    if (existing) {
      existing.add(handler);
    } else {
      this.handlers.set(handler.eventType, new Set([handler]));
    }
  }

  dispatch(event: Event): Promise<void>[] {
    const handlers = this.handlers.get(event.type);
    if (!handlers || handlers.size === 0) {
      throw new Error(`No event handlers registered for type: ${event.type}`);
    }
    return Array.from(handlers).map((h) => h.handle(event));
  }

  hasHandler(eventType: string): boolean {
    const handlers = this.handlers.get(eventType);
    return handlers !== undefined && handlers.size > 0;
  }

  handlerCount(eventType: string): number {
    return this.handlers.get(eventType)?.size ?? 0;
  }
}
