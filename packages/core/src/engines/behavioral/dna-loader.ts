import { access, readdir, readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { type DNAPackage, DNAPackageSchema } from '@behavioros/schemas';
import { parse as parseYAML } from 'yaml';
import { sanitizeDNA } from '../../security/dna-sanitizer.js';

// ============================================================
// DNA Loader — Carrega e valida pacotes DNA
// ============================================================

const MAX_YAML_SIZE = 1024 * 1024; // 1MB
const MAX_NESTING_DEPTH = 10;
const MAX_GOVERNANCE_RULES = 1000;

export interface DNALoaderOptions {
  basePath?: string;
  validate?: boolean;
  strict?: boolean;
  sanitize?: boolean;
}

export class DNALoader {
  private basePath: string;
  private validate: boolean;
  private strict: boolean;
  private sanitize: boolean;
  private cache: Map<string, DNAPackage> = new Map();

  constructor(options: DNALoaderOptions = {}) {
    this.basePath = options.basePath ?? process.cwd();
    this.validate = options.validate ?? true;
    this.strict = options.strict ?? false;
    this.sanitize = options.sanitize ?? true;
  }

  /**
   * Carrega um pacote DNA de um diretório ou arquivo
   */
  async load(source: string): Promise<DNAPackage> {
    const resolved = resolve(this.basePath, source);

    // Path traversal protection — resolved path must stay within basePath
    // Skip check for absolute paths (explicit user intent to load from specific location)
    const isAbsolute = source.startsWith('/') || /^[a-zA-Z]:/.test(source);
    if (!isAbsolute && !resolved.startsWith(resolve(this.basePath))) {
      throw new Error(`Path traversal detected: "${source}" resolves outside base path`);
    }

    // Check cache
    if (this.cache.has(resolved)) {
      return this.cache.get(resolved)!;
    }

    let raw: string;

    // Try loading from directory (index.yaml or behavioros.yaml)
    try {
      await access(join(resolved, 'behavioros.yaml'));
      raw = await readFile(join(resolved, 'behavioros.yaml'), 'utf-8');
    } catch {
      try {
        await access(join(resolved, 'index.yaml'));
        raw = await readFile(join(resolved, 'index.yaml'), 'utf-8');
      } catch {
        try {
          await access(resolved);
          const fileStat = await stat(resolved);
          if (fileStat.size > MAX_YAML_SIZE) {
            throw new Error(
              `DNA file too large: ${(fileStat.size / MAX_YAML_SIZE).toFixed(1)}MB exceeds 1MB limit`,
            );
          }
          raw = await readFile(resolved, 'utf-8');
        } catch {
          throw new Error(`DNA source not found: ${source}`);
        }
      }
    }

    if (this.sanitize) {
      this.sanitizeOrThrow(raw, resolved);
    }
    return this.parse(raw, resolved);
  }

  /**
   * Carrega um pacote DNA de uma string YAML
   */
  loadFromString(yamlContent: string, sourceName?: string): DNAPackage {
    if (yamlContent.length > MAX_YAML_SIZE) {
      throw new Error(
        `DNA YAML content exceeds maximum size of ${MAX_YAML_SIZE} bytes ` +
          `(${yamlContent.length} bytes provided)`,
      );
    }
    if (this.sanitize) {
      this.sanitizeOrThrow(yamlContent, sourceName ?? '<inline>');
    }
    return this.parse(yamlContent, sourceName ?? '<inline>');
  }

  /**
   * Carrega um pacote DNA de um objeto JSON
   */
  loadFromObject(obj: unknown): DNAPackage {
    if (DNALoader.getNestingDepth(obj) > MAX_NESTING_DEPTH) {
      throw new Error(`DNA object exceeds maximum nesting depth of ${MAX_NESTING_DEPTH}`);
    }
    if (this.validate) {
      return DNAPackageSchema.parse(obj);
    }
    return obj as DNAPackage;
  }

  /**
   * Carrega todos os pacotes DNA de um diretório
   */
  async loadAll(directory: string): Promise<DNAPackage[]> {
    const dir = resolve(this.basePath, directory);
    const results: DNAPackage[] = [];

    // Scan for .yaml files
    try {
      await access(dir);
      const files = await readdir(dir);
      for (const file of files) {
        if (file.endsWith('.yaml') || file.endsWith('.yml')) {
          try {
            const dna = await this.load(join(directory, file));
            results.push(dna);
          } catch (error) {
            if (this.strict) throw error;
            console.warn(`Failed to load DNA from ${file}: ${error}`);
          }
        }
      }
    } catch {
      // Directory doesn't exist — return empty
    }

    return results;
  }

  private parse(yamlContent: string, source: string): DNAPackage {
    const parsed = parseYAML(yamlContent);

    if (this.validate) {
      const result = DNAPackageSchema.safeParse(parsed);
      if (!result.success) {
        const errors = result.error.errors
          .map((e) => `  - ${e.path.join('.')}: ${e.message}`)
          .join('\n');
        throw new Error(`Invalid DNA package at ${source}:\n${errors}`);
      }

      if (result.data.governance && result.data.governance.length > MAX_GOVERNANCE_RULES) {
        throw new Error(
          `DNA package at ${source} has ${result.data.governance.length} governance rules, ` +
            `exceeding maximum of ${MAX_GOVERNANCE_RULES}`,
        );
      }

      this.cache.set(source, result.data);
      return result.data;
    }

    this.cache.set(source, parsed as DNAPackage);
    return parsed as DNAPackage;
  }

  private sanitizeOrThrow(raw: string, source: string): void {
    const result = sanitizeDNA(raw);

    const riskLevel =
      result.riskScore >= 80
        ? 'critical'
        : result.riskScore >= 60
          ? 'high'
          : result.riskScore >= 30
            ? 'medium'
            : 'low';

    if (riskLevel === 'critical' || riskLevel === 'high') {
      const details = result.violations
        .map((v) => `  - [${v.severity}] ${v.description}${v.location ? ` (${v.location})` : ''}`)
        .join('\n');
      throw new Error(
        `DNA sanitization failed for ${source} (risk: ${riskLevel}, score: ${result.riskScore}):\n${details}`,
      );
    }

    if (riskLevel === 'medium' || riskLevel === 'low') {
      console.warn(
        `DNA sanitization warning for ${source} (risk: ${riskLevel}, score: ${result.riskScore}): ` +
          `${result.violations.length} violation(s) detected`,
      );
    }
  }

  /**
   * Valida um pacote DNA contra o schema
   */
  static validate(dna: unknown): { valid: boolean; errors: string[] } {
    const result = DNAPackageSchema.safeParse(dna);
    if (result.success) {
      return { valid: true, errors: [] };
    }
    return {
      valid: false,
      errors: result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
    };
  }

  /**
   * Mescla dois pacotes DNA
   */
  static merge(base: DNAPackage, override: Partial<DNAPackage>): DNAPackage {
    return {
      ...base,
      ...override,
      personas: override.personas ?? base.personas,
      governance: override.governance ?? base.governance,
      quality: override.quality ?? base.quality,
      patterns: override.patterns ?? base.patterns,
      workflows: override.workflows ?? base.workflows,
      config: { ...base.config, ...override.config },
    };
  }

  clearCache(): void {
    this.cache.clear();
  }

  static getNestingDepth(obj: unknown, depth = 0): number {
    if (depth > MAX_NESTING_DEPTH) return depth;
    if (obj === null || obj === undefined || typeof obj !== 'object') return depth;
    if (Array.isArray(obj)) {
      let maxDepth = depth + 1;
      for (const item of obj) {
        maxDepth = Math.max(maxDepth, DNALoader.getNestingDepth(item, depth + 1));
      }
      return maxDepth;
    }
    let maxDepth = depth + 1;
    for (const value of Object.values(obj as Record<string, unknown>)) {
      maxDepth = Math.max(maxDepth, DNALoader.getNestingDepth(value, depth + 1));
    }
    return maxDepth;
  }
}
