import { randomUUID } from 'node:crypto';
import type { EventBridge } from '../../events/event-bridge';

/**
 * QueueItemStatus — Union type: queued, running, completed, failed, cancelled;.
 */
export type QueueItemStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * QueueItem — Configuration and options interface.
 */
export interface QueueItem {
  id: string;
  taskId: string;
  type: string;
  payload: unknown;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: QueueItemStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  retryCount: number;
  maxRetries: number;
}

/**
 * QueueStats — Configuration and options interface.
 */
export interface QueueStats {
  queued: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
  avgWaitTime: number;
}

const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/**
 * QueueManager — queue manager.
 *
 * Methods: enqueue, dequeue, complete, fail, cancel, getStatus, getStats, onEnqueue, +3 more.
 */
export class QueueManager {
  private items: Map<string, QueueItem> = new Map();
  private queue: string[] = [];
  private onEnqueueCb: ((item: QueueItem) => void) | null = null;
  private onCompleteCb: ((item: QueueItem) => void) | null = null;
  private onFailCb: ((item: QueueItem) => void) | null = null;

  constructor(private eventBridge?: EventBridge) {}

  enqueue(item: Omit<QueueItem, 'id' | 'status' | 'createdAt' | 'retryCount'>): string {
    const id = randomUUID();
    const now = new Date().toISOString();
    const queueItem: QueueItem = {
      ...item,
      id,
      status: 'queued',
      createdAt: now,
      retryCount: 0,
    };
    this.items.set(id, queueItem);
    this.queue.push(id);
    this.sortQueue();
    this.onEnqueueCb?.(queueItem);
    this.eventBridge?.emit('task-queued', id, 'task', {
      taskId: queueItem.taskId,
      type: queueItem.type,
      priority: queueItem.priority,
    });
    return id;
  }

  dequeue(): QueueItem | null {
    for (let i = 0; i < this.queue.length; i++) {
      const id = this.queue[i];
      const item = this.items.get(id);
      if (item && item.status === 'queued') {
        item.status = 'running';
        item.startedAt = new Date().toISOString();
        this.queue.splice(i, 1);
        this.eventBridge?.emit('task-started', item.id, 'task', { taskId: item.taskId });
        return item;
      }
    }
    return null;
  }

  complete(id: string): void {
    const item = this.items.get(id);
    if (!item) return;
    item.status = 'completed';
    item.completedAt = new Date().toISOString();
    this.onCompleteCb?.(item);
    this.eventBridge?.emitTaskCompleted(id, { taskId: item.taskId });
  }

  fail(id: string, error: string): void {
    const item = this.items.get(id);
    if (!item) return;
    item.status = 'failed';
    item.error = error;
    item.completedAt = new Date().toISOString();
    this.onFailCb?.(item);
    this.eventBridge?.emitTaskFailed(id, error);
  }

  cancel(id: string): void {
    const item = this.items.get(id);
    if (!item) return;
    item.status = 'cancelled';
    item.completedAt = new Date().toISOString();
    const idx = this.queue.indexOf(id);
    if (idx !== -1) this.queue.splice(idx, 1);
  }

  getStatus(id: string): QueueItemStatus | null {
    return this.items.get(id)?.status ?? null;
  }

  getStats(): QueueStats {
    const stats = { queued: 0, running: 0, completed: 0, failed: 0, cancelled: 0 };
    const waitTimes: number[] = [];

    for (const item of this.items.values()) {
      stats[item.status]++;
      if (item.startedAt && item.createdAt) {
        const wait = new Date(item.startedAt).getTime() - new Date(item.createdAt).getTime();
        waitTimes.push(wait);
      }
    }

    const avgWaitTime =
      waitTimes.length > 0 ? waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length : 0;

    return { ...stats, avgWaitTime };
  }

  onEnqueue(cb: (item: QueueItem) => void): void {
    this.onEnqueueCb = cb;
  }

  onComplete(cb: (item: QueueItem) => void): void {
    this.onCompleteCb = cb;
  }

  onFail(cb: (item: QueueItem) => void): void {
    this.onFailCb = cb;
  }

  clear(): void {
    this.items.clear();
    this.queue = [];
  }

  private sortQueue(): void {
    this.queue.sort((a, b) => {
      const itemA = this.items.get(a);
      const itemB = this.items.get(b);
      if (!itemA || !itemB) return 0;
      const priorityDiff =
        (PRIORITY_ORDER[itemA.priority] ?? 99) - (PRIORITY_ORDER[itemB.priority] ?? 99);
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(itemA.createdAt).getTime() - new Date(itemB.createdAt).getTime();
    });
  }
}
