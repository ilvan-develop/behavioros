# ADR-018: MLOps Adapters

**Status:** Accepted  
**Date:** 2026-07-21  
**Deciders:** BehaviorOS Architecture Team  

---

## Context

Machine learning workflow management — experiment tracking, model registry, evaluation, and monitoring — is a well-solved problem with mature platforms. Building custom MLOps tooling would duplicate effort and miss integration with existing ML ecosystems.

## Decision

We define `MLOpsAdapter` and `LMEvalAdapter` interfaces with adapters for leading solutions:

```typescript
interface MLOpsAdapter {
  logExperiment(params: ExperimentParams): Promise<void>
  registerModel(model: ModelArtifact): Promise<ModelVersion>
  deployModel(version: ModelVersion, target: DeploymentTarget): Promise<void>
  monitorDrift(modelId: string): Promise<DriftReport>
}

interface LMEvalAdapter {
  evaluate(prompt: string, expected: string): Promise<EvaluationResult>
  runSuite(suite: EvalSuite): Promise<EvalReport>
  logFeedback(feedback: HumanFeedback): Promise<void>
}
```

Supported adapters:
1. **MLflow** — Experiment tracking and model registry
2. **Kubeflow** — Kubernetes-native ML pipelines
3. **Weights & Biases** — Experiment tracking and visualization
4. **OpenAI Evals** — LLM evaluation framework
5. **LangSmith** — LLM observability and evaluation
6. **Phoenix** — ML observability and debugging

## Consequences

### Positive

- Leverage best-in-class MLOps platforms
- Consistent ML workflow across the platform
- Swap MLOps backends without application changes
- LLM evaluation integrated into the platform

### Negative

- Adapter maintenance for each MLOps provider
- Feature gaps between provider capabilities
- Increased dependency surface for ML workflows

### Risks

- MLOps vendor consolidation may obsolete adapters (mitigated by generic interface design)
- Evaluation methodology differences across providers (mitigated by standardized eval schemas)

---

*ADR-018: MLOps Adapters — Accepted 2026-07-21*
