import { describe, expect, it, vi } from 'vitest';
import {
  type Connector,
  ConnectorFramework,
  type ConnectorResponse,
} from '../engines/integration/connector-framework';
import {
  type OAuthConfig,
  OAuthManager,
  type OAuthToken,
} from '../engines/integration/oauth-manager';
import { WebhookManager } from '../engines/integration/webhook-manager';

describe('ConnectorFramework', () => {
  it('should register a connector', () => {
    const framework = new ConnectorFramework();
    const connector: Connector = {
      type: 'rest',
      call: vi.fn(),
    };
    framework.register('rest', connector);
    expect(framework.get('rest')).toBe(connector);
  });

  it('should return undefined for unregistered type', () => {
    const framework = new ConnectorFramework();
    expect(framework.get('grpc')).toBeUndefined();
  });

  it('should call a registered connector', async () => {
    const framework = new ConnectorFramework();
    const response: ConnectorResponse = { status: 200, headers: {}, body: { ok: true } };
    const connector: Connector = {
      type: 'rest',
      call: vi.fn().mockResolvedValue(response),
    };
    framework.register('rest', connector);
    const result = await framework.call('rest', { method: 'GET', url: 'http://test.com' });
    expect(result).toEqual(response);
    expect(connector.call).toHaveBeenCalledWith({ method: 'GET', url: 'http://test.com' });
  });

  it('should throw when calling unregistered connector', async () => {
    const framework = new ConnectorFramework();
    await expect(framework.call('mcp', { method: 'GET', url: 'http://test.com' })).rejects.toThrow(
      'No connector registered for type: mcp',
    );
  });

  it('should list all registered types', () => {
    const framework = new ConnectorFramework();
    framework.register('rest', { type: 'rest', call: vi.fn() });
    framework.register('graphql', { type: 'graphql', call: vi.fn() });
    expect(framework.list()).toEqual(['rest', 'graphql']);
  });
});

describe('WebhookManager', () => {
  it('should register a webhook and return an id', () => {
    const manager = new WebhookManager();
    const id = manager.register('https://hook.example.com', ['order.created'], 'secret123');
    expect(id).toBeDefined();
    expect(typeof id).toBe('string');
  });

  it('should list registered webhooks', () => {
    const manager = new WebhookManager();
    manager.register('https://hook.example.com', ['order.created'], 'secret123');
    manager.register('https://hook2.example.com', ['user.updated'], 'secret456');
    expect(manager.list()).toHaveLength(2);
  });

  it('should unregister a webhook', () => {
    const manager = new WebhookManager();
    const id = manager.register('https://hook.example.com', ['order.created'], 'secret123');
    manager.unregister(id);
    expect(manager.list()).toHaveLength(0);
  });

  it('should throw when unregistering unknown webhook', () => {
    const manager = new WebhookManager();
    expect(() => manager.unregister('nonexistent')).toThrow('Webhook not found: nonexistent');
  });

  it('should deliver to matching webhooks', async () => {
    const manager = new WebhookManager();
    manager.register('https://hook.example.com', ['order.created'], 'secret123');

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('ok', { status: 200 }));

    const results = await manager.deliver('order.created', { id: 'ord_123' });
    expect(results).toHaveLength(1);
    expect(results[0].delivered).toBe(true);
    expect(results[0].statusCode).toBe(200);
  });

  it('should not deliver to non-matching webhooks', async () => {
    const manager = new WebhookManager();
    manager.register('https://hook.example.com', ['order.created'], 'secret123');
    const results = await manager.deliver('user.updated', {});
    expect(results).toHaveLength(0);
  });

  it('should record delivery history', async () => {
    const manager = new WebhookManager();
    const id = manager.register('https://hook.example.com', ['order.created'], 'secret123');

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('ok', { status: 200 }));

    await manager.deliver('order.created', { id: 'ord_123' });
    const history = manager.getDeliveryHistory();
    expect(history).toHaveLength(1);
    expect(history[0].webhookId).toBe(id);
    expect(history[0].event).toBe('order.created');
    expect(history[0].delivered).toBe(true);
  });

  it('should filter delivery history by webhook id', async () => {
    const manager = new WebhookManager();
    const id1 = manager.register('https://hook1.example.com', ['order.created'], 'secret123');
    manager.register('https://hook2.example.com', ['user.updated'], 'secret456');

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok', { status: 200 }));

    await manager.deliver('order.created', {});
    await manager.deliver('user.updated', {});

    const history = manager.getDeliveryHistory(id1);
    expect(history).toHaveLength(1);
    expect(history[0].webhookId).toBe(id1);
  });

  it('should increment retry count on failed delivery', async () => {
    const manager = new WebhookManager();
    manager.register('https://hook.example.com', ['order.created'], 'secret123');

    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));

    await manager.deliver('order.created', {});
    const webhooks = manager.list();
    expect(webhooks[0].retryCount).toBe(1);
  });
});

describe('OAuthManager', () => {
  const config: OAuthConfig = {
    clientId: 'test-client',
    clientSecret: 'test-secret',
    authUrl: 'https://auth.example.com/authorize',
    tokenUrl: 'https://auth.example.com/token',
    redirectUri: 'https://app.example.com/callback',
    scopes: ['read', 'write'],
  };

  it('should generate authorization url', () => {
    const oauth = new OAuthManager(config);
    const url = oauth.getAuthorizationUrl();
    expect(url).toContain('https://auth.example.com/authorize');
    expect(url).toContain('client_id=test-client');
    expect(url).toContain('redirect_uri=');
    expect(url).toContain(encodeURIComponent('https://app.example.com/callback'));
    expect(url).toContain('response_type=code');
    expect(url).toContain('scope=read+write');
  });

  it('should include state in authorization url when provided', () => {
    const oauth = new OAuthManager(config);
    const url = oauth.getAuthorizationUrl('xyz-state');
    expect(url).toContain('state=xyz-state');
  });

  it('should exchange code for token', async () => {
    const oauth = new OAuthManager(config);

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: 'at-123',
          refresh_token: 'rt-456',
          expires_in: 3600,
          scope: 'read write',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const token = await oauth.exchangeCode('code-abc');
    expect(token.accessToken).toBe('at-123');
    expect(token.refreshToken).toBe('rt-456');
    expect(token.scopes).toEqual(['read', 'write']);
    expect(token.expiresAt).toBeDefined();
  });

  it('should throw on failed token exchange', async () => {
    const oauth = new OAuthManager(config);

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Unauthorized', { status: 401 }),
    );

    await expect(oauth.exchangeCode('bad-code')).rejects.toThrow('Token exchange failed');
  });

  it('should refresh access token', async () => {
    const oauth = new OAuthManager(config);

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: 'at-new',
          refresh_token: 'rt-new',
          expires_in: 7200,
          scope: 'read',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const token = await oauth.refreshAccessToken('rt-456');
    expect(token.accessToken).toBe('at-new');
    expect(token.refreshToken).toBe('rt-new');
    expect(token.scopes).toEqual(['read']);
  });

  it('should throw on failed token refresh', async () => {
    const oauth = new OAuthManager(config);

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Bad Request', { status: 400 }),
    );

    await expect(oauth.refreshAccessToken('bad-rt')).rejects.toThrow('Token refresh failed');
  });

  it('should detect expired token', () => {
    const oauth = new OAuthManager(config);
    const expired: OAuthToken = {
      accessToken: 'at-123',
      expiresAt: new Date(Date.now() - 10000).toISOString(),
      scopes: ['read'],
    };
    expect(oauth.isExpired(expired)).toBe(true);
  });

  it('should detect non-expired token', () => {
    const oauth = new OAuthManager(config);
    const valid: OAuthToken = {
      accessToken: 'at-123',
      expiresAt: new Date(Date.now() + 10000).toISOString(),
      scopes: ['read'],
    };
    expect(oauth.isExpired(valid)).toBe(false);
  });
});
