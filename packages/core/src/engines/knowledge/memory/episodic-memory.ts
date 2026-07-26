import { randomUUID } from 'node:crypto';
import type { MemoryItem, MemoryType } from './types';

/**
 * Episode — Configuration and options interface.
 */
export interface Episode {
  id: string;
  label: string;
  timestamp: string;
  context: Record<string, unknown>;
}

/**
 * EpisodicMemory — episodic memory.
 *
 * Methods: record, getTimeline, searchByContext, getAll, clear.
 */
export class EpisodicMemory {
  readonly type: MemoryType = 'episodic';
  private episodes: Episode[] = [];

  record(label: string, context: Record<string, unknown> = {}): MemoryItem {
    const episode: Episode = {
      id: randomUUID(),
      label,
      timestamp: new Date().toISOString(),
      context,
    };

    this.episodes.push(episode);

    return {
      id: episode.id,
      type: this.type,
      key: label,
      value: label,
      context,
      timestamp: episode.timestamp,
      importance: 0.4,
    };
  }

  getTimeline(from?: string, to?: string): Episode[] {
    let result = [...this.episodes];
    if (from) {
      const fromTime = new Date(from).getTime();
      result = result.filter((e) => new Date(e.timestamp).getTime() >= fromTime);
    }
    if (to) {
      const toTime = new Date(to).getTime();
      result = result.filter((e) => new Date(e.timestamp).getTime() <= toTime);
    }
    return result.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  searchByContext(filters: Record<string, unknown>): Episode[] {
    return this.episodes.filter((episode) => {
      for (const [key, value] of Object.entries(filters)) {
        const ctxVal = episode.context[key];
        if (ctxVal === undefined || ctxVal !== value) return false;
      }
      return true;
    });
  }

  getAll(): Episode[] {
    return [...this.episodes];
  }

  clear(): void {
    this.episodes = [];
  }
}
