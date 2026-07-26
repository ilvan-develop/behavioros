/**
 * UI-UX Pro Max Adapter — Bridge to the UI-UX Pro Max design skill.
 *
 * Provides access to color palettes, font pairings, styles, and UX
 * guidelines from the installed skill at ~/.opencode/skills/ui-ux-pro-max/.
 *
 * Data format: CSV files in the data/ directory. The adapter parses CSV
 * rows into structured palette, font, and style objects.
 */

import { access, readdir, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

// ============================================================
// Types
// ============================================================

/**
 * UIPalette — Configuration and options interface.
 */
export interface UIPalette {
  name: string;
  colors: string[];
  category: string;
}

/**
 * UIFontPairing — Configuration and options interface.
 */
export interface UIFontPairing {
  name: string;
  headings: string;
  body: string;
  category: string;
}

/**
 * UIStyle — Configuration and options interface.
 */
export interface UIStyle {
  name: string;
  description: string;
  characteristics: string[];
}

// ============================================================
// CSV Parser
// ============================================================

function parseCSV(csv: string): Record<string, string>[] {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((header, i) => {
      row[header] = values[i] ?? '';
    });
    return row;
  });
}

// ============================================================
// UIUXProMaxAdapter
// ============================================================

/**
 * UIUXProMaxAdapter — ============================================================.
 */
export class UIUXProMaxAdapter {
  private skillPath = '';

  /**
   * Detect whether the UI-UX Pro Max skill is installed.
   * Checks ~/.opencode/skills/ui-ux-pro-max/ or the project's
   * .opencode/skills/ui-ux-pro-max/ directory.
   */
  async detect(): Promise<boolean> {
    const possiblePaths = [
      join(homedir(), '.opencode', 'skills', 'ui-ux-pro-max'),
      join(process.cwd(), '.opencode', 'skills', 'ui-ux-pro-max'),
    ];

    for (const path of possiblePaths) {
      try {
        await access(path);
        this.skillPath = path;
        return true;
      } catch {}
    }

    return false;
  }

  /**
   * Get all available color palettes from the UI-UX Pro Max skill.
   */
  async getPalettes(): Promise<UIPalette[]> {
    if (!this.skillPath) {
      const detected = await this.detect();
      if (!detected) return [];
    }

    const palettes: UIPalette[] = [];

    try {
      const dataPath = join(this.skillPath, 'data');
      await access(dataPath);
      const entries = await readdir(dataPath, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const isCSV = entry.name.endsWith('.csv');
        const isJSON = entry.name.endsWith('.json');
        if (!isCSV && !isJSON) continue;
        if (!entry.name.includes('palette') && !entry.name.includes('color')) continue;

        const content = await readFile(join(dataPath, entry.name), 'utf-8');

        if (isCSV) {
          const rows = parseCSV(content);
          for (const row of rows) {
            palettes.push({
              name: row.name ?? entry.name.replace('.csv', ''),
              colors: (row.colors ?? row.palette ?? row.hex ?? '').split(';').filter(Boolean),
              category: row.category ?? 'general',
            });
          }
        } else {
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              palettes.push({
                name: item.name ?? entry.name.replace('.json', ''),
                colors: item.colors ?? item.palette ?? [],
                category: item.category ?? 'general',
              });
            }
          } else if (parsed.palettes && Array.isArray(parsed.palettes)) {
            for (const item of parsed.palettes) {
              palettes.push({
                name: item.name ?? entry.name.replace('.json', ''),
                colors: item.colors ?? [],
                category: item.category ?? 'general',
              });
            }
          }
        }
      }
    } catch {
      // Skill data not available in expected format
    }

    return palettes;
  }

  /**
   * Get all available font pairings from the UI-UX Pro Max skill.
   */
  async getFonts(): Promise<UIFontPairing[]> {
    if (!this.skillPath) {
      const detected = await this.detect();
      if (!detected) return [];
    }

    const fonts: UIFontPairing[] = [];

    try {
      const dataPath = join(this.skillPath, 'data');
      await access(dataPath);
      const entries = await readdir(dataPath, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const isCSV = entry.name.endsWith('.csv');
        const isJSON = entry.name.endsWith('.json');
        if (!isCSV && !isJSON) continue;
        if (!entry.name.includes('font') && !entry.name.includes('typography')) continue;

        const content = await readFile(join(dataPath, entry.name), 'utf-8');

        if (isCSV) {
          const rows = parseCSV(content);
          for (const row of rows) {
            fonts.push({
              name: row.name ?? entry.name.replace('.csv', ''),
              headings: row.headings ?? row.heading ?? row['header font'] ?? '',
              body: row.body ?? row['body font'] ?? '',
              category: row.category ?? 'general',
            });
          }
        } else {
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              fonts.push({
                name: item.name ?? entry.name.replace('.json', ''),
                headings: item.headings ?? item.heading ?? '',
                body: item.body ?? '',
                category: item.category ?? 'general',
              });
            }
          } else if (parsed.fonts && Array.isArray(parsed.fonts)) {
            for (const item of parsed.fonts) {
              fonts.push({
                name: item.name ?? '',
                headings: item.headings ?? item.heading ?? '',
                body: item.body ?? '',
                category: item.category ?? 'general',
              });
            }
          }
        }
      }
    } catch {
      // Skill data not available
    }

    return fonts;
  }

  /**
   * Get all available styles from the UI-UX Pro Max skill.
   */
  async getStyles(): Promise<UIStyle[]> {
    if (!this.skillPath) {
      const detected = await this.detect();
      if (!detected) return [];
    }

    const styles: UIStyle[] = [];

    try {
      const dataPath = join(this.skillPath, 'data');
      await access(dataPath);
      const entries = await readdir(dataPath, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const isCSV = entry.name.endsWith('.csv');
        const isJSON = entry.name.endsWith('.json');
        if (!isCSV && !isJSON) continue;
        if (
          !entry.name.includes('style') &&
          !entry.name.includes('design') &&
          !entry.name.includes('ui')
        ) {
          continue;
        }

        const content = await readFile(join(dataPath, entry.name), 'utf-8');

        if (isCSV) {
          const rows = parseCSV(content);
          for (const row of rows) {
            styles.push({
              name: row.name ?? entry.name.replace('.csv', ''),
              description: row.description ?? row.desc ?? '',
              characteristics: (row.characteristics ?? row.traits ?? row.tags ?? '')
                .split(';')
                .filter(Boolean),
            });
          }
        } else {
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              styles.push({
                name: item.name ?? entry.name.replace('.json', ''),
                description: item.description ?? '',
                characteristics: item.characteristics ?? item.traits ?? [],
              });
            }
          } else if (parsed.styles && Array.isArray(parsed.styles)) {
            for (const item of parsed.styles) {
              styles.push({
                name: item.name ?? '',
                description: item.description ?? '',
                characteristics: item.characteristics ?? item.traits ?? [],
              });
            }
          }
        }
      }
    } catch {
      // Skill data not available
    }

    return styles;
  }

  /**
   * Get UX guidelines for a specific product type.
   */
  async getGuidelines(productType: string): Promise<string[]> {
    if (!this.skillPath) {
      const detected = await this.detect();
      if (!detected) return [];
    }

    try {
      const dataPath = join(this.skillPath, 'data');
      await access(dataPath);
      const entries = await readdir(dataPath, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const isCSV = entry.name.endsWith('.csv');
        const isJSON = entry.name.endsWith('.json');
        if (!isCSV && !isJSON) continue;
        if (!entry.name.includes('guideline') && !entry.name.includes('ux')) continue;

        const content = await readFile(join(dataPath, entry.name), 'utf-8');

        if (isCSV) {
          const rows = parseCSV(content);
          const guidelines: string[] = [];
          for (const row of rows) {
            const rowType = (row.productType ?? row.type ?? row.category ?? '').toLowerCase();
            if (rowType.includes(productType.toLowerCase())) {
              const guideline = row.guideline ?? row.principle ?? row.rule ?? row.description ?? '';
              if (guideline) guidelines.push(guideline);
            }
          }
          if (guidelines.length > 0) return guidelines;
        } else {
          const parsed = JSON.parse(content);
          const guidelines = this.findGuidelinesForProduct(parsed, productType);
          if (guidelines.length > 0) return guidelines;
        }
      }
    } catch {
      // Skill data not available
    }

    return [];
  }

  // ─── Private Helpers ───────────────────────────────────────

  /**
   * Find UX guidelines relevant to a product type.
   */
  private findGuidelinesForProduct(data: unknown, productType: string): string[] {
    const normalizedType = productType.toLowerCase();
    const results: string[] = [];

    if (Array.isArray(data)) {
      for (const item of data) {
        const itemType = String(item.productType ?? item.type ?? item.category ?? '').toLowerCase();
        if (itemType.includes(normalizedType) || normalizedType.includes(itemType)) {
          const guidelines = item.guidelines ?? item.principles ?? item.rules ?? [];
          if (Array.isArray(guidelines)) {
            results.push(...guidelines.map((g: unknown) => String(g)));
          }
        }
      }
    } else if (typeof data === 'object' && data !== null) {
      const obj = data as Record<string, unknown>;
      for (const key of Object.keys(obj)) {
        if (key.toLowerCase().includes(normalizedType)) {
          const guidelines = obj[key];
          if (Array.isArray(guidelines)) {
            results.push(...guidelines.map((g: unknown) => String(g)));
          }
        }
      }

      const topGuidelines = obj.guidelines ?? obj.principles;
      if (Array.isArray(topGuidelines)) {
        results.push(...topGuidelines.map((g: unknown) => String(g)));
      }
    }

    return results;
  }
}
