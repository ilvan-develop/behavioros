import { describe, expect, it } from 'vitest';
import type { CommandHandler, EventHandler, QueryHandler } from '../cqrs/handlers';
import type { Command, Query, QueryResult } from '../cqrs/interfaces';
import { shouldSkipForConversational } from '../pipeline/mode/conversational.adapter';
import { shouldSkipForTransactional } from '../pipeline/mode/transactional.adapter';

describe('transactional.adapter', () => {
  it('shouldSkipForTransactional returns false for any layer', () => {
    expect(shouldSkipForTransactional('dna')).toBe(false);
    expect(shouldSkipForTransactional('schema')).toBe(false);
    expect(shouldSkipForTransactional('behavioral')).toBe(false);
    expect(shouldSkipForTransactional('governance')).toBe(false);
    expect(shouldSkipForTransactional('decision')).toBe(false);
    expect(shouldSkipForTransactional('quality')).toBe(false);
    expect(shouldSkipForTransactional('audit')).toBe(false);
    expect(shouldSkipForTransactional('mission')).toBe(false);
    expect(shouldSkipForTransactional('learning')).toBe(false);
    expect(shouldSkipForTransactional('unknown-layer')).toBe(false);
  });
});

describe('conversational.adapter', () => {
  it('shouldSkipForConversational skips domain-invariants and decision', () => {
    expect(shouldSkipForConversational('domain-invariants')).toBe(true);
    expect(shouldSkipForConversational('decision')).toBe(true);
  });

  it('shouldSkipForConversational does not skip other layers', () => {
    expect(shouldSkipForConversational('dna')).toBe(false);
    expect(shouldSkipForConversational('schema')).toBe(false);
    expect(shouldSkipForConversational('behavioral')).toBe(false);
    expect(shouldSkipForConversational('governance')).toBe(false);
    expect(shouldSkipForConversational('quality')).toBe(false);
    expect(shouldSkipForConversational('audit')).toBe(false);
    expect(shouldSkipForConversational('mission')).toBe(false);
    expect(shouldSkipForConversational('learning')).toBe(false);
  });

  it('returns false for unknown layers', () => {
    expect(shouldSkipForConversational('nonexistent')).toBe(false);
  });
});

describe('cqrs handlers (interface contracts)', () => {
  it('CommandHandler contract is satisfiable', async () => {
    const handler: CommandHandler = {
      commandType: 'CreateOrder',
      async handle(command: Command) {
        expect(command.type).toBe('CreateOrder');
      },
    };

    expect(handler.commandType).toBe('CreateOrder');
    await handler.handle({
      type: 'CreateOrder',
      payload: { item: 'widget' },
      metadata: {},
      timestamp: new Date().toISOString(),
      id: 'cmd-1',
    });
  });

  it('QueryHandler contract returns QueryResult', async () => {
    const handler: QueryHandler = {
      queryType: 'ListUsers',
      async handle(_query: Query): Promise<QueryResult<{ name: string }>> {
        return { data: [{ name: 'Alice' }], total: 1, offset: 0, limit: 10 };
      },
    };

    expect(handler.queryType).toBe('ListUsers');
    const result = await handler.handle({
      type: 'ListUsers',
      filters: {},
      timestamp: new Date().toISOString(),
      id: 'q-1',
    });
    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('EventHandler contract is satisfiable', async () => {
    const events: string[] = [];
    const handler: EventHandler = {
      eventType: 'UserRegistered',
      async handle(event) {
        events.push(event.type);
      },
    };

    expect(handler.eventType).toBe('UserRegistered');
    await handler.handle({
      type: 'UserRegistered',
      payload: { userId: 'u-1' },
      metadata: {},
      timestamp: new Date().toISOString(),
      id: 'evt-1',
    } as never);
    expect(events).toEqual(['UserRegistered']);
  });
});
