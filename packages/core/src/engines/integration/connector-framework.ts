/**
 * ConnectorType — Union type: rest, grpc, graphql, mcp, a2a;.
 */
export type ConnectorType = 'rest' | 'grpc' | 'graphql' | 'mcp' | 'a2a';

/**
 * ConnectorRequest — Configuration and options interface.
 */
export interface ConnectorRequest {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
}

/**
 * ConnectorResponse — Configuration and options interface.
 */
export interface ConnectorResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

/**
 * Connector — Configuration and options interface.
 */
export interface Connector {
  readonly type: ConnectorType;
  call(request: ConnectorRequest): Promise<ConnectorResponse>;
}

/**
 * ConnectorFramework — connector framework.
 *
 * Methods: register, get, call, list.
 */
export class ConnectorFramework {
  private connectors = new Map<ConnectorType, Connector>();

  register(type: ConnectorType, connector: Connector): void {
    this.connectors.set(type, connector);
  }

  get(type: ConnectorType): Connector | undefined {
    return this.connectors.get(type);
  }

  async call(type: ConnectorType, request: ConnectorRequest): Promise<ConnectorResponse> {
    const connector = this.connectors.get(type);
    if (!connector) {
      throw new Error(`No connector registered for type: ${type}`);
    }
    return connector.call(request);
  }

  list(): ConnectorType[] {
    return Array.from(this.connectors.keys());
  }
}
