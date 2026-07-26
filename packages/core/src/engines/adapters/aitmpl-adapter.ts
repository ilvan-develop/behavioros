/**
 * AITMPL Adapter — Bridge to AITMPL marketplace.
 *
 * Provides installation and search capabilities for community skills,
 * MCPs, and prompt templates via the `claude-code-templates` CLI.
 */

import { execSync } from 'node:child_process';
import type { Skill } from '@behavioros/schemas';

// ============================================================
// Types
// ============================================================

/**
 * AITMPLInstallResult — Configuration and options interface.
 */
export interface AITMPLInstallResult {
  success: boolean;
  skill?: Skill;
  error?: string;
}

/**
 * AITMPLMCPInstallResult — Configuration and options interface.
 */
export interface AITMPLMCPInstallResult {
  success: boolean;
  config?: Record<string, unknown>;
  error?: string;
}

/**
 * AITMPLSearchResult — Configuration and options interface.
 */
export interface AITMPLSearchResult {
  id: string;
  name: string;
  category: string;
  stars: number;
}

// ============================================================
// AITMPLAdapter
// ============================================================

/**
 * AITMPLAdapter — ============================================================.
 */
export class AITMPLAdapter {
  /**
   * Install a skill from the AITMPL marketplace.
   *
   * Command: npx claude-code-templates@latest --skill {category}/{skillId}
   */
  async installSkill(category: string, skillId: string): Promise<AITMPLInstallResult> {
    try {
      const installCommand = `npx claude-code-templates@latest --skill ${category}/${skillId}`;

      // Execute the install command
      execSync(installCommand, {
        stdio: 'pipe',
        timeout: 60_000,
      });

      // After install, try to read the installed skill metadata
      const skill: Skill = {
        id: skillId,
        name: skillId,
        version: '1.0.0',
        description: `Skill "${skillId}" in category "${category}"`,
        category: this.mapCategory(category),
        source: 'aitmpl',
        tags: [category],
        installedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      return { success: true, skill };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Failed to install AITMPL skill "${category}/${skillId}": ${message}`,
      };
    }
  }

  /**
   * Install an MCP from the AITMPL marketplace.
   */
  async installMCP(category: string, mcpId: string): Promise<AITMPLMCPInstallResult> {
    try {
      const installCommand = `npx claude-code-templates@latest --mcp ${category}/${mcpId}`;

      execSync(installCommand, {
        stdio: 'pipe',
        timeout: 60_000,
      });

      const config = {
        id: mcpId,
        category,
        type: 'mcp',
        installed: true,
        installedAt: new Date().toISOString(),
      };

      return { success: true, config };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Failed to install AITMPL MCP "${category}/${mcpId}": ${message}`,
      };
    }
  }

  /**
   * Search for skills in the AITMPL marketplace.
   */
  async searchSkills(query: string): Promise<AITMPLSearchResult[]> {
    try {
      const searchCommand = `npx claude-code-templates@latest --search "${query}"`;
      const output = execSync(searchCommand, {
        stdio: 'pipe',
        timeout: 30_000,
        encoding: 'utf-8',
      });

      // Parse the output — AITMPL returns JSON lines
      return this.parseSearchOutput(output);
    } catch {
      // If CLI not available or search fails, return empty
      return [];
    }
  }

  /**
   * Parse search output from AITMPL CLI.
   */
  private parseSearchOutput(output: string): AITMPLSearchResult[] {
    const results: AITMPLSearchResult[] = [];

    for (const line of output.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const parsed = JSON.parse(trimmed);
        results.push({
          id: parsed.id ?? parsed.skillId ?? '',
          name: parsed.name ?? parsed.id ?? 'Unknown',
          category: parsed.category ?? 'custom',
          stars: parsed.stars ?? parsed.score ?? 0,
        });
      } catch {
        // Try parsing tabular output
        const parts = trimmed.split(/\s+/);
        if (parts.length >= 2) {
          results.push({
            id: parts[0],
            name: parts[1],
            category: parts[2] ?? 'custom',
            stars: Number.parseInt(parts[3] ?? '0', 10) || 0,
          });
        }
      }
    }

    return results;
  }

  /**
   * Map AITMPL category string to SkillCategory.
   */
  private mapCategory(category: string): Skill['category'] {
    const categoryMap: Record<string, Skill['category']> = {
      development: 'development',
      'ai-research': 'ai-research',
      'creative-design': 'creative-design',
      utilities: 'utilities',
      'web-data': 'web-data',
      'enterprise-communication': 'enterprise-communication',
      productivity: 'productivity',
      security: 'security',
      devops: 'devops',
      database: 'database',
      design: 'design',
      compliance: 'compliance',
    };

    return categoryMap[category.toLowerCase()] ?? 'custom';
  }
}
