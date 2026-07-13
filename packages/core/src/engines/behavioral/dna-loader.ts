import { readFileSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { parse as parseYAML } from 'yaml'
import { DNAPackageSchema, type DNAPackage } from '@behavioros/schemas'

// ============================================================
// DNA Loader — Carrega e valida pacotes DNA
// ============================================================

export interface DNALoaderOptions {
  basePath?: string
  validate?: boolean
  strict?: boolean
}

export class DNALoader {
  private basePath: string
  private validate: boolean
  private strict: boolean
  private cache: Map<string, DNAPackage> = new Map()

  constructor(options: DNALoaderOptions = {}) {
    this.basePath = options.basePath ?? process.cwd()
    this.validate = options.validate ?? true
    this.strict = options.strict ?? false
  }

  /**
   * Carrega um pacote DNA de um diretório ou arquivo
   */
  load(source: string): DNAPackage {
    const resolved = resolve(this.basePath, source)

    // Check cache
    if (this.cache.has(resolved)) {
      return this.cache.get(resolved)!
    }

    let raw: string

    // Try loading from directory (index.yaml or behavioros.yaml)
    if (existsSync(join(resolved, 'behavioros.yaml'))) {
      raw = readFileSync(join(resolved, 'behavioros.yaml'), 'utf-8')
    } else if (existsSync(join(resolved, 'index.yaml'))) {
      raw = readFileSync(join(resolved, 'index.yaml'), 'utf-8')
    } else if (existsSync(resolved)) {
      raw = readFileSync(resolved, 'utf-8')
    } else {
      throw new Error(`DNA source not found: ${source}`)
    }

    return this.parse(raw, resolved)
  }

  /**
   * Carrega um pacote DNA de uma string YAML
   */
  loadFromString(yamlContent: string, sourceName?: string): DNAPackage {
    return this.parse(yamlContent, sourceName ?? '<inline>')
  }

  /**
   * Carrega um pacote DNA de um objeto JSON
   */
  loadFromObject(obj: unknown): DNAPackage {
    if (this.validate) {
      return DNAPackageSchema.parse(obj)
    }
    return obj as DNAPackage
  }

  /**
   * Carrega todos os pacotes DNA de um diretório
   */
  loadAll(directory: string): DNAPackage[] {
    const dir = resolve(this.basePath, directory)
    const results: DNAPackage[] = []

    // Scan for .yaml files
    if (existsSync(dir)) {
      const { readdirSync } = require('node:fs')
      const files = readdirSync(dir) as string[]
      for (const file of files) {
        if (file.endsWith('.yaml') || file.endsWith('.yml')) {
          try {
            const dna = this.load(join(directory, file))
            results.push(dna)
          } catch (error) {
            if (this.strict) throw error
            console.warn(`Failed to load DNA from ${file}: ${error}`)
          }
        }
      }
    }

    return results
  }

  private parse(yamlContent: string, source: string): DNAPackage {
    const parsed = parseYAML(yamlContent)

    if (this.validate) {
      const result = DNAPackageSchema.safeParse(parsed)
      if (!result.success) {
        const errors = result.error.errors.map((e) => `  - ${e.path.join('.')}: ${e.message}`).join('\n')
        throw new Error(`Invalid DNA package at ${source}:\n${errors}`)
      }
      this.cache.set(source, result.data)
      return result.data
    }

    this.cache.set(source, parsed as DNAPackage)
    return parsed as DNAPackage
  }

  /**
   * Valida um pacote DNA contra o schema
   */
  static validate(dna: unknown): { valid: boolean; errors: string[] } {
    const result = DNAPackageSchema.safeParse(dna)
    if (result.success) {
      return { valid: true, errors: [] }
    }
    return {
      valid: false,
      errors: result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
    }
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
    }
  }

  clearCache(): void {
    this.cache.clear()
  }
}
