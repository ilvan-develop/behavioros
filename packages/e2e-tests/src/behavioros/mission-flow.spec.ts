import { test, expect } from '@playwright/test';
import { BehaviorOS } from '@behavioros/sdk';
import type { DNAPackage } from '@behavioros/schemas';

const testDNA: DNAPackage = {
  id: 'test-dna',
  name: 'Test DNA',
  version: '1.0.0',
  description: 'Test DNA for mission flow',
  personas: [
    { role: 'engineer', authority: 'senior', name: 'Test Engineer' },
  ],
  governance: [],
  quality: [],
};

test.describe('Mission Lifecycle', () => {
  let bos: BehaviorOS;

  test.beforeEach(() => {
    bos = new BehaviorOS({ dnaPackage: testDNA });
  });

  test('creates a mission successfully', async () => {
    const mission = await bos.createMission({
      title: 'Implement login',
      type: 'feature',
      priority: 'high',
    });

    expect(mission).toBeDefined();
    expect(mission.title).toBe('Implement login');
    expect(mission.type).toBe('feature');
    expect(mission.priority).toBe('high');
    expect(mission.status).toBe('draft');
    expect(mission.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  test('starts a mission and transitions to in_progress', async () => {
    const mission = await bos.createMission({
      title: 'Fix auth bug',
      type: 'bugfix',
      priority: 'critical',
    });

    const started = await bos.startMission(mission.id);

    expect(started.id).toBe(mission.id);
    expect(started.status).toBe('executing');
  });

  test('completes a mission successfully', async () => {
    const mission = await bos.createMission({
      title: 'Add dashboard',
      type: 'feature',
      priority: 'medium',
    });

    await bos.startMission(mission.id);
    const completed = await bos.completeMission(mission.id, { pr: '#42' });

    expect(completed.id).toBe(mission.id);
    expect(completed.status).toBe('completed');
    expect(completed.output).toEqual({ pr: '#42' });
  });

  test('fails a mission with an error', async () => {
    const mission = await bos.createMission({
      title: 'Flaky test fix',
      type: 'bugfix',
      priority: 'low',
    });

    await bos.startMission(mission.id);
    const failed = await bos.failMission(
      mission.id,
      new Error('Timeout waiting for selector'),
    );

    expect(failed.id).toBe(mission.id);
    expect(failed.status).toBe('failed');
  });

  test('lists all created missions', async () => {
    await bos.createMission({ title: 'Mission A', type: 'feature' });
    await bos.createMission({ title: 'Mission B', type: 'bugfix' });
    await bos.createMission({ title: 'Mission C', type: 'refactor' });

    const missions = bos.getAllMissions();

    expect(missions.length).toBe(3);
    expect(missions.map((m) => m.title)).toContain('Mission A');
    expect(missions.map((m) => m.title)).toContain('Mission B');
    expect(missions.map((m) => m.title)).toContain('Mission C');
  });
});
