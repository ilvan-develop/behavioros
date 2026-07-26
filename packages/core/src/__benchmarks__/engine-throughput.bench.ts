import { bench, describe } from 'vitest';
import { AITMPLAdapter } from '../engines/adapters/aitmpl-adapter';
import { AIResourceManager } from '../engines/ai-platform/ai-resource-manager';
import { AuditEngine } from '../engines/audit/audit-engine';
import { DNALoader } from '../engines/behavioral/dna-loader';
import { DistributedMemory } from '../engines/cloud/distributed-memory';
import { CognitiveIndex } from '../engines/cognitive/cognitive-index';
import { DecisionEngine } from '../engines/decision/decision-engine';
import { Registry } from '../engines/ecosystem/registry';
import { QueueManager } from '../engines/execution/queue-manager';
import { GovernanceEngine } from '../engines/governance/governance-engine';
import { CapabilityCatalog } from '../engines/integration/capability-catalog';
import { EvaluationEngine } from '../engines/intelligence/evaluation-engine';
import { KnowledgeGraph } from '../engines/knowledge/knowledge-graph';
import { LearningEngine } from '../engines/learning/learning-engine';
import { MissionEngine } from '../engines/mission/mission-engine';
import { LoggingEngine } from '../engines/observability/logging-engine';
import { AutonomousDecomposer } from '../engines/orchestrator/autonomous-decomposer';
import { PipelineEngine } from '../engines/pipeline/pipeline-engine';
import { QualityEngine } from '../engines/quality/quality-engine';
import { ContextRecoveryEngine } from '../engines/recovery/context-recovery-engine';
import { LocalRuntime } from '../engines/runtime/local-runtime';
import { SecretsEngine } from '../engines/security/secrets-engine';

const MINIMAL_DNA = {
  id: 'bench',
  name: 'bench',
  version: '1.0.0',
  personas: [{ id: 'a', name: 'A', role: 'dev' }],
};

describe('adapters', () => {
  bench('AITMPLAdapter', () => {
    new AITMPLAdapter();
  });
});
describe('ai-platform', () => {
  bench('AIResourceManager', () => {
    new AIResourceManager();
  });
});
describe('audit', () => {
  bench('AuditEngine', () => {
    new AuditEngine();
  });
});
describe('behavioral', () => {
  bench('DNALoader', () => {
    new DNALoader();
  });
});
describe('cloud', () => {
  bench('DistributedMemory', () => {
    new DistributedMemory();
  });
});
describe('cognitive', () => {
  bench('CognitiveIndex', () => {
    new CognitiveIndex();
  });
});
describe('decision', () => {
  bench('DecisionEngine', () => {
    new DecisionEngine('majority', 0.6);
  });
});
describe('ecosystem', () => {
  bench('Registry', () => {
    new Registry();
  });
});
describe('execution', () => {
  bench('QueueManager', () => {
    new QueueManager();
  });
});
describe('governance', () => {
  bench('GovernanceEngine', () => {
    new GovernanceEngine([]);
  });
});
describe('integration', () => {
  bench('CapabilityCatalog', () => {
    new CapabilityCatalog();
  });
});
describe('intelligence', () => {
  bench('EvaluationEngine', () => {
    new EvaluationEngine();
  });
});
describe('knowledge', () => {
  bench('KnowledgeGraph', () => {
    new KnowledgeGraph();
  });
});
describe('learning', () => {
  bench('LearningEngine', () => {
    new LearningEngine();
  });
});
describe('mission', () => {
  bench('MissionEngine', () => {
    new MissionEngine();
  });
});
describe('observability', () => {
  bench('LoggingEngine', () => {
    new LoggingEngine();
  });
});
describe('orchestrator', () => {
  bench('AutonomousDecomposer', () => {
    new AutonomousDecomposer();
  });
});
describe('pipeline', () => {
  bench('PipelineEngine', () => {
    new PipelineEngine(MINIMAL_DNA as any);
  });
});
describe('quality', () => {
  bench('QualityEngine', () => {
    new QualityEngine([]);
  });
});
describe('recovery', () => {
  bench('ContextRecoveryEngine', () => {
    new ContextRecoveryEngine();
  });
});
describe('runtime', () => {
  bench('LocalRuntime', () => {
    new LocalRuntime();
  });
});
describe('security', () => {
  bench('SecretsEngine', () => {
    new SecretsEngine('key');
  });
});
