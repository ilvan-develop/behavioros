'use client';

import { Activity, Bot, FileText, Target, TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useFetch } from '@/lib/hooks/use-api';

interface StatCard {
  title: string;
  value: string | number;
  change: string;
  trend: 'up' | 'down';
  icon: React.ReactNode;
}

interface StatsResponse {
  status?: {
    engine: boolean;
    dna?: string;
    missions?: number;
    agents?: number;
    auditEvents?: number;
    qualityMetrics?: number;
  };
  stats?: {
    missions?: { total: number; completed: number; failed: number };
    agents?: { total: number; active: number };
    auditEvents?: number;
    qualityMetrics?: number;
  };
  pipeline?: unknown;
}

const fallbackStats: StatCard[] = [
  {
    title: 'Total Missions',
    value: 0,
    change: '0 completed',
    trend: 'up',
    icon: <Target className="h-4 w-4" />,
  },
  {
    title: 'Active Agents',
    value: '0/0',
    change: '0 idle',
    trend: 'up',
    icon: <Bot className="h-4 w-4" />,
  },
  {
    title: 'Quality Score',
    value: '—',
    change: 'No data yet',
    trend: 'up',
    icon: <Activity className="h-4 w-4" />,
  },
  {
    title: 'Audit Events',
    value: 0,
    change: '0 critical',
    trend: 'up',
    icon: <FileText className="h-4 w-4" />,
  },
];

function computeStats(data: StatsResponse): StatCard[] {
  const s = data.stats;
  const st = data.status;

  const totalMissions = s?.missions?.total ?? st?.missions ?? 0;
  const completedMissions = s?.missions?.completed ?? 0;
  const totalAgents = s?.agents?.total ?? st?.agents ?? 0;
  const activeAgents = s?.agents?.active ?? 0;
  const idleAgents = totalAgents - activeAgents;
  const totalAuditEvents = s?.auditEvents ?? st?.auditEvents ?? 0;
  const qualityMetrics = st?.qualityMetrics ?? s?.qualityMetrics ?? 0;

  return [
    {
      title: 'Total Missions',
      value: totalMissions,
      change: `${completedMissions} completed`,
      trend: completedMissions > 0 ? 'up' : 'down',
      icon: <Target className="h-4 w-4" />,
    },
    {
      title: 'Active Agents',
      value: `${activeAgents}/${totalAgents}`,
      change: `${idleAgents} idle`,
      trend: 'up',
      icon: <Bot className="h-4 w-4" />,
    },
    {
      title: 'Quality Score',
      value: qualityMetrics > 0 ? `${qualityMetrics}%` : '—',
      change: qualityMetrics > 0 ? `${qualityMetrics}% passing` : 'No metrics yet',
      trend: qualityMetrics >= 80 ? 'up' : 'down',
      icon: <Activity className="h-4 w-4" />,
    },
    {
      title: 'Audit Events',
      value: totalAuditEvents,
      change: 'All time',
      trend: 'up',
      icon: <FileText className="h-4 w-4" />,
    },
  ];
}

export function StatsCards() {
  const { data, loading } = useFetch<StatsResponse>('/api/stats');
  const stats = data ? computeStats(data) : fallbackStats;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.title} className="hover:border-border/60 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {stat.title}
            </CardTitle>
            <div className="text-muted-foreground">{stat.icon}</div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  {stat.trend === 'up' ? (
                    <TrendingUp className="h-3 w-3 text-green-500" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-500" />
                  )}
                  <span>{stat.change}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
