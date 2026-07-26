/**
 * ShopifyOrder — Configuration and options interface.
 */
export interface ShopifyOrder {
  id: string;
  orderNumber: number;
  email: string;
  currency: string;
  totalPrice: string;
  createdAt: string;
  lineItems: { title: string; quantity: number; price: string }[];
  status: string;
}

/**
 * ShopifyListResult — Configuration and options interface.
 */
export interface ShopifyListResult {
  orders: ShopifyOrder[];
  nextPage?: string;
}

/**
 * ShopifyResult — Configuration and options interface.
 */
export interface ShopifyResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * ShopifyAdapter — shopify adapter.
 *
 * Methods: createOrder, getOrder, listOrders, cancelOrder, clearTimeout.
 */
export class ShopifyAdapter {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;

  constructor(
    storeDomain: string,
    accessToken: string,
    private readonly timeoutMs = 10_000,
  ) {
    this.baseUrl = `https://${storeDomain}/admin/api/2024-01`;
    this.headers = {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    };
  }

  async createOrder(order: {
    email: string;
    lineItems: { title: string; quantity: number; price: string }[];
  }): Promise<ShopifyResult<ShopifyOrder>> {
    try {
      const response = await this.fetch('/orders.json', {
        method: 'POST',
        body: JSON.stringify({ order }),
      });

      if (!response.ok) {
        const text = await response.text();
        return { success: false, error: `Shopify error: ${response.status} ${text}` };
      }

      const json = await response.json();
      return { success: true, data: json.order as ShopifyOrder };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async getOrder(orderId: string): Promise<ShopifyResult<ShopifyOrder>> {
    try {
      const response = await this.fetch(`/orders/${orderId}.json`);

      if (response.status === 404) {
        return { success: false, error: `Order ${orderId} not found` };
      }

      if (!response.ok) {
        const text = await response.text();
        return { success: false, error: `Shopify error: ${response.status} ${text}` };
      }

      const json = await response.json();
      return { success: true, data: json.order as ShopifyOrder };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async listOrders(page = 1, limit = 50): Promise<ShopifyResult<ShopifyListResult>> {
    try {
      const response = await this.fetch(`/orders.json?page=${page}&limit=${limit}`);

      if (!response.ok) {
        const text = await response.text();
        return { success: false, error: `Shopify error: ${response.status} ${text}` };
      }

      const json = await response.json();
      const orders = json.orders as ShopifyOrder[];
      const linkHeader = response.headers.get('Link');
      const nextPage = linkHeader?.includes('rel="next"') ? String(page + 1) : undefined;

      return { success: true, data: { orders, nextPage } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async cancelOrder(orderId: string): Promise<ShopifyResult<ShopifyOrder>> {
    try {
      const getResult = await this.getOrder(orderId);
      if (!getResult.success) {
        return getResult;
      }

      if (getResult.data!.status === 'cancelled') {
        return { success: false, error: `Order ${orderId} is already cancelled` };
      }

      const response = await this.fetch(`/orders/${orderId}/cancel.json`, {
        method: 'POST',
      });

      if (!response.ok) {
        const text = await response.text();
        return { success: false, error: `Shopify error: ${response.status} ${text}` };
      }

      const json = await response.json();
      return { success: true, data: json.order as ShopifyOrder };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private async fetch(path: string, init?: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: { ...this.headers, ...init?.headers },
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timer);
    }
  }
}
