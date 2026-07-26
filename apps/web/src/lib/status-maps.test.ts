import { describe, expect, it } from 'vitest';
import {
  actionVariant,
  levelVariant,
  priorityVariant,
  resultVariant,
  severityVariant,
  statusColor,
  statusVariant,
} from './status-maps';

describe('statusColor', () => {
  it('has entries for all agent statuses', () => {
    expect(statusColor).toHaveProperty('idle');
    expect(statusColor).toHaveProperty('working');
    expect(statusColor).toHaveProperty('reviewing');
    expect(statusColor).toHaveProperty('blocked');
    expect(statusColor).toHaveProperty('offline');
  });

  it('returns valid Tailwind bg classes', () => {
    for (const value of Object.values(statusColor)) {
      expect(value).toMatch(/^bg-/);
    }
  });
});

describe('statusVariant', () => {
  it('maps idle to success', () => {
    expect(statusVariant.idle).toBe('success');
  });

  it('maps blocked to destructive', () => {
    expect(statusVariant.blocked).toBe('destructive');
  });

  it('maps failed to destructive', () => {
    expect(statusVariant.failed).toBe('destructive');
  });

  it('maps executing to info', () => {
    expect(statusVariant.executing).toBe('info');
  });
});

describe('priorityVariant', () => {
  it('maps critical to destructive', () => {
    expect(priorityVariant.critical).toBe('destructive');
  });

  it('maps high to warning', () => {
    expect(priorityVariant.high).toBe('warning');
  });
});

describe('severityVariant', () => {
  it('maps info to outline', () => {
    expect(severityVariant.info).toBe('outline');
  });
});

describe('resultVariant', () => {
  it('maps pass to success', () => {
    expect(resultVariant.pass).toBe('success');
  });
});

describe('actionVariant', () => {
  it('maps block to destructive', () => {
    expect(actionVariant.block).toBe('destructive');
  });
});

describe('levelVariant', () => {
  it('maps critical to destructive', () => {
    expect(levelVariant.critical).toBe('destructive');
  });
});
