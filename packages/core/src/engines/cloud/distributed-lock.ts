import { randomUUID } from 'node:crypto';

/**
 * Lock — Configuration and options interface.
 */
export interface Lock {
  id: string;
  holder: string;
  acquiredAt: string;
  expiresAt: string;
  reentrantCount: number;
}

/**
 * DistributedLock — distributed lock.
 *
 * Methods: acquire, release, isLocked, getLock, getLocksByHolder, forceRelease, and 2 more.
 */
export class DistributedLock {
  private locks: Map<string, Lock> = new Map();

  acquire(lockId: string, holder: string, ttlMs: number = 30_000): Promise<boolean> {
    const now = Date.now();
    const existing = this.locks.get(lockId);

    if (existing) {
      if (new Date(existing.expiresAt).getTime() > now) {
        if (existing.holder === holder) {
          existing.reentrantCount++;
          return Promise.resolve(true);
        }
        return Promise.resolve(false);
      }
      this.locks.delete(lockId);
    }

    this.locks.set(lockId, {
      id: randomUUID(),
      holder,
      acquiredAt: new Date(now).toISOString(),
      expiresAt: new Date(now + ttlMs).toISOString(),
      reentrantCount: 1,
    });

    return Promise.resolve(true);
  }

  release(lockId: string, holder: string): Promise<boolean> {
    const lock = this.locks.get(lockId);
    if (!lock) return Promise.resolve(false);
    if (lock.holder !== holder) return Promise.resolve(false);

    if (lock.reentrantCount > 1) {
      lock.reentrantCount--;
      return Promise.resolve(true);
    }

    this.locks.delete(lockId);
    return Promise.resolve(true);
  }

  isLocked(lockId: string): boolean {
    const lock = this.locks.get(lockId);
    if (!lock) return false;
    if (new Date(lock.expiresAt).getTime() <= Date.now()) {
      this.locks.delete(lockId);
      return false;
    }
    return true;
  }

  getLock(lockId: string): Lock | undefined {
    const lock = this.locks.get(lockId);
    if (!lock) return undefined;
    if (new Date(lock.expiresAt).getTime() <= Date.now()) {
      this.locks.delete(lockId);
      return undefined;
    }
    return { ...lock };
  }

  getLocksByHolder(holder: string): Lock[] {
    const results: Lock[] = [];
    for (const [key, lock] of this.locks) {
      if (new Date(lock.expiresAt).getTime() <= Date.now()) {
        this.locks.delete(key);
        continue;
      }
      if (lock.holder === holder) {
        results.push({ ...lock });
      }
    }
    return results;
  }

  forceRelease(lockId: string): void {
    this.locks.delete(lockId);
  }

  cleanup(): number {
    const now = Date.now();
    let removed = 0;
    for (const [key, lock] of this.locks) {
      if (new Date(lock.expiresAt).getTime() <= now) {
        this.locks.delete(key);
        removed++;
      }
    }
    return removed;
  }

  isHeldByMe(lockId: string, holder: string): boolean {
    const lock = this.locks.get(lockId);
    if (!lock) return false;
    if (new Date(lock.expiresAt).getTime() <= Date.now()) {
      this.locks.delete(lockId);
      return false;
    }
    return lock.holder === holder;
  }
}
