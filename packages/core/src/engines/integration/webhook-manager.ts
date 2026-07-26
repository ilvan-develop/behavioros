import { randomUUID } from 'node:crypto';

/**
 * Webhook — Configuration and options interface.
 */
export interface Webhook {
  id: string;
  url: string;
  events: string[];
  secret: string;
  headers?: Record<string, string>;
  retryCount: number;
  maxRetries: number;
  createdAt: string;
}

interface DeliveryRecord {
  webhookId: string;
  event: string;
  delivered: boolean;
  statusCode?: number;
  timestamp: string;
}

/**
 * WebhookManager — webhook manager.
 *
 * Methods: register, unregister, deliver, list, getDeliveryHistory.
 */
export class WebhookManager {
  private webhooks = new Map<string, Webhook>();
  private deliveryHistory: DeliveryRecord[] = [];

  register(
    url: string,
    events: string[],
    secret: string,
    headers?: Record<string, string>,
  ): string {
    const id = randomUUID();
    const webhook: Webhook = {
      id,
      url,
      events,
      secret,
      headers,
      retryCount: 0,
      maxRetries: 3,
      createdAt: new Date().toISOString(),
    };
    this.webhooks.set(id, webhook);
    return id;
  }

  unregister(id: string): void {
    if (!this.webhooks.has(id)) {
      throw new Error(`Webhook not found: ${id}`);
    }
    this.webhooks.delete(id);
  }

  async deliver(
    event: string,
    payload: unknown,
  ): Promise<{ webhookId: string; delivered: boolean; statusCode?: number }[]> {
    const matched = Array.from(this.webhooks.values()).filter((w) => w.events.includes(event));
    if (matched.length === 0) return [];

    const results: { webhookId: string; delivered: boolean; statusCode?: number }[] = [];

    for (const webhook of matched) {
      let delivered = false;
      let statusCode: number | undefined;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Webhook-Event': event,
        'X-Webhook-Signature': webhook.secret,
        ...webhook.headers,
      };

      try {
        const response = await fetch(webhook.url, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });
        delivered = response.ok;
        statusCode = response.status;
      } catch {
        delivered = false;
        statusCode = undefined;
      }

      if (!delivered && webhook.retryCount < webhook.maxRetries) {
        webhook.retryCount++;
      }

      const record: DeliveryRecord = {
        webhookId: webhook.id,
        event,
        delivered,
        statusCode,
        timestamp: new Date().toISOString(),
      };
      this.deliveryHistory.push(record);
      results.push({ webhookId: webhook.id, delivered, statusCode });
    }

    return results;
  }

  list(): Webhook[] {
    return Array.from(this.webhooks.values());
  }

  getDeliveryHistory(webhookId?: string): DeliveryRecord[] {
    if (webhookId) {
      return this.deliveryHistory.filter((r) => r.webhookId === webhookId);
    }
    return [...this.deliveryHistory];
  }
}
