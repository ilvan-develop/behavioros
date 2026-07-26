import { describe, expect, it } from 'vitest';
import { BehaviorOS } from './bos';

describe('BehaviorOS singleton', () => {
  it('exports BehaviorOS class', () => {
    expect(BehaviorOS).toBeDefined();
    expect(typeof BehaviorOS).toBe('function');
  });
});
