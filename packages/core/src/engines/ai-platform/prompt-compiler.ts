import type { PromptTemplate } from './prompt-registry';

/**
 * CompileOptions — Configuration and options interface.
 */
export interface CompileOptions {
  maxOutputLength?: number;
  stripExcessWhitespace?: boolean;
  validateVariables?: boolean;
}

/**
 * PromptCompiler — prompt compiler.
 *
 * Methods: compile, extractVariables, validate.
 */
export class PromptCompiler {
  compile(
    template: PromptTemplate,
    variables: Record<string, string>,
    options?: CompileOptions,
  ): string {
    if (options?.validateVariables ?? true) {
      const validation = this.validate(template, variables);
      if (!validation.valid) {
        throw new Error(`CompileError: missing variables [${validation.missing.join(', ')}]`);
      }
    }

    let result = template.template;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replaceAll(`{{${key}}}`, value);
    }

    if (options?.stripExcessWhitespace) {
      result = result.replace(/\s+/g, ' ').trim();
    }

    if (options?.maxOutputLength && result.length > options.maxOutputLength) {
      result = result.slice(0, options.maxOutputLength);
    }

    return result;
  }

  extractVariables(text: string): string[] {
    const regex = /\{\{(\w+)\}\}/g;
    const variables = new Set<string>();
    const matches = text.matchAll(regex);
    for (const match of matches) {
      variables.add(match[1]);
    }
    return Array.from(variables);
  }

  validate(
    template: PromptTemplate,
    variables: Record<string, string>,
  ): { valid: boolean; missing: string[]; extra: string[] } {
    const provided = new Set(Object.keys(variables));
    const expected = new Set(template.variables);
    const missing = template.variables.filter((v) => !provided.has(v));
    const extra = Object.keys(variables).filter((v) => !expected.has(v));
    return {
      valid: missing.length === 0,
      missing,
      extra,
    };
  }
}
