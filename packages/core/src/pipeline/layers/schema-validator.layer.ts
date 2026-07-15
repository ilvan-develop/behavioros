import type { DispatcherLayerResult, PipelineDispatcherContext } from '../pipeline-context';
import type { PipelineLayer } from './layer.interface';

// ============================================================
// Layer 2 — Schema Validator
// Validates payload against expected schema structure.
// Structural layer: fails fast on invalid payload.
// ============================================================

export interface SchemaValidatorLayerOptions {
  requiredFields?: string[];
  validatePayload?: (payload: Record<string, unknown>) => SchemaValidationResult;
}

export interface SchemaValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class SchemaValidatorLayer implements PipelineLayer {
  readonly id = 'schema';
  readonly name = 'Schema Validator';
  readonly order = 2;

  private requiredFields: string[];
  private customValidator?: (payload: Record<string, unknown>) => SchemaValidationResult;

  constructor(options: SchemaValidatorLayerOptions = {}) {
    this.requiredFields = options.requiredFields ?? ['action'];
    this.customValidator = options.validatePayload;
  }

  shouldExecute(_context: PipelineDispatcherContext): boolean {
    return true;
  }

  async execute(context: PipelineDispatcherContext): Promise<DispatcherLayerResult> {
    const start = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Validate required context fields
      if (!context.action || typeof context.action !== 'string') {
        errors.push('Context action is required and must be a string');
      }

      if (!context.agentId || typeof context.agentId !== 'string') {
        errors.push('Context agentId is required and must be a string');
      }

      if (!context.payload || typeof context.payload !== 'object') {
        errors.push('Context payload is required and must be an object');
      }

      // Check required payload fields
      for (const field of this.requiredFields) {
        if (!(field in (context.payload ?? {}))) {
          errors.push(`Missing required payload field: ${field}`);
        }
      }

      // Run custom validator if provided
      if (this.customValidator && context.payload) {
        const customResult = this.customValidator(context.payload);
        errors.push(...customResult.errors);
        warnings.push(...customResult.warnings);
      }

      // Validate DNA mode
      const validModes = ['conversational', 'transactional', 'hybrid'];
      if (!validModes.includes(context.dnaMode)) {
        errors.push(
          `Invalid DNA mode: ${context.dnaMode}. Must be one of: ${validModes.join(', ')}`,
        );
      }

      const passed = errors.length === 0;
      const score = passed ? (warnings.length === 0 ? 100 : 85) : 0;

      return {
        layerId: this.id,
        layerName: this.name,
        passed,
        score,
        duration: Date.now() - start,
        details: {
          errors,
          warnings,
          fieldsValidated: this.requiredFields.length,
          payloadKeys: context.payload ? Object.keys(context.payload) : [],
        },
        error: passed ? undefined : `Schema validation failed: ${errors.join('; ')}`,
      };
    } catch (error) {
      return {
        layerId: this.id,
        layerName: this.name,
        passed: false,
        score: 0,
        duration: Date.now() - start,
        details: {},
        error: error instanceof Error ? error.message : 'Unknown schema validation error',
      };
    }
  }
}
