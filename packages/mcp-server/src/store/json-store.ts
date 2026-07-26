import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export async function ensureDir(_dir: string) {
  // noop here — caller ensures dir exists
}

export async function saveMissions(dir: string, missions: unknown[]) {
  const file = resolve(dir, 'missions.json');
  await writeFile(file, JSON.stringify(missions, null, 2), 'utf8');
}

export async function saveLearning(dir: string, events: unknown[]) {
  const file = resolve(dir, 'learning.json');
  await writeFile(file, JSON.stringify(events, null, 2), 'utf8');
}

export async function readMissions(dir: string) {
  const file = resolve(dir, 'missions.json');
  try {
    const raw = await readFile(file, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function readLearning(dir: string) {
  const file = resolve(dir, 'learning.json');
  try {
    const raw = await readFile(file, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}
