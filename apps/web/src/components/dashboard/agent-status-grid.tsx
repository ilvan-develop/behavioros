'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFetch } from '@/lib/hooks/use-api';
import { statusColor, statusVariant } from '@/lib/status-maps';
import { cn } from '@/lib/utils';
import type { Agent } from '@/types';

interface AgentsResponse {
  agents?: Agent[];
  total?: number;
}

export function AgentStatusGrid() {
  const { data, loading } = useFetch<AgentsResponse>('/api/agents');
  const agents = data?.agents ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Agent Status</CardTitle>
        <Link href="/agents" className="text-sm text-primary hover:underline">
          View all
        </Link>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {['a', 'b', 'c', 'd', 'e', 'f'].map((k) => (
              <div
                key={`agent-grid-skeleton-${k}`}
                className="h-16 w-full animate-pulse rounded-lg border border-border bg-card p-3"
              />
            ))}
          </div>
        ) : agents.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No agents registered yet.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:border-border/60"
              >
                <div className="text-2xl">{agent.avatar}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{agent.name}</span>
                    <div
                      className={cn(
                        'h-2 w-2 rounded-full animate-pulse-dot',
                        statusColor[agent.status],
                      )}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{agent.role}</p>
                </div>
                <Badge variant={statusVariant[agent.status]} className="text-xs">
                  {agent.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
