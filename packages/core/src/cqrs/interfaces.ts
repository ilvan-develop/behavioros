import type { BehaviorOSEvent } from '../events/event-types';

export interface Command {
  type: string;
  payload: unknown;
  metadata: Record<string, unknown>;
  timestamp: string;
  id: string;
}

export interface Query {
  type: string;
  filters: Record<string, unknown>;
  projection?: string[];
  pagination?: { offset: number; limit: number };
  timestamp: string;
  id: string;
}

export interface QueryResult<T = unknown> {
  data: T[];
  total: number;
  offset: number;
  limit: number;
}

export type { BehaviorOSEvent as Event };
