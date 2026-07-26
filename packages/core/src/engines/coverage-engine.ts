import { access, readdir } from 'node:fs/promises';
import { join } from 'node:path';

// ============================================================
// CoverageEngine — Context Coverage Calculation
// Calculates context coverage before task execution by checking
// expected files, configurations, and structural invariants.
// ============================================================

/**
 * CoverageDimension — Configuration and options interface.
 */
export interface CoverageDimension {
  name: string;
  found: number;
  expected: number;
  percentage: number;
  missing: string[];
}

/**
 * CoverageReport — Configuration and options interface.
 */
export interface CoverageReport {
  dimensions: CoverageDimension[];
  totalFound: number;
  totalExpected: number;
  overallPercentage: number;
  passed: boolean;
  timestamp: string;
}

/**
 * CoverageEngineOptions — Configuration and options interface.
 */
export interface CoverageEngineOptions {
  threshold?: number;
}

interface DimensionCheck {
  name: string;
  expected: string[];
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function globMatch(dirPath: string, pattern: string): Promise<string[]> {
  try {
    const entries = await readdir(dirPath);
    const ext = pattern.replace('*.', '');
    return entries.filter((e) => e.endsWith(ext));
  } catch {
    return [];
  }
}

async function dirHasFile(dirPath: string, fileName: string): Promise<boolean> {
  try {
    const entries = await readdir(dirPath);
    return entries.includes(fileName);
  } catch {
    return false;
  }
}

function buildDimensionChecks(): DimensionCheck[] {
  return [
    {
      name: 'architecture',
      expected: ['docs/ARCHITECTURE.md'],
    },
    {
      name: 'dnas',
      expected: ['dnas/'],
    },
    {
      name: 'state',
      expected: ['.agent_state.json'],
    },
    {
      name: 'dependencies',
      expected: ['package.json'],
    },
    {
      name: 'skills',
      expected: ['.opencode/skills/'],
    },
    {
      name: 'governance',
      expected: ['packages/core/src/engines/governance/'],
    },
    {
      name: 'quality',
      expected: ['packages/core/src/engines/quality/'],
    },
    {
      name: 'platform_adapters',
      expected: ['CLAUDE.md'],
    },
    {
      name: 'mcp_tools',
      expected: ['packages/mcp-server/'],
    },
    {
      name: 'documentation',
      expected: ['docs/'],
    },
  ];
}

/**
 * CoverageEngine — Context Coverage Calculation
 *
 * Calculates context coverage before task execution by checking
 * expected files, configurations, and structural invariants.
 * Enforces the Kernel Absoluto rule: "Coverage must be ≥ 90%".
 */
export class CoverageEngine {
  private threshold: number;

  /**
   * Creates a CoverageEngine with an optional coverage threshold.
   *
   * @param options - Configuration options (threshold defaults to 90)
   */
  constructor(options?: CoverageEngineOptions) {
    this.threshold = options?.threshold ?? 90;
  }

  /**
   * Calculates full coverage report for a project path.
   * Checks all dimensions: architecture, DNAs, state, dependencies, skills,
   * governance, quality, platform adapters, MCP tools, and documentation.
   *
   * @param projectPath - Path to the project root
   * @returns A CoverageReport with per-dimension results and overall score
   */
  async calculate(projectPath: string): Promise<CoverageReport> {
    const checks = buildDimensionChecks();
    const dimensions: CoverageDimension[] = [];

    for (const check of checks) {
      const dimension = await this.evaluateDimension(projectPath, check);
      dimensions.push(dimension);
    }

    return this.buildReport(dimensions);
  }

  /**
   * Calculates coverage for specific named dimensions only.
   *
   * @param projectPath - Path to the project root
   * @param dimensionNames - Array of dimension names to check
   * @returns Array of CoverageDimension results for the requested dimensions
   */
  async calculateDimensions(
    projectPath: string,
    dimensionNames: string[],
  ): Promise<CoverageDimension[]> {
    const checks = buildDimensionChecks().filter((c) => dimensionNames.includes(c.name));
    const dimensions: CoverageDimension[] = [];

    for (const check of checks) {
      const dimension = await this.evaluateDimension(projectPath, check);
      dimensions.push(dimension);
    }

    return dimensions;
  }

  /**
   * Checks if a coverage report meets the configured threshold.
   *
   * @param report - The coverage report to evaluate
   * @returns Object with pass/fail status and list of missing items
   */
  checkThreshold(report: CoverageReport): { passed: boolean; missing: string[] } {
    const missing: string[] = [];
    for (const dim of report.dimensions) {
      if (dim.percentage < this.threshold) {
        for (const m of dim.missing) {
          missing.push(`${dim.name}: ${m}`);
        }
      }
    }
    return { passed: report.overallPercentage >= this.threshold, missing };
  }

  /**
   * Generates actionable recommendations to improve coverage.
   *
   * @param report - The coverage report to analyze
   * @returns Array of recommendation strings
   */
  getRecommendations(report: CoverageReport): string[] {
    const recommendations: string[] = [];

    for (const dim of report.dimensions) {
      if (dim.percentage < 100) {
        for (const m of dim.missing) {
          recommendations.push(`Create missing ${dim.name} artifact: ${m}`);
        }
      }
    }

    if (report.overallPercentage < this.threshold) {
      recommendations.unshift(
        `Overall coverage ${report.overallPercentage.toFixed(1)}% is below threshold ${this.threshold}%. Address missing artifacts above.`,
      );
    }

    return recommendations;
  }

  private async evaluateDimension(
    projectPath: string,
    check: DimensionCheck,
  ): Promise<CoverageDimension> {
    const missing: string[] = [];
    let found = 0;

    for (const item of check.expected) {
      const fullPath = join(projectPath, item);

      if (item.endsWith('/')) {
        const dirExists = await fileExists(fullPath);
        if (dirExists) {
          found++;
        } else {
          missing.push(item);
        }
      } else if (item.includes('*.')) {
        const dirPath = join(projectPath, item.split('/*.')[0]);
        const matches = await globMatch(dirPath, item);
        if (matches.length > 0) {
          found += matches.length;
        } else {
          missing.push(item);
        }
      } else if (item.includes('/src/index.ts')) {
        const pkgDir = item.replace('/src/index.ts', '');
        const exists = await dirHasFile(join(projectPath, pkgDir, 'src'), 'index.ts');
        if (exists) {
          found++;
        } else {
          missing.push(item);
        }
      } else {
        const exists = await fileExists(fullPath);
        if (exists) {
          found++;
        } else {
          missing.push(item);
        }
      }
    }

    const expected = check.expected.length;
    const percentage = expected > 0 ? Math.round((found / expected) * 100) : 100;

    return {
      name: check.name,
      found,
      expected,
      percentage,
      missing,
    };
  }

  private buildReport(dimensions: CoverageDimension[]): CoverageReport {
    const totalFound = dimensions.reduce((sum, d) => sum + d.found, 0);
    const totalExpected = dimensions.reduce((sum, d) => sum + d.expected, 0);
    const overallPercentage =
      totalExpected > 0 ? Math.round((totalFound / totalExpected) * 100) : 100;

    return {
      dimensions,
      totalFound,
      totalExpected,
      overallPercentage,
      passed: overallPercentage >= this.threshold,
      timestamp: new Date().toISOString(),
    };
  }
}
