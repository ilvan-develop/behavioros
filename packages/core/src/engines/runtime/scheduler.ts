import { randomUUID } from 'node:crypto';

/**
 * Schedule — Configuration and options interface.
 */
export interface Schedule {
  id: string;
  name: string;
  type: 'one-shot' | 'recurring';
  cron?: string;
  delay?: number;
  executeAt?: string;
  handler: () => Promise<void>;
  status: 'active' | 'paused' | 'cancelled' | 'executed';
  createdAt: string;
  lastExecutedAt?: string;
  nextExecutionAt?: string;
  executionCount: number;
}

interface CronField {
  values: number[];
  all: boolean;
}

function parseCronField(field: string, min: number, max: number): CronField {
  if (field === '*') return { values: [], all: true };

  const values = new Set<number>();

  for (const part of field.split(',')) {
    const stepMatch = part.match(/^(\*|\d+-\d+|\d+)\/(\d+)$/);
    if (stepMatch) {
      const raw = stepMatch[1];
      const step = Number(stepMatch[2]);
      let start: number;
      let end: number;
      if (raw === '*') {
        start = min;
        end = max;
      } else if (raw.includes('-')) {
        const [s, e] = raw.split('-').map(Number);
        start = s;
        end = Math.min(e, max);
      } else {
        start = Number(raw);
        end = max;
      }
      for (let i = start; i <= end; i += step) {
        if (i >= min && i <= max) values.add(i);
      }
    } else if (part.includes('-')) {
      const [s, e] = part.split('-').map(Number);
      for (let i = Math.max(s, min); i <= Math.min(e, max); i++) {
        values.add(i);
      }
    } else {
      const v = Number(part);
      if (v >= min && v <= max) values.add(v);
    }
  }

  return { values: [...values].sort((a, b) => a - b), all: false };
}

const _ALL_ALLOWED: CronField = { values: [], all: true };

/**
 * parseCron — parsecron.
 * @param cron - Description needed
 * @param maxResults = 10 - Description needed
 * @returns Description of return value
 */
export function parseCron(cron: string, maxResults = 10): Date[] {
  const fields = cron.trim().split(/\s+/);
  if (fields.length !== 6) {
    throw new Error(
      `Expected 6 cron fields (sec min hour day month weekday), got ${fields.length}`,
    );
  }

  const [secField, minField, hourField, dayField, monthField, weekdayField] = fields;

  const allowedSeconds = parseCronField(secField, 0, 59);
  const allowedMinutes = parseCronField(minField, 0, 59);
  const allowedHours = parseCronField(hourField, 0, 23);
  const allowedDays = parseCronField(dayField, 1, 31);
  const allowedMonths = parseCronField(monthField, 1, 12);
  const allowedWeekdays = parseCronField(weekdayField, 0, 6);

  const results: Date[] = [];
  const now = new Date();
  const start = new Date(now);
  start.setSeconds(start.getSeconds() + 1);
  start.setMilliseconds(0);

  const current = new Date(start);

  while (results.length < maxResults) {
    const sec = current.getSeconds();
    const min = current.getMinutes();
    const hour = current.getHours();
    const day = current.getDate();
    const month = current.getMonth() + 1;
    const weekday = current.getDay();

    const secMatch = allowedSeconds.all || allowedSeconds.values.includes(sec);
    const minMatch = allowedMinutes.all || allowedMinutes.values.includes(min);
    const hourMatch = allowedHours.all || allowedHours.values.includes(hour);
    const dayMatch = allowedDays.all || allowedDays.values.includes(day);
    const monthMatch = allowedMonths.all || allowedMonths.values.includes(month);
    const weekdayMatch = allowedWeekdays.all || allowedWeekdays.values.includes(weekday);

    if (secMatch && minMatch && hourMatch && dayMatch && monthMatch && weekdayMatch) {
      results.push(new Date(current));
    }

    current.setSeconds(current.getSeconds() + 1);

    if (current.getTime() - now.getTime() > 365 * 24 * 60 * 60 * 1000) break;
  }

  return results;
}

/**
 * Scheduler — scheduler.
 *
 * Methods: schedule, cancel, clearTimeout, pause, resume, get, and 4 more.
 */
export class Scheduler {
  private schedules: Map<string, Schedule> = new Map();
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private timeoutIds: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private running = false;

  schedule(
    options:
      | { name: string; type: 'one-shot'; delay?: number; executeAt?: string }
      | { name: string; type: 'recurring'; cron: string },
    handler: () => Promise<void>,
  ): string {
    const id = randomUUID();
    const now = new Date().toISOString();
    let nextExecutionAt: string | undefined;

    if (options.type === 'one-shot' && options.executeAt) {
      nextExecutionAt = options.executeAt;
    } else if (options.type === 'recurring' && options.cron) {
      const dates = parseCron(options.cron, 1);
      if (dates.length > 0) {
        nextExecutionAt = dates[0].toISOString();
      }
    } else if (options.type === 'one-shot' && options.delay !== undefined) {
      nextExecutionAt = new Date(Date.now() + options.delay).toISOString();
    }

    const schedule: Schedule = {
      id,
      name: options.name,
      type: options.type,
      cron: options.type === 'recurring' ? options.cron : undefined,
      delay: options.type === 'one-shot' ? options.delay : undefined,
      executeAt: options.type === 'one-shot' ? options.executeAt : undefined,
      handler,
      status: 'active',
      createdAt: now,
      nextExecutionAt,
      executionCount: 0,
    };

    this.schedules.set(id, schedule);

    if (this.running && options.type === 'one-shot' && options.delay !== undefined) {
      this.scheduleOneShotTimer(schedule);
    }

    return id;
  }

  cancel(id: string): void {
    const s = this.schedules.get(id);
    if (!s) return;
    s.status = 'cancelled';
    const timeoutId = this.timeoutIds.get(id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.timeoutIds.delete(id);
    }
  }

  pause(id: string): void {
    const s = this.schedules.get(id);
    if (s?.status !== 'active') return;
    s.status = 'paused';
    const timeoutId = this.timeoutIds.get(id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.timeoutIds.delete(id);
    }
  }

  resume(id: string): void {
    const s = this.schedules.get(id);
    if (s?.status !== 'paused') return;
    s.status = 'active';
    if (s.type === 'recurring' && s.cron) {
      const dates = parseCron(s.cron, 1);
      if (dates.length > 0) {
        s.nextExecutionAt = dates[0].toISOString();
      }
    }
  }

  get(id: string): Schedule | undefined {
    return this.schedules.get(id);
  }

  list(status?: string): Schedule[] {
    const all = [...this.schedules.values()];
    if (status) return all.filter((s) => s.status === status);
    return all;
  }

  start(): void {
    if (this.running) return;
    this.running = true;

    for (const s of this.schedules.values()) {
      if (s.status === 'active' && s.type === 'one-shot' && s.delay !== undefined) {
        this.scheduleOneShotTimer(s);
      }
    }

    this.intervalId = setInterval(() => this.tick(), 1000);
  }

  stop(): void {
    this.running = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    for (const [_id, timeoutId] of this.timeoutIds) {
      clearTimeout(timeoutId);
    }
    this.timeoutIds.clear();
  }

  private scheduleOneShotTimer(schedule: Schedule): void {
    if (schedule.delay === undefined) return;
    const timeoutId = setTimeout(async () => {
      if (schedule.status !== 'active') return;
      await this.executeSchedule(schedule);
    }, schedule.delay);
    this.timeoutIds.set(schedule.id, timeoutId);
  }

  private async tick(): Promise<void> {
    if (!this.running) return;
    const now = Date.now();

    for (const s of this.schedules.values()) {
      if (s.status !== 'active') continue;

      if (s.type === 'one-shot') {
        if (s.executeAt) {
          const execTime = new Date(s.executeAt).getTime();
          if (now >= execTime) {
            await this.executeSchedule(s);
          }
        }
      } else if (s.type === 'recurring' && s.nextExecutionAt) {
        const execTime = new Date(s.nextExecutionAt).getTime();
        if (now >= execTime) {
          await this.executeSchedule(s);
          if (s.status === 'active') {
            const dates = parseCron(s.cron!, 1);
            if (dates.length > 0) {
              s.nextExecutionAt = dates[0].toISOString();
            } else {
              s.status = 'cancelled';
            }
          }
        }
      }
    }
  }

  private async executeSchedule(schedule: Schedule): Promise<void> {
    try {
      await schedule.handler();
      schedule.executionCount++;
      schedule.lastExecutedAt = new Date().toISOString();
      if (schedule.type === 'one-shot') {
        schedule.status = 'executed';
        schedule.nextExecutionAt = undefined;
      }
    } catch {
      schedule.status = schedule.type === 'one-shot' ? 'executed' : 'active';
      schedule.lastExecutedAt = new Date().toISOString();
    }
  }
}
