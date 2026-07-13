'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { agents } from '@/lib/mock-data';
import { cn } from '@/lib/utils';

const statusColor: Record<string, string> = {
  idle: 'bg-green-500',
  working: 'bg-blue-500',
  blocked: 'bg-red-500',
  offline: 'bg-gray-500',
};

const statusVariant: Record<string, 'success' | 'info' | 'destructive' | 'secondary'> = {
  idle: 'success',
  working: 'info',
  blocked: 'destructive',
  offline: 'secondary',
};

export function AgentStatusGrid() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Agent Status</CardTitle>
        <a href="/agents" className="text-sm text-[#0A7C4F] hover:underline">
          View all
        </a>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="flex items-center gap-3 rounded-lg border border-[#262626] bg-[#0a0a0a] p-3 transition-colors hover:border-[#333]"
            >
              <div className="text-2xl">{agent.avatar}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[#fafafa]">{agent.name}</span>
                  <div
                    className={cn(
                      'h-2 w-2 rounded-full animate-pulse-dot',
                      statusColor[agent.status],
                    )}
                  />
                </div>
                <p className="text-xs text-[#a1a1aa] truncate">{agent.role}</p>
              </div>
              <Badge variant={statusVariant[agent.status]} className="text-xs">
                {agent.status}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
