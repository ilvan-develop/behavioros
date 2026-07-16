// ============================================================
// Prompt Simulator — Define and run prompt scenarios
// ============================================================

export interface PromptScenario {
  id: string;
  name: string;
  prompt: string;
  expectedBehavior: string;
  metadata: Record<string, unknown>;
}

export class PromptSimulator {
  private scenarios: PromptScenario[] = [];

  addScenario(scenario: PromptScenario): void {
    this.scenarios.push(scenario);
  }

  simulate(scenarioId: string): { prompt: string; simulated: boolean } {
    const scenario = this.scenarios.find((s) => s.id === scenarioId);
    if (!scenario) {
      throw new Error(`Scenario ${scenarioId} not found`);
    }

    return {
      prompt: scenario.prompt,
      simulated: true,
    };
  }

  getScenarios(): PromptScenario[] {
    return [...this.scenarios];
  }

  clear(): void {
    this.scenarios = [];
  }

  get count(): number {
    return this.scenarios.length;
  }
}
