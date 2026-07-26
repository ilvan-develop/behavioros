'use client';

import { Cpu, Eye, EyeOff, Plug, Wifi, WifiOff } from 'lucide-react';
import { useState } from 'react';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFetch } from '@/lib/hooks/use-api';
import type { EcosystemMCP } from '@/types';

interface MCPsResponse {
  mcps: EcosystemMCP[];
  total: number;
  connected: number;
  offline: number;
  error: number;
}

export default function MCPsPage() {
  const { data, loading } = useFetch<MCPsResponse>('/api/ecosystem/mcps');
  const mcps = data?.mcps ?? [];

  const [showEnv, setShowEnv] = useState<Set<string>>(new Set());
  const [connectingId, setConnectingId] = useState<string | null>(null);

  const toggleShowEnv = (id: string) => {
    setShowEnv((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  async function handleConnect(mcp: EcosystemMCP) {
    setConnectingId(mcp.id);
    try {
      await fetch('/api/ecosystem/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'mcp', id: mcp.id, source: mcp.source }),
      });
      await new Promise((r) => setTimeout(r, 1000));
    } catch {
      // ignore
    } finally {
      setConnectingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Cpu className="h-5 w-5 text-primary" />
        <span className="text-sm text-muted-foreground">
          {loading
            ? 'Loading...'
            : `${data?.connected ?? 0} connected, ${data?.offline ?? 0} offline, ${data?.error ?? 0} error`}
        </span>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Connected</CardTitle>
            <Wifi className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-7 w-12 animate-pulse rounded bg-muted" />
            ) : (
              <div className="text-2xl font-bold text-green-500">{data?.connected ?? 0}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Offline</CardTitle>
            <WifiOff className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-7 w-12 animate-pulse rounded bg-muted" />
            ) : (
              <div className="text-2xl font-bold text-gray-500">{data?.offline ?? 0}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Error</CardTitle>
            <Cpu className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-7 w-12 animate-pulse rounded bg-muted" />
            ) : (
              <div className="text-2xl font-bold text-red-500">{data?.error ?? 0}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* MCP List */}
      {loading ? (
        <div className="space-y-3">
          {['a', 'b', 'c', 'd', 'e'].map((k) => (
            <div
              key={`mcp-skeleton-${k}`}
              className="h-28 w-full animate-pulse rounded-lg border border-border bg-card"
            />
          ))}
        </div>
      ) : mcps.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Cpu className="h-12 w-12 text-muted mb-4" />
            <p className="text-lg font-medium text-foreground">No MCP servers configured</p>
            <p className="text-sm text-muted-foreground mt-1">
              Connect MCP servers to extend agent capabilities.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {mcps.map((mcp) => (
            <Card key={mcp.id} className="hover:border-border/60 transition-colors">
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Cpu className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{mcp.name}</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      v{mcp.version} &middot; {mcp.toolsCount} tools
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={mcp.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{mcp.description}</p>

                <div className="flex items-center gap-3 text-sm">
                  <Badge variant="secondary" className="text-xs">
                    {mcp.source}
                  </Badge>
                </div>

                {/* Environment Variables */}
                {mcp.envVars.length > 0 && (
                  <div>
                    <button
                      type="button"
                      onClick={() => toggleShowEnv(mcp.id)}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showEnv.has(mcp.id) ? (
                        <EyeOff className="h-3 w-3" />
                      ) : (
                        <Eye className="h-3 w-3" />
                      )}
                      {mcp.envVars.length} environment variables
                    </button>
                    {showEnv.has(mcp.id) && (
                      <div className="mt-2 space-y-1">
                        {mcp.envVars.map((env) => (
                          <div key={env} className="flex items-center gap-2 text-xs">
                            <span className="font-mono text-foreground">{env}</span>
                            <span className="text-muted-foreground">=</span>
                            <span className="font-mono text-muted-foreground">
                              {'*'.repeat(Math.max(8, env.length))}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Connect button for offline/error MCPs */}
                {mcp.status !== 'connected' && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={connectingId === mcp.id}
                    onClick={() => handleConnect(mcp)}
                  >
                    {connectingId === mcp.id ? (
                      <>Connecting...</>
                    ) : (
                      <>
                        <Plug className="h-3 w-3 mr-1" />
                        Connect
                      </>
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
