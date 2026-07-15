'use client';

import { Activity, Clock, Settings, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFetch } from '@/lib/hooks/use-api';
import { statusColor, statusVariant } from '@/lib/status-maps';
import { cn, formatRelativeTime } from '@/lib/utils';
import type { Agent } from '@/types';

interface AgentsResponse {
  agents?: Agent[];
  total?: number;
}

const statusFilters = ['all', 'idle', 'working', 'blocked', 'offline'] as const;

export default function AgentsPage() {
  const { data, loading } = useFetch<AgentsResponse>('/api/agents');
  const agents = data?.agents ?? [];
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredAgents = useMemo(() => {
    if (statusFilter === 'all') return agents;
    return agents.filter((a) => a.status === statusFilter);
  }, [agents, statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
            <SelectTrigger>
              <SelectValue>{statusFilter === 'all' ? 'All Statuses' : statusFilter}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {statusFilters.map((s) => (
                <SelectItem key={s} value={s}>
                  {s === 'all' ? 'All Statuses' : s.charAt(0).toUpperCase() + s.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <span className="text-sm text-muted-foreground">
          {loading ? 'Loading...' : `${filteredAgents.length} agents`}
        </span>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {['a', 'b', 'c', 'd', 'e', 'f'].map((k) => (
            <div
              key={`agent-skeleton-${k}`}
              className="h-64 w-full animate-pulse rounded-lg border border-border bg-card"
            />
          ))}
        </div>
      ) : filteredAgents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Users className="h-12 w-12 text-muted mb-4" />
          <p className="text-lg font-medium text-foreground">No agents found</p>
          <p className="text-sm text-muted-foreground mt-1">
            {agents.length === 0
              ? 'No agents have been registered yet.'
              : 'Try selecting a different status filter.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredAgents.map((agent) => (
            <Card key={agent.id} className="hover:border-border/60 transition-colors">
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div className="flex items-center gap-3">
                  <div className="text-3xl">{agent.avatar}</div>
                  <div>
                    <CardTitle className="text-base">{agent.name}</CardTitle>
                    <p className="text-xs text-muted-foreground">{agent.role}</p>
                  </div>
                </div>
                <Badge variant={statusVariant[agent.status]}>
                  <div className={cn('h-1.5 w-1.5 rounded-full mr-1', statusColor[agent.status])} />
                  {agent.status}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Authority</span>
                    <span className="font-medium text-foreground">{agent.authority}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Missions</span>
                    <span className="font-medium text-foreground">{agent.missionsCompleted}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Last Active</span>
                    <span className="text-muted-foreground">
                      {formatRelativeTime(agent.lastActive)}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Reputation</span>
                    <span className="font-medium text-foreground">{agent.reputation}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary animate-progress"
                      style={{ width: `${agent.reputation}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Skills</p>
                  <div className="flex flex-wrap gap-1">
                    {agent.skills.map((skill) => (
                      <Badge key={skill} variant="secondary" className="text-xs">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    className="flex items-center gap-1 rounded-md border border-border bg-transparent px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    <Settings className="h-3 w-3" />
                    Configure
                  </button>
                  <button
                    type="button"
                    className="flex items-center gap-1 rounded-md border border-border bg-transparent px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    <Activity className="h-3 w-3" />
                    Logs
                  </button>
                  <button
                    type="button"
                    className="flex items-center gap-1 rounded-md border border-border bg-transparent px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    <Clock className="h-3 w-3" />
                    History
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
