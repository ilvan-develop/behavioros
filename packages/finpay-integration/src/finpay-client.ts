import { randomUUID } from 'node:crypto';
import type {
  FinPayConfig,
  PaymentEvidence,
  PaymentIntent,
  ReconciliationEntry,
  RefundResult,
  TrustScoreDecision,
  ValidationPipelineResult,
} from './types';

// ============================================================
// FinPay API Client
// ============================================================

export interface FinPayRequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  body?: unknown;
  idempotencyKey?: string;
  correlationId?: string;
}

export interface FinPayClientConfig extends FinPayConfig {
  maxRetries?: number;
  timeoutMs?: number;
}

export class FinPayClient {
  private readonly config: Required<FinPayClientConfig>;
  private requestCount = 0;

  constructor(config: FinPayClientConfig) {
    this.config = {
      maxRetries: 3,
      timeoutMs: 30_000,
      ...config,
    };
  }

  async createPaymentIntent(input: {
    amount: number;
    currency: string;
    customerId: string;
    metadata?: Record<string, unknown>;
  }): Promise<PaymentIntent> {
    const correlationId = randomUUID();
    const result = await this.request<PaymentIntent>({
      method: 'POST',
      path: '/v1/payment-intents',
      body: input,
      correlationId,
    });
    return result;
  }

  async uploadEvidence(
    paymentId: string,
    file: { buffer: Uint8Array; filename: string; mimeType: string },
  ): Promise<PaymentEvidence> {
    const correlationId = randomUUID();
    const boundary = `----FormBoundary${randomUUID()}`;
    const body = this.buildMultipartBody(boundary, file, { paymentId });

    const response = await this.rawRequest('POST', `/v1/payment-intents/${paymentId}/evidence`, {
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'X-Idempotency-Key': randomUUID(),
        'X-Correlation-ID': correlationId,
      },
      body,
    });

    return (await response.json()) as PaymentEvidence;
  }

  async getValidationResult(paymentId: string): Promise<ValidationPipelineResult> {
    const correlationId = randomUUID();
    return this.request<ValidationPipelineResult>({
      method: 'GET',
      path: `/v1/payment-intents/${paymentId}/validation`,
      correlationId,
    });
  }

  async getTrustScore(paymentId: string): Promise<TrustScoreDecision> {
    const correlationId = randomUUID();
    return this.request<TrustScoreDecision>({
      method: 'GET',
      path: `/v1/payment-intents/${paymentId}/trust-score`,
      correlationId,
    });
  }

  async processRefund(paymentId: string, amount: number): Promise<RefundResult> {
    const correlationId = randomUUID();
    return this.request<RefundResult>({
      method: 'POST',
      path: `/v1/payment-intents/${paymentId}/refunds`,
      body: { amount },
      idempotencyKey: randomUUID(),
      correlationId,
    });
  }

  async getReconciliation(paymentId: string): Promise<ReconciliationEntry[]> {
    const correlationId = randomUUID();
    return this.request<ReconciliationEntry[]>({
      method: 'GET',
      path: `/v1/payment-intents/${paymentId}/reconciliation`,
      correlationId,
    });
  }

  // --- Internal HTTP helpers ---

  private async request<T>(options: FinPayRequestOptions): Promise<T> {
    const { method, path, body, idempotencyKey, correlationId } = options;
    const url = `${this.config.baseUrl}${path}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
      'X-Correlation-ID': correlationId ?? randomUUID(),
    };

    if (idempotencyKey) {
      headers['X-Idempotency-Key'] = idempotencyKey;
    }

    const lastError = await this.retry(async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

      try {
        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorBody = await response.text().catch(() => 'unknown');
          throw new FinPayApiError(
            `FinPay API error: ${response.status} ${response.statusText}`,
            response.status,
            errorBody,
            correlationId,
          );
        }

        return (await response.json()) as T;
      } finally {
        clearTimeout(timeout);
      }
    });

    return lastError;
  }

  private async rawRequest(
    method: string,
    path: string,
    options: { headers: Record<string, string>; body: string },
  ): Promise<Response> {
    const url = `${this.config.baseUrl}${path}`;

    return this.retry(async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

      try {
        const response = await fetch(url, {
          method,
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            ...options.headers,
          },
          body: options.body,
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorBody = await response.text().catch(() => 'unknown');
          throw new FinPayApiError(
            `FinPay API error: ${response.status} ${response.statusText}`,
            response.status,
            errorBody,
            options.headers['X-Correlation-ID'],
          );
        }

        return response;
      } finally {
        clearTimeout(timeout);
      }
    });
  }

  private async retry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (error instanceof FinPayApiError && !isRetryableStatus(error.status)) {
          throw error;
        }

        if (attempt < this.config.maxRetries) {
          const delayMs = calculateBackoff(attempt);
          await sleep(delayMs);
        }
      }
    }

    throw lastError ?? new Error('FinPay request failed after retries');
  }

  private buildMultipartBody(
    boundary: string,
    file: { buffer: Uint8Array; filename: string; mimeType: string },
    metadata: Record<string, string>,
  ): string {
    const parts: string[] = [];

    for (const [key, value] of Object.entries(metadata)) {
      parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}`);
    }

    parts.push(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.filename}"\r\nContent-Type: ${file.mimeType}\r\n\r\n<FILE_CONTENT>`,
    );

    parts.push(`--${boundary}--`);

    return parts.join('\r\n');
  }
}

// --- Error class ---

export class FinPayApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: string,
    public readonly correlationId: string | undefined,
  ) {
    super(message);
    this.name = 'FinPayApiError';
  }
}

// --- Helpers ---

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function calculateBackoff(attempt: number): number {
  const baseMs = 200;
  const maxMs = 5_000;
  const jitter = Math.random() * 100;
  return Math.min(baseMs * 2 ** attempt + jitter, maxMs);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
