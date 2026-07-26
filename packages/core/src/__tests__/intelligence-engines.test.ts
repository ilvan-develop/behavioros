import { describe, expect, it } from 'vitest';
import { GoalEngine } from '../engines/intelligence/goal-engine';
import { type Intent, IntentEngine } from '../engines/intelligence/intent-engine';
import { MissionCompiler } from '../engines/intelligence/mission-compiler';
import { PlanningEngine, type Task } from '../engines/intelligence/planning-engine';

describe('IntentEngine', () => {
  const engine = new IntentEngine();

  it('should detect build intent from create keywords', () => {
    const result = engine.detect('create a new API endpoint for user management');
    expect(result.type).toBe('build');
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.rawInput).toBe('create a new API endpoint for user management');
  });

  it('should detect build intent from build keyword', () => {
    const result = engine.detect('build a React component for data display');
    expect(result.type).toBe('build');
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('should detect fix intent from bug keyword', () => {
    const result = engine.detect('fix the login bug where users cannot authenticate');
    expect(result.type).toBe('fix');
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('should detect fix intent from error keyword', () => {
    const result = engine.detect('repair the broken payment flow');
    expect(result.type).toBe('fix');
  });

  it('should detect refactor intent', () => {
    const result = engine.detect('refactor the authentication module to use JWT');
    expect(result.type).toBe('refactor');
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('should detect analyze intent', () => {
    const result = engine.detect('analyze the performance of the database queries');
    expect(result.type).toBe('analyze');
  });

  it('should detect deploy intent', () => {
    const result = engine.detect('deploy the latest version to production');
    expect(result.type).toBe('deploy');
  });

  it('should detect learn intent', () => {
    const result = engine.detect('explain how the Prisma ORM works');
    expect(result.type).toBe('learn');
  });

  it('should return custom for unknown input', () => {
    const result = engine.detect('xyzzz unknown gibberish');
    expect(result.type).toBe('custom');
    expect(result.confidence).toBe(0);
  });

  it('should extract technology entities', () => {
    const result = engine.detect('build a REST API with Express and PostgreSQL');
    expect(result.entities.technologies).toBeDefined();
    expect(result.entities.technologies).toContain('express');
    expect(result.entities.technologies).toContain('postgresql');
  });

  it('should set timestamp', () => {
    const result = engine.detect('fix the bug');
    expect(result.timestamp).toBeDefined();
    expect(() => new Date(result.timestamp)).not.toThrow();
  });
});

describe('GoalEngine', () => {
  const engine = new GoalEngine();

  function makeIntent(overrides: Partial<Intent> = {}): Intent {
    return {
      type: 'build',
      confidence: 0.8,
      description: 'Build task',
      rawInput: 'build something',
      entities: {},
      timestamp: new Date().toISOString(),
      ...overrides,
    };
  }

  it('should decompose build intent into architecture, API, validation, tests', () => {
    const intent = makeIntent({ type: 'build' });
    const goals = engine.decompose(intent);

    expect(goals).toHaveLength(4);
    expect(goals[0].title).toBe('Design architecture');
    expect(goals[1].title).toBe('Implement API');
    expect(goals[2].title).toBe('Add validation');
    expect(goals[3].title).toBe('Write tests');
  });

  it('should decompose fix intent into reproduce, identify, fix, verify', () => {
    const intent = makeIntent({ type: 'fix' });
    const goals = engine.decompose(intent);

    expect(goals).toHaveLength(4);
    expect(goals[0].title).toBe('Reproduce bug');
    expect(goals[2].title).toBe('Apply fix');
  });

  it('should decompose refactor intent', () => {
    const intent = makeIntent({ type: 'refactor' });
    const goals = engine.decompose(intent);

    expect(goals).toHaveLength(4);
    expect(goals[0].title).toBe('Analyze current code');
  });

  it('should return single goal for custom intent', () => {
    const intent = makeIntent({ type: 'custom', confidence: 0 });
    const goals = engine.decompose(intent);

    expect(goals).toHaveLength(1);
    expect(goals[0].title).toBe('Process custom request');
  });

  it('should set status to pending for all goals', () => {
    const intent = makeIntent({ type: 'build' });
    const goals = engine.decompose(intent);

    for (const goal of goals) {
      expect(goal.status).toBe('pending');
    }
  });

  it('should include constraints from technologies', () => {
    const intent = makeIntent({
      type: 'build',
      entities: { technologies: ['react', 'node'] },
    });
    const goals = engine.decompose(intent);

    for (const goal of goals) {
      expect(goal.constraints.length).toBeGreaterThan(0);
      expect(goal.constraints[0]).toContain('react');
    }
  });
});

describe('PlanningEngine', () => {
  const engine = new PlanningEngine();
  const goalEngine = new GoalEngine();

  it('should create a plan with tasks from goals', () => {
    const intent: Intent = {
      type: 'build',
      confidence: 0.8,
      description: 'Build task',
      rawInput: 'build something',
      entities: {},
      timestamp: new Date().toISOString(),
    };
    const goals = goalEngine.decompose(intent);
    const plan = engine.createPlan('Test Mission', goals);

    expect(plan.id).toBeDefined();
    expect(plan.missionTitle).toBe('Test Mission');
    expect(plan.goals).toHaveLength(4);
    expect(plan.tasks.length).toBeGreaterThan(0);
    expect(plan.dependencyGraph.size).toBe(plan.tasks.length);
  });

  it('should not detect cycle in a valid DAG', () => {
    const tasks: Task[] = [
      {
        id: '1',
        title: 'Task A',
        description: '',
        status: 'pending',
        priority: 'medium',
        dependencies: [],
        estimatedDuration: 10,
      },
      {
        id: '2',
        title: 'Task B',
        description: '',
        status: 'pending',
        priority: 'medium',
        dependencies: ['1'],
        estimatedDuration: 10,
      },
      {
        id: '3',
        title: 'Task C',
        description: '',
        status: 'pending',
        priority: 'medium',
        dependencies: ['2'],
        estimatedDuration: 10,
      },
    ];

    expect(engine.detectCycle(tasks)).toBeNull();
  });

  it('should detect a cycle in dependencies', () => {
    const tasks: Task[] = [
      {
        id: '1',
        title: 'Task A',
        description: '',
        status: 'pending',
        priority: 'medium',
        dependencies: ['3'],
        estimatedDuration: 10,
      },
      {
        id: '2',
        title: 'Task B',
        description: '',
        status: 'pending',
        priority: 'medium',
        dependencies: ['1'],
        estimatedDuration: 10,
      },
      {
        id: '3',
        title: 'Task C',
        description: '',
        status: 'pending',
        priority: 'medium',
        dependencies: ['2'],
        estimatedDuration: 10,
      },
    ];

    const cycle = engine.detectCycle(tasks);
    expect(cycle).not.toBeNull();
    expect(cycle!.length).toBeGreaterThanOrEqual(2);
  });

  it('should topological sort tasks correctly', () => {
    const tasks: Task[] = [
      {
        id: '2',
        title: 'Task B',
        description: '',
        status: 'pending',
        priority: 'medium',
        dependencies: ['1'],
        estimatedDuration: 10,
      },
      {
        id: '1',
        title: 'Task A',
        description: '',
        status: 'pending',
        priority: 'medium',
        dependencies: [],
        estimatedDuration: 10,
      },
      {
        id: '3',
        title: 'Task C',
        description: '',
        status: 'pending',
        priority: 'medium',
        dependencies: ['1', '2'],
        estimatedDuration: 10,
      },
    ];

    const sorted = engine.topologicalSort(tasks);
    const sortedIds = sorted.map((t) => t.id);

    expect(sortedIds.indexOf('1')).toBeLessThan(sortedIds.indexOf('2'));
    expect(sortedIds.indexOf('1')).toBeLessThan(sortedIds.indexOf('3'));
    expect(sortedIds.indexOf('2')).toBeLessThan(sortedIds.indexOf('3'));
  });

  it('should handle tasks with no dependencies', () => {
    const tasks: Task[] = [
      {
        id: '1',
        title: 'Task A',
        description: '',
        status: 'pending',
        priority: 'medium',
        dependencies: [],
        estimatedDuration: 10,
      },
      {
        id: '2',
        title: 'Task B',
        description: '',
        status: 'pending',
        priority: 'medium',
        dependencies: [],
        estimatedDuration: 10,
      },
    ];

    const sorted = engine.topologicalSort(tasks);
    expect(sorted).toHaveLength(2);
  });
});

describe('MissionCompiler', () => {
  const compiler = new MissionCompiler();
  const goalEngine = new GoalEngine();
  const planningEngine = new PlanningEngine();

  it('should compile a plan into an executable workflow', () => {
    const intent: Intent = {
      type: 'build',
      confidence: 0.8,
      description: 'Build task',
      rawInput: 'build an API',
      entities: {},
      timestamp: new Date().toISOString(),
    };
    const goals = goalEngine.decompose(intent);
    const plan = planningEngine.createPlan('Build API', goals);
    const workflow = compiler.compile(plan);

    expect(workflow.missionId).toBe(plan.id);
    expect(workflow.steps.length).toBeGreaterThan(0);
    expect(workflow.totalEstimatedDuration).toBeGreaterThan(0);
  });

  it('should assign correct step types', () => {
    const intent: Intent = {
      type: 'build',
      confidence: 0.8,
      description: 'Build task',
      rawInput: 'build something',
      entities: {},
      timestamp: new Date().toISOString(),
    };
    const goals = goalEngine.decompose(intent);
    const plan = planningEngine.createPlan('Test', goals);
    const workflow = compiler.compile(plan);

    for (const step of workflow.steps) {
      expect(['execute', 'decision', 'parallel', 'gate', 'notify']).toContain(step.type);
    }
  });

  it('should generate unique step IDs', () => {
    const intent: Intent = {
      type: 'build',
      confidence: 0.8,
      description: 'Build task',
      rawInput: 'build an app',
      entities: {},
      timestamp: new Date().toISOString(),
    };
    const goals = goalEngine.decompose(intent);
    const plan = planningEngine.createPlan('Test', goals);
    const workflow = compiler.compile(plan);

    const ids = workflow.steps.map((s) => s.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('should set retry count based on step type', () => {
    const intent: Intent = {
      type: 'deploy',
      confidence: 0.8,
      description: 'Deploy task',
      rawInput: 'deploy to production',
      entities: {},
      timestamp: new Date().toISOString(),
    };
    const goals = goalEngine.decompose(intent);
    const plan = planningEngine.createPlan('Deploy', goals);
    const workflow = compiler.compile(plan);

    for (const step of workflow.steps) {
      if (step.type === 'gate') {
        expect(step.retryCount).toBe(0);
      }
    }
  });
});

describe('Full Flow: Intent → Goal → Plan → Workflow', () => {
  const intentEngine = new IntentEngine();
  const goalEngine = new GoalEngine();
  const planningEngine = new PlanningEngine();
  const compiler = new MissionCompiler();

  it('should process a build request end-to-end', () => {
    const intent = intentEngine.detect('build a REST API with Express and PostgreSQL');

    expect(intent.type).toBe('build');
    expect(intent.entities.technologies).toContain('express');

    const goals = goalEngine.decompose(intent);
    expect(goals.length).toBeGreaterThan(0);

    const plan = planningEngine.createPlan('Build REST API', goals);
    expect(plan.tasks.length).toBeGreaterThan(goals.length);

    const cycle = planningEngine.detectCycle(plan.tasks);
    expect(cycle).toBeNull();

    const workflow = compiler.compile(plan);
    expect(workflow.steps.length).toBeGreaterThan(0);
    expect(workflow.totalEstimatedDuration).toBeGreaterThan(0);
  });

  it('should process a fix request end-to-end', () => {
    const intent = intentEngine.detect('fix the login bug where session expires incorrectly');

    expect(intent.type).toBe('fix');

    const goals = goalEngine.decompose(intent);
    expect(goals).toHaveLength(4);

    const plan = planningEngine.createPlan('Fix Login Bug', goals);
    expect(planningEngine.detectCycle(plan.tasks)).toBeNull();

    const workflow = compiler.compile(plan);
    expect(workflow.steps.length).toBeGreaterThan(0);
  });

  it('should process a refactor request end-to-end', () => {
    const intent = intentEngine.detect('refactor the user module to use clean architecture');

    expect(intent.type).toBe('refactor');

    const goals = goalEngine.decompose(intent);
    expect(goals).toHaveLength(4);

    const plan = planningEngine.createPlan('Refactor User Module', goals);
    expect(planningEngine.detectCycle(plan.tasks)).toBeNull();

    const workflow = compiler.compile(plan);
    expect(workflow.steps.length).toBeGreaterThan(0);
  });
});
