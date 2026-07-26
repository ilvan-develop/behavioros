import { describe, expect, it } from 'vitest';
import { ReasoningEngine, type ReasoningType } from '../engines/intelligence/reasoning-engine';
import { StrategyEngine } from '../engines/intelligence/strategy-engine';

describe('StrategyEngine', () => {
  const engine = new StrategyEngine();

  it('should create a vision-level strategy', () => {
    const id = engine.create(
      'vision',
      'Company Vision 2030',
      'Become market leader in AI governance',
      ['Achieve 90% market share', 'Expand to 50 countries'],
    );
    const strategy = engine.get(id);
    expect(strategy).toBeDefined();
    expect(strategy!.level).toBe('vision');
    expect(strategy!.status).toBe('active');
    expect(strategy!.name).toBe('Company Vision 2030');
  });

  it('should create a strategic-level strategy with parent', () => {
    const visionId = engine.create('vision', 'Vision', 'Top level', ['Goal']);
    const id = engine.create(
      'strategic',
      'Market Expansion',
      'Expand into APAC region',
      ['Enter Japan market', 'Enter India market'],
      ['Budget < $5M'],
      visionId,
    );
    const strategy = engine.get(id);
    expect(strategy).toBeDefined();
    expect(strategy!.level).toBe('strategic');
    expect(strategy!.parentId).toBe(visionId);
    expect(strategy!.constraints).toContain('Budget < $5M');
  });

  it('should create a tactical-level strategy', () => {
    const id = engine.create(
      'tactical',
      'Q3 OKRs',
      'Quarterly objectives',
      ['Ship v2.0', 'Hire 5 engineers'],
      ['Headcount freeze', 'No overtime'],
    );
    const strategy = engine.get(id);
    expect(strategy!.level).toBe('tactical');
    expect(strategy!.constraints).toHaveLength(2);
  });

  it('should return undefined for non-existent strategy', () => {
    expect(engine.get('non-existent')).toBeUndefined();
  });

  it('should get strategies by level', () => {
    const visionId = engine.create('vision', 'V2', 'Vision', ['X']);
    const strategicId = engine.create('strategic', 'S1', 'Strategic', ['Y'], [], visionId);
    engine.create('tactical', 'T1', 'Tactical', ['Z'], [], strategicId);

    const visions = engine.getByLevel('vision');
    const strategics = engine.getByLevel('strategic');
    const tacticals = engine.getByLevel('tactical');

    expect(visions.length).toBeGreaterThanOrEqual(1);
    expect(strategics.length).toBeGreaterThanOrEqual(1);
    expect(tacticals.length).toBeGreaterThanOrEqual(1);
    expect(visions.every((s) => s.level === 'vision')).toBe(true);
  });

  it('should return full tree from root strategy', () => {
    const rootId = engine.create('vision', 'Root', 'Root vision', ['A']);
    const childId = engine.create('strategic', 'Child', 'Child strategic', ['B'], [], rootId);
    engine.create('tactical', 'Grandchild', 'Grandchild tactical', ['C'], [], childId);

    const tree = engine.getTree(rootId);
    expect(tree.length).toBe(3);
    expect(tree[0].id).toBe(rootId);
    expect(tree.some((s) => s.id === childId)).toBe(true);
  });

  it('should return empty tree for non-existent root', () => {
    const tree = engine.getTree('does-not-exist');
    expect(tree).toEqual([]);
  });

  it('should supersede a strategy', () => {
    const id = engine.create('strategic', 'Old Plan', 'Old plan', ['X']);
    const newId = engine.create('strategic', 'New Plan', 'New plan', ['Y']);
    engine.supersede(id, newId);

    const strategy = engine.get(id);
    expect(strategy!.status).toBe('superseded');
  });

  it('should complete a strategy', () => {
    const id = engine.create('tactical', 'Sprint 1', 'First sprint', ['Task']);
    engine.complete(id);

    const strategy = engine.get(id);
    expect(strategy!.status).toBe('completed');
  });

  it('should cancel a strategy', () => {
    const id = engine.create('tactical', 'Cancelled Initiative', 'Wont do', ['X']);
    engine.cancel(id);

    const strategy = engine.get(id);
    expect(strategy!.status).toBe('cancelled');
  });

  it('should list all strategies', () => {
    const before = engine.list().length;
    engine.create('vision', 'List Test', 'Testing list', ['A']);
    engine.create('strategic', 'List Test 2', 'More testing', ['B']);
    expect(engine.list().length).toBe(before + 2);
  });
});

describe('ReasoningEngine', () => {
  const engine = new ReasoningEngine();

  it('should perform deductive reasoning with valid premises', () => {
    const step = engine.deductive(
      ['All humans are mortal', 'Socrates is a human'],
      ['Modus ponens'],
    );
    expect(step.type).toBe('deductive');
    expect(step.confidence).toBeGreaterThan(0);
    expect(step.conclusion).toContain('All humans are mortal');
    expect(step.conclusion).toContain('Modus ponens');
  });

  it('should return zero confidence deductive for empty premises', () => {
    const step = engine.deductive([], []);
    expect(step.confidence).toBe(0);
    expect(step.conclusion).toBe('No valid deduction possible');
  });

  it('should perform inductive reasoning with observations', () => {
    const step = engine.inductive(['Sun rose yesterday', 'Sun rose today'], 'Sun rises every day');
    expect(step.type).toBe('inductive');
    expect(step.conclusion).toBe('Sun rises every day');
    expect(step.confidence).toBeGreaterThan(0.5);
  });

  it('should return zero confidence inductive with no observations', () => {
    const step = engine.inductive([], 'Empty generalization');
    expect(step.confidence).toBe(0);
  });

  it('should perform abductive reasoning selecting best hypothesis', () => {
    const step = engine.abductive('The grass is wet', ['It rained', 'Sprinklers were on']);
    expect(step.type).toBe('abductive');
    expect(step.conclusion).toContain('Best explanation');
    expect(step.conclusion).toContain('It rained');
    expect(step.confidence).toBeGreaterThan(0);
    expect(step.confidence).toBeLessThanOrEqual(0.5);
  });

  it('should handle abductive with no hypotheses', () => {
    const step = engine.abductive('Something happened', []);
    expect(step.conclusion).toBe('No hypotheses provided');
    expect(step.confidence).toBe(0);
  });

  it('should create a multi-step reasoning chain', () => {
    const chain = engine.chain([
      {
        type: 'deductive' as ReasoningType,
        input: ['All birds can fly', 'Penguin is a bird'],
        context: ['Modus ponens'],
      },
      {
        type: 'inductive' as ReasoningType,
        input: ['Penguin cannot fly', 'Ostrich cannot fly'],
        context: ['Flightless birds exist'],
      },
    ]);
    expect(chain.steps).toHaveLength(2);
    expect(chain.steps[0].type).toBe('deductive');
    expect(chain.steps[1].type).toBe('inductive');
    expect(chain.id).toBeDefined();
  });

  it('should calculate overall confidence as average of steps', () => {
    const chain = engine.chain([
      {
        type: 'deductive' as ReasoningType,
        input: ['Premise 1', 'Premise 2'],
        context: ['Rule 1'],
      },
      {
        type: 'inductive' as ReasoningType,
        input: ['Obs 1', 'Obs 2'],
        context: ['Generalization'],
      },
    ]);
    const expectedAvg = (chain.steps[0].confidence + chain.steps[1].confidence) / 2;
    expect(chain.overallConfidence).toBeCloseTo(expectedAvg, 5);
  });

  it('should return zero overall confidence for empty chain', () => {
    const chain = engine.chain([]);
    expect(chain.overallConfidence).toBe(0);
    expect(chain.finalConclusion).toBe('');
  });

  it('should retrieve a stored chain by id', () => {
    const chain = engine.chain([
      {
        type: 'deductive' as ReasoningType,
        input: ['A is B', 'B is C'],
        context: ['Transitivity'],
      },
    ]);
    const retrieved = engine.getChain(chain.id);
    expect(retrieved).toBeDefined();
    expect(retrieved!.id).toBe(chain.id);
    expect(retrieved!.steps).toHaveLength(1);
  });

  it('should return undefined for non-existent chain', () => {
    expect(engine.getChain('non-existent')).toBeUndefined();
  });

  it('should propagate confidence through chain steps', () => {
    const chain = engine.chain([
      {
        type: 'deductive' as ReasoningType,
        input: ['X'],
        context: ['Rule'],
      },
    ]);
    const step = chain.steps[0];
    expect(step.confidence).toBeGreaterThan(0.4);
    expect(step.confidence).toBeLessThanOrEqual(1);
  });
});
