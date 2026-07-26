import { randomUUID } from 'node:crypto';

/**
 * ContextEvent — Configuration and options interface.
 */
export interface ContextEvent {
  id: string;
  missionId: string;
  type: string;
  content: string;
  timestamp: string;
}

/**
 * MissionContext — mission context.
 *
 * Methods: push, getContext, search, clear.
 */
export class MissionContext {
  private windowSize: number;
  private events: ContextEvent[] = [];

  constructor(windowSize = 100) {
    this.windowSize = windowSize;
  }

  push(missionId: string, type: string, content: string): void {
    const event: ContextEvent = {
      id: randomUUID(),
      missionId,
      type,
      content,
      timestamp: new Date().toISOString(),
    };
    this.events.push(event);

    while (this.events.length > this.windowSize) {
      this.events.shift();
    }
  }

  getContext(missionId: string): ContextEvent[] {
    return this.events.filter((e) => e.missionId === missionId);
  }

  search(missionId: string, query: string): ContextEvent[] {
    const lower = query.toLowerCase();
    return this.events.filter(
      (e) =>
        e.missionId === missionId &&
        (e.content.toLowerCase().includes(lower) || e.type.toLowerCase().includes(lower)),
    );
  }

  clear(missionId?: string): void {
    if (missionId) {
      this.events = this.events.filter((e) => e.missionId !== missionId);
    } else {
      this.events = [];
    }
  }
}
