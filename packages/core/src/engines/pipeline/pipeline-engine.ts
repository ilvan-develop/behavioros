import { randomUUID } from 'node:crypto';
import type {
  ConversationProtocol,
  DiscoveryQuestion,
  DNAPackage,
  EAARGStep,
  LayerCriteria,
  LayerResult,
  PipelineReport,
  PipelineState,
  RequiredEvidence,
  SkillReference,
} from '@behavioros/schemas';
import { LayerResultSchema, PipelineStateSchema } from '@behavioros/schemas';
import EventEmitter from 'eventemitter3';
import type {
  EvidenceValidationResult,
  GateCheckResult,
  LayerExecutionResult,
  PipelineEngineEvents,
  PipelineOptions,
  SkillValidationResult,
} from './types';

// ============================================================
// Pipeline Engine — EAARG Pipeline Executor
// ============================================================

export class PipelineEngine extends EventEmitter<PipelineEngineEvents> {
  private dna: DNAPackage;
  private state: PipelineState;
  private eaargSteps: EAARGStep[];
  private options: PipelineOptions;

  constructor(dna: DNAPackage, options: PipelineOptions = {}) {
    super();
    this.dna = dna;
    this.options = options;
    this.eaargSteps = this.extractEAARGSteps(dna);
    this.state = this.createInitialState();
  }

  // --- Public API ---

  async start(): Promise<PipelineState> {
    if (this.state.status !== 'created') {
      throw new Error(`Pipeline already started. Status: ${this.state.status}`);
    }

    this.state = {
      ...this.state,
      status: 'running',
      currentLayer: this.options.startLayer ?? 1,
      startedAt: new Date().toISOString(),
    };

    this.emit('pipeline:started', this.state);
    return { ...this.state };
  }

  async advance(): Promise<LayerExecutionResult> {
    this.ensureRunning();

    const currentLayer = this.state.currentLayer;
    if (!currentLayer) {
      throw new Error('No current layer set');
    }

    const step = this.eaargSteps.find((s: EAARGStep) => s.layer === currentLayer);
    if (!step) {
      throw new Error(`No EAARG step found for layer ${currentLayer}`);
    }

    // Mark layer as in progress
    this.emit('layer:started', step.layer, step.layerName);

    const questionsTotal = step.questions.length;
    const criteriaTotal = step.acceptanceCriteria.length;

    const protocol = this.createEmptyProtocol(step);

    const result: LayerExecutionResult = {
      layer: step.layer,
      layerName: step.layerName,
      status: 'in_progress',
      score: 0,
      protocol,
      evidenceCollected: [],
      questionsAnswered: 0,
      questionsTotal,
      criteriaMet: 0,
      criteriaTotal,
      duration: 0,
      timestamp: new Date().toISOString(),
    };

    return result;
  }

  pause(): PipelineState {
    this.ensureRunning();
    this.state = { ...this.state, status: 'paused' };
    this.emit('pipeline:paused', this.state);
    return { ...this.state };
  }

  resume(): PipelineState {
    if (this.state.status !== 'paused') {
      throw new Error(`Cannot resume. Status: ${this.state.status}`);
    }
    this.state = { ...this.state, status: 'running' };
    this.emit('pipeline:resumed', this.state);
    return { ...this.state };
  }

  getState(): PipelineState {
    return { ...this.state, layers: [...this.state.layers] };
  }

  getLayer(layer: number): LayerResult | undefined {
    return this.state.layers.find((l: LayerResult) => l.layer === layer);
  }

  getEAARGStep(layer: number): EAARGStep | undefined {
    return this.eaargSteps.find((s: EAARGStep) => s.layer === layer);
  }

  getEAARGSteps(): EAARGStep[] {
    return [...this.eaargSteps];
  }

  getReport(): PipelineReport {
    const completed = this.state.layers.filter(
      (l: LayerResult) => l.status !== 'pending' && l.status !== 'skip',
    );
    const passed = this.state.layers.filter((l: LayerResult) => l.status === 'pass');
    const failed = this.state.layers.filter((l: LayerResult) => l.status === 'fail');
    const skipped = this.state.layers.filter((l: LayerResult) => l.status === 'skip');

    const overallScore =
      completed.length > 0
        ? Math.round(
            completed.reduce((sum: number, l: LayerResult) => sum + l.score, 0) / completed.length,
          )
        : 0;

    const overallStatus =
      failed.length > 0
        ? 'fail'
        : passed.length === this.eaargSteps.length
          ? 'pass'
          : passed.length > 0
            ? 'partial'
            : 'pending';

    return {
      pipelineId: this.state.id,
      dnaId: this.state.dnaId,
      totalLayers: this.eaargSteps.length,
      completedLayers: completed.length,
      passedLayers: passed.length,
      failedLayers: failed.length,
      skippedLayers: skipped.length,
      overallScore,
      overallStatus,
      layers: [...this.state.layers],
      startedAt: this.state.startedAt,
      completedAt: this.state.completedAt,
      duration:
        this.state.completedAt && this.state.startedAt
          ? new Date(this.state.completedAt).getTime() - new Date(this.state.startedAt).getTime()
          : 0,
      timestamp: new Date().toISOString(),
    };
  }

  async validateLayer(layer: number, evidence: string[]): Promise<LayerExecutionResult> {
    this.ensureRunning();

    const step = this.eaargSteps.find((s: EAARGStep) => s.layer === layer);
    if (!step) {
      throw new Error(`No EAARG step found for layer ${layer}`);
    }

    this.emit('layer:started', step.layer, step.layerName);

    const evidenceResult = this.validateEvidence(step, evidence);
    this.emit('evidence:validated', layer, evidenceResult);

    // Validate skills for this layer
    const skillResults = this.validateSkills(step);
    this.emit('skills:validated', layer, skillResults);

    const questionsTotal = step.questions.length;
    const questionsAnswered = Math.min(questionsTotal, evidence.length);
    const criteriaTotal = step.acceptanceCriteria.length;
    const criteriaMet = evidenceResult.valid
      ? criteriaTotal
      : Math.floor(
          criteriaTotal *
            (evidenceResult.collected.length /
              (evidenceResult.collected.length + evidenceResult.missing.length)),
        );

    // Calculate skills score
    const skillsScore = this.calculateSkillsScore(skillResults);
    const skillsUsed = skillResults
      .filter((r: SkillValidationResult) => r.loaded)
      .map((r: SkillValidationResult) => r.skillId);

    // Combine evidence score with skills score
    const evidenceScore = this.calculateLayerScore(
      questionsAnswered,
      questionsTotal,
      criteriaMet,
      criteriaTotal,
      evidenceResult.valid,
    );
    const score = Math.round(evidenceScore * 0.8 + skillsScore * 0.2);

    const status = evidenceResult.valid && score >= 70 ? 'pass' : 'fail';
    const protocolStatus = status === 'pass' ? 'complete' : 'blocked';

    const protocol = this.buildProtocol(
      step,
      evidence,
      questionsAnswered,
      questionsTotal,
      criteriaMet,
      criteriaTotal,
      protocolStatus,
    );

    const result: LayerExecutionResult = {
      layer: step.layer,
      layerName: step.layerName,
      status,
      score,
      protocol,
      evidenceCollected: evidenceResult.collected,
      questionsAnswered,
      questionsTotal,
      criteriaMet,
      criteriaTotal,
      skillsUsed,
      skillsScore,
      duration: 0,
      timestamp: new Date().toISOString(),
    };

    // Check gates
    const gateResult = this.checkGates(step, result);
    this.emit('layer:gate_checked', step.layer, gateResult);

    // Store result
    const layerResult = this.buildLayerResult(result);
    this.state.layers.push(layerResult);

    if (status === 'pass') {
      this.emit('layer:completed', result);

      // Check if all layers are done
      const allLayersDone = this.state.layers.length >= this.eaargSteps.length;
      if (allLayersDone) {
        this.state = {
          ...this.state,
          status: 'completed',
          completedAt: new Date().toISOString(),
          overallStatus: this.state.layers.every((l: LayerResult) => l.status === 'pass')
            ? 'pass'
            : 'partial',
        };
        this.emit('pipeline:completed', this.state);
      } else {
        // Advance to next layer
        this.advanceToNextLayer();
      }
    } else {
      this.state = { ...this.state, status: 'failed' };
      this.emit('layer:failed', result);
      this.emit('pipeline:failed', this.state, new Error(`Layer ${step.layer} failed gate check`));
    }

    return result;
  }

  checkGatesForLayer(layer: number): GateCheckResult {
    const step = this.eaargSteps.find((s: EAARGStep) => s.layer === layer);
    if (!step) {
      return { passed: false, failedGates: [`Layer ${layer} not found`], warnings: [] };
    }

    const layerResult = this.state.layers.find((l: LayerResult) => l.layer === layer);
    if (!layerResult) {
      return { passed: false, failedGates: [`Layer ${layer} not executed`], warnings: [] };
    }

    const failedGates: string[] = [];
    const warnings: string[] = [];

    // Check quality gates from DNA
    const qualityGates = this.dna.quality ?? [];
    for (const gate of qualityGates) {
      if (gate.type === 'custom' && gate.config) {
        const config = gate.config as Record<string, unknown>;
        if (config.layer === layer) {
          const threshold = gate.threshold ?? 70;
          if (layerResult.score < threshold) {
            failedGates.push(`${gate.name}: score ${layerResult.score} < threshold ${threshold}`);
          }
        }
      }
    }

    // Check acceptance criteria
    for (const criteria of step.acceptanceCriteria) {
      const found = layerResult.protocol.acceptanceCriteria.some(
        (c: LayerCriteria) => c.id === criteria.id,
      );
      if (!found) {
        failedGates.push(`Missing acceptance criteria: ${criteria.description}`);
      }
    }

    return {
      passed: failedGates.length === 0,
      failedGates,
      warnings,
    };
  }

  getProtocol(layer: number): ConversationProtocol | undefined {
    const layerResult = this.state.layers.find((l: LayerResult) => l.layer === layer);
    return layerResult?.protocol;
  }

  getProgress(): { current: number; total: number; percent: number } {
    const current = this.state.currentLayer ?? 0;
    const total = this.eaargSteps.length;
    return {
      current,
      total,
      percent: total > 0 ? Math.round((current / total) * 100) : 0,
    };
  }

  // --- Private Methods ---

  private extractEAARGSteps(dna: DNAPackage): EAARGStep[] {
    const steps: EAARGStep[] = [];
    const workflows = dna.workflows ?? [];

    for (const workflow of workflows) {
      // Check if this workflow has EAARG-specific fields in input
      const input = workflow.input as Record<string, unknown> | undefined;
      if (input && typeof input === 'object' && 'layer' in input && 'layerName' in input) {
        const eaargStep: EAARGStep = {
          ...workflow,
          layer: input.layer as number,
          layerName: input.layerName as string,
          objectives: (input.objectives as string[]) ?? [],
          questions: (input.questions as DiscoveryQuestion[]) ?? [],
          requiredEvidence: (input.requiredEvidence as RequiredEvidence[]) ?? [],
          acceptanceCriteria: (input.acceptanceCriteria as LayerCriteria[]) ?? [],
          rejectionCriteria: (input.rejectionCriteria as LayerCriteria[]) ?? [],
          checklist: (input.checklist as string[]) ?? [],
          nextSteps: (input.nextSteps as string[]) ?? [],
          skills: (input.skills as SkillReference[]) ?? [],
        };
        steps.push(eaargStep);
      }
    }

    // Sort by layer number
    steps.sort((a, b) => a.layer - b.layer);
    return steps;
  }

  private createInitialState(): PipelineState {
    return {
      id: randomUUID(),
      dnaId: this.dna.id,
      status: 'created',
      currentLayer: this.options.startLayer ?? 1,
      layers: [],
      overallScore: 0,
      overallStatus: 'pending',
    };
  }

  private ensureRunning(): void {
    if (this.state.status !== 'running') {
      throw new Error(`Pipeline is not running. Status: ${this.state.status}`);
    }
  }

  private async executeLayer(step: EAARGStep): Promise<LayerExecutionResult> {
    const questionsTotal = step.questions.length;
    const questionsAnswered = 0;
    const criteriaTotal = step.acceptanceCriteria.length;
    const criteriaMet = 0;
    const evidenceCollected: string[] = [];

    // Emit evidence collection event
    this.emit('evidence:collected', step.layer, evidenceCollected);

    const score = this.calculateLayerScore(
      questionsAnswered,
      questionsTotal,
      criteriaMet,
      criteriaTotal,
      false,
    );
    const protocol = this.buildProtocol(
      step,
      evidenceCollected,
      questionsAnswered,
      questionsTotal,
      criteriaMet,
      criteriaTotal,
      'in_progress',
    );

    return {
      layer: step.layer,
      layerName: step.layerName,
      status: 'in_progress',
      score,
      protocol,
      evidenceCollected,
      questionsAnswered,
      questionsTotal,
      criteriaMet,
      criteriaTotal,
      duration: 0,
      timestamp: new Date().toISOString(),
    };
  }

  private checkGates(step: EAARGStep, result: LayerExecutionResult): GateCheckResult {
    const failedGates: string[] = [];
    const warnings: string[] = [];

    // Minimum score threshold
    if (result.score < 70) {
      failedGates.push(`Score ${result.score} below minimum threshold 70`);
    }

    // Check that at least some criteria are met
    if (step.acceptanceCriteria.length > 0 && result.criteriaMet === 0) {
      failedGates.push('No acceptance criteria met');
    }

    // Check required evidence
    const requiredEvidence = step.requiredEvidence.filter((e: RequiredEvidence) => e.required);
    for (const evidence of requiredEvidence) {
      if (!result.evidenceCollected.includes(evidence.id)) {
        warnings.push(`Required evidence not collected: ${evidence.description}`);
      }
    }

    return {
      passed: failedGates.length === 0,
      failedGates,
      warnings,
    };
  }

  private calculateLayerScore(
    questionsAnswered: number,
    questionsTotal: number,
    criteriaMet: number,
    criteriaTotal: number,
    evidenceValid: boolean,
  ): number {
    const questionScore = questionsTotal > 0 ? (questionsAnswered / questionsTotal) * 40 : 40;
    const criteriaScore = criteriaTotal > 0 ? (criteriaMet / criteriaTotal) * 40 : 40;
    const evidenceScore = evidenceValid ? 20 : 0;

    return Math.round(questionScore + criteriaScore + evidenceScore);
  }

  private buildLayerResult(result: LayerExecutionResult): LayerResult {
    return LayerResultSchema.parse({
      layer: result.layer,
      layerName: result.layerName,
      status: result.status,
      score: result.score,
      protocol: result.protocol,
      evidenceCollected: result.evidenceCollected,
      questionsAnswered: result.questionsAnswered,
      questionsTotal: result.questionsTotal,
      criteriaMet: result.criteriaMet,
      criteriaTotal: result.criteriaTotal,
      skillsUsed: result.skillsUsed,
      skillsScore: result.skillsScore,
      duration: result.duration,
      timestamp: result.timestamp,
    });
  }

  private buildProtocol(
    step: EAARGStep,
    evidence: string[],
    questionsAnswered: number,
    questionsTotal: number,
    criteriaMet: number,
    criteriaTotal: number,
    status: 'pending' | 'in_progress' | 'partial' | 'complete' | 'blocked',
  ): ConversationProtocol {
    const completionPercent =
      questionsTotal > 0 ? Math.round((questionsAnswered / questionsTotal) * 100) : 0;

    const completedItems: string[] = [];
    const pendingItems: string[] = [];

    for (const question of step.questions) {
      if (evidence.includes(question.id)) {
        completedItems.push(question.question);
      } else {
        pendingItems.push(question.question);
      }
    }

    return {
      area: step.layerName,
      status,
      completionPercent,
      completedItems,
      pendingItems,
      technicalDebts: [],
      risks: [],
      blockers: status === 'blocked' ? ['Evidence validation failed'] : [],
      evidence,
      acceptanceCriteria: step.acceptanceCriteria,
      nextActions: step.nextSteps,
      recommendation:
        status === 'complete' ? 'proceed' : status === 'blocked' ? 'fix' : 'revalidate',
    };
  }

  private createEmptyProtocol(step: EAARGStep): ConversationProtocol {
    return {
      area: step.layerName,
      status: 'pending',
      completionPercent: 0,
      completedItems: [],
      pendingItems: step.questions.map((q: DiscoveryQuestion) => q.question),
      technicalDebts: [],
      risks: [],
      blockers: [],
      evidence: [],
      acceptanceCriteria: step.acceptanceCriteria,
      nextActions: step.nextSteps,
      recommendation: 'revalidate',
    };
  }

  private validateEvidence(step: EAARGStep, evidence: string[]): EvidenceValidationResult {
    const requiredIds = step.requiredEvidence
      .filter((e: RequiredEvidence) => e.required)
      .map((e: RequiredEvidence) => e.id);
    const collected = evidence.filter(
      (id: string) =>
        requiredIds.includes(id) ||
        step.requiredEvidence.some((e: RequiredEvidence) => e.id === id),
    );
    const missing = requiredIds.filter((id: string) => !evidence.includes(id));
    const extra = evidence.filter(
      (id: string) => !step.requiredEvidence.some((e: RequiredEvidence) => e.id === id),
    );

    return {
      valid: missing.length === 0,
      collected,
      missing,
      extra,
    };
  }

  private validateSkills(step: EAARGStep): SkillValidationResult[] {
    const stepSkills = step.skills ?? [];
    const globalSkills = this.options.skills ?? [];
    const allSkills = [...stepSkills, ...globalSkills];

    // Deduplicate by skillId
    const uniqueSkills = new Map<string, SkillReference>();
    for (const skill of allSkills) {
      if (!uniqueSkills.has(skill.skillId)) {
        uniqueSkills.set(skill.skillId, skill);
      }
    }

    const results: SkillValidationResult[] = [];

    for (const [, skill] of uniqueSkills) {
      // Check if skill is available (in a real implementation, this would check the filesystem)
      const loaded = true; // Assume skills are loaded for now
      const applicable = skill.required || skill.weight > 0;

      // Calculate skill score based on weight and loaded status
      const score = loaded ? Math.round(skill.weight * 100) : 0;

      // Generate recommendations based on skill type
      const recommendations = this.generateSkillRecommendations(skill);

      results.push({
        skillId: skill.skillId,
        skillName: skill.skillName,
        loaded,
        applicable,
        score,
        recommendations,
      });
    }

    return results;
  }

  private calculateSkillsScore(skillResults: SkillValidationResult[]): number {
    if (skillResults.length === 0) return 100;

    const totalScore = skillResults.reduce(
      (sum: number, r: SkillValidationResult) => sum + r.score,
      0,
    );
    return Math.round(totalScore / skillResults.length);
  }

  private generateSkillRecommendations(skill: SkillReference): string[] {
    const recommendations: string[] = [];

    // Base recommendations on skill type
    if (skill.skillId.includes('security')) {
      recommendations.push('Executar análise de vulnerabilidades OWASP');
      recommendations.push('Verificar dependências com known CVEs');
    } else if (skill.skillId.includes('performance')) {
      recommendations.push('Executar testes de carga e stress');
      recommendations.push('Analisar métricas de Core Web Vitals');
    } else if (skill.skillId.includes('qa')) {
      recommendations.push('Garantir cobertura mínima de 80%');
      recommendations.push('Executar testes E2E em todos os fluxos críticos');
    } else if (skill.skillId.includes('frontend')) {
      recommendations.push('Verificar acessibilidade WCAG 2.1 AA');
      recommendations.push('Validar responsividade em múltiplos dispositivos');
    } else if (skill.skillId.includes('backend')) {
      recommendations.push('Validar contratos de API com testes de contrato');
      recommendations.push('Verificar tratamento de erros e logging');
    } else if (skill.skillId.includes('database')) {
      recommendations.push('Analisar performance de queries');
      recommendations.push('Verificar índices e normalização');
    } else if (skill.skillId.includes('devops')) {
      recommendations.push('Verificar configuração de CI/CD');
      recommendations.push('Validar infraestrutura como código');
    } else if (skill.skillId.includes('documentation')) {
      recommendations.push('Garantir documentação de API completa');
      recommendations.push('Verificar exemplos de uso e tutoriais');
    } else if (skill.skillId.includes('ai-engineering')) {
      recommendations.push('Validar governança de IA e ética');
      recommendations.push('Verificar explicabilidade dos modelos');
    }

    return recommendations;
  }

  private advanceToNextLayer(): void {
    if (this.state.currentLayer !== undefined) {
      const nextLayer = this.state.currentLayer + 1;
      const maxLayer = this.options.endLayer ?? this.eaargSteps.length;

      if (nextLayer > maxLayer) {
        // Pipeline completed
        this.state = {
          ...this.state,
          status: 'completed',
          currentLayer: undefined,
          completedAt: new Date().toISOString(),
          overallScore: this.calculateOverallScore(),
          overallStatus: 'pass',
        };
        this.emit('pipeline:completed', this.getReport());
      } else {
        this.state = {
          ...this.state,
          currentLayer: nextLayer,
        };
      }
    }
  }

  private calculateOverallScore(): number {
    const completed = this.state.layers.filter(
      (l: LayerResult) => l.status === 'pass' || l.status === 'fail',
    );
    if (completed.length === 0) return 0;
    return Math.round(
      completed.reduce((sum: number, l: LayerResult) => sum + l.score, 0) / completed.length,
    );
  }
}
