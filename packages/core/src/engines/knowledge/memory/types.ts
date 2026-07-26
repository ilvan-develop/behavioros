/**
 * MemoryType — Type alias for memorytype.
 */
export type MemoryType =
  | 'short-term'
  | 'working'
  | 'long-term'
  | 'semantic'
  | 'procedural'
  | 'episodic';

/**
 * MemoryItem — Configuration and options interface.
 */
export interface MemoryItem {
  id: string;
  type: MemoryType;
  key: string;
  value: string;
  context: Record<string, unknown>;
  timestamp: string;
  ttl?: number;
  importance: number;
}
