/**
 * Open Design Adapter — Bridge to the Open Design system.
 *
 * Provides detection, installation, and listing of design systems
 * via the OD CLI tooling.
 */

import { execSync } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import type { ComponentRegistry } from '@behavioros/schemas';

// ============================================================
// Types
// ============================================================

/**
 * OpenDesignInstallResult — Configuration and options interface.
 */
export interface OpenDesignInstallResult {
  success: boolean;
  error?: string;
}

/**
 * OpenDesignSystem — Configuration and options interface.
 */
export interface OpenDesignSystem {
  id: string;
  name: string;
  tokens: number;
}

/**
 * OpenDesignImportResult — Configuration and options interface.
 */
export interface OpenDesignImportResult {
  success: boolean;
  system?: ComponentRegistry;
  error?: string;
}

// ============================================================
// OpenDesignAdapter
// ============================================================

/**
 * OpenDesignAdapter — ============================================================.
 */
export class OpenDesignAdapter {
  private cliPath = 'od';

  /**
   * Detect whether the Open Design CLI is available.
   */
  async detect(): Promise<boolean> {
    try {
      execSync(`${this.cliPath} --version`, {
        stdio: 'pipe',
        timeout: 5_000,
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Install the Open Design MCP for a given agent type.
   */
  async installMCP(agentType: string): Promise<OpenDesignInstallResult> {
    try {
      const installCommand = `${this.cliPath} mcp install ${agentType}`;
      execSync(installCommand, {
        stdio: 'pipe',
        timeout: 30_000,
      });
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Failed to install Open Design MCP for agent "${agentType}": ${message}`,
      };
    }
  }

  /**
   * List available design systems from Open Design.
   */
  async listDesignSystems(): Promise<OpenDesignSystem[]> {
    try {
      const output = execSync(`${this.cliPath} list design-systems --json`, {
        stdio: 'pipe',
        timeout: 15_000,
        encoding: 'utf-8',
      });

      return this.parseDesignSystemList(output);
    } catch {
      return [];
    }
  }

  /**
   * Import a DESIGN.md file as a design system component.
   */
  async importDesignSystem(path: string): Promise<OpenDesignImportResult> {
    try {
      await access(path);

      const content = await readFile(path, 'utf-8');

      // Parse design system metadata from the markdown
      const nameMatch = content.match(/^#\s+(.+)/m);
      const descMatch = content.match(/## Description\s*\n([^#]+)/);
      const tokenMatch = content.match(/## Design Tokens\s*\n([^#]+)/);

      const tokenCount = tokenMatch
        ? tokenMatch[1].split('\n').filter((l) => l.includes(':')).length
        : 0;

      const system: ComponentRegistry = {
        id: `design-system-${(nameMatch?.[1] ?? 'imported').toLowerCase().replace(/\s+/g, '-')}`,
        type: 'design-system',
        name: nameMatch?.[1] ?? 'Imported Design System',
        source: 'open-design',
        version: '1.0.0',
        status: 'active',
        description: descMatch?.[1]?.trim(),
        dependencies: [],
        tags: ['design-system', 'open-design'],
        metadata: {
          tokenCount,
          sourcePath: path,
        },
        installedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      return { success: true, system };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Failed to import design system from "${path}": ${message}`,
      };
    }
  }

  // ─── Private Helpers ───────────────────────────────────────

  /**
   * Parse the design system list from CLI output.
   */
  private parseDesignSystemList(output: string): OpenDesignSystem[] {
    try {
      const parsed = JSON.parse(output);
      if (Array.isArray(parsed)) {
        return parsed.map((item: Record<string, unknown>) => ({
          id: String(item.id ?? item.name ?? ''),
          name: String(item.name ?? item.id ?? 'Unknown'),
          tokens: Number(item.tokens ?? item.tokenCount ?? 0),
        }));
      }
    } catch {
      // Try parsing as table
      const lines = output.trim().split('\n');
      if (lines.length > 1) {
        // Skip header line
        return lines.slice(1).map((line) => {
          const parts = line.trim().split(/\s+/);
          return {
            id: parts[0] ?? '',
            name: parts[1] ?? parts[0] ?? 'Unknown',
            tokens: Number.parseInt(parts[2] ?? '0', 10) || 0,
          };
        });
      }
    }

    return [];
  }
}
