'use client';

import { Activity, Clock, Settings } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Sidebar } from '@/components/layout/sidebar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { agents } from '@/lib/mock-data';
import { cn, formatRelativeTime } from '@/lib/utils';

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

export default function AgentsPage() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header title="Agents" description="Manage your autonomous AI agents" />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {agents.map((agent) => (
              <Card key={agent.id} className="hover:border-[#333] transition-colors">
                <CardHeader className="flex flex-row items-start justify-between space-y-0">
                  <div className="flex items-center gap-3">
                    <div className="text-3xl">{agent.avatar}</div>
                    <div>
                      <CardTitle className="text-base">{agent.name}</CardTitle>
                      <p className="text-xs text-[#a1a1aa]">{agent.role}</p>
                    </div>
                  </div>
                  <Badge variant={statusVariant[agent.status]}>
                    <div
                      className={cn('h-1.5 w-1.5 rounded-full mr-1', statusColor[agent.status])}
                    />
                    {agent.status}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[#a1a1aa]">Authority</span>
                      <span className="font-medium text-[#fafafa]">{agent.authority}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[#a1a1aa]">Missions</span>
                      <span className="font-medium text-[#fafafa]">{agent.missionsCompleted}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[#a1a1aa]">Last Active</span>
                      <span className="text-[#a1a1aa]">{formatRelativeTime(agent.lastActive)}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[#a1a1aa]">Reputation</span>
                      <span className="font-medium text-[#fafafa]">{agent.reputation}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-[#262626]">
                      <div
                        className="h-full rounded-full bg-[#0A7C4F] animate-progress"
                        style={{ width: `${agent.reputation}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-medium text-[#a1a1aa]">Skills</p>
                    <div className="flex flex-wrap gap-1">
                      {agent.skills.map((skill) => (
                        <Badge key={skill} variant="secondary" className="text-xs">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button className="flex items-center gap-1 rounded-md border border-[#262626] bg-transparent px-3 py-1.5 text-xs text-[#a1a1aa] hover:bg-[#1a1a1a] hover:text-[#fafafa] transition-colors">
                      <Settings className="h-3 w-3" />
                      Configure
                    </button>
                    <button className="flex items-center gap-1 rounded-md border border-[#262626] bg-transparent px-3 py-1.5 text-xs text-[#a1a1aa] hover:bg-[#1a1a1a] hover:text-[#fafafa] transition-colors">
                      <Activity className="h-3 w-3" />
                      Logs
                    </button>
                    <button className="flex items-center gap-1 rounded-md border border-[#262626] bg-transparent px-3 py-1.5 text-xs text-[#a1a1aa] hover:bg-[#1a1a1a] hover:text-[#fafafa] transition-colors">
                      <Clock className="h-3 w-3" />
                      History
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
