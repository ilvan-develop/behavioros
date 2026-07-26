'use client';

import {
  AlertTriangle,
  ArrowLeft,
  Award,
  Briefcase,
  Calendar,
  CheckCircle2,
  Target,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useFetch } from '@/lib/hooks/use-api';
import { statusColor, statusVariant } from '@/lib/status-maps';
import { cn, formatRelativeTime } from '@/lib/utils';
import type { Agent, Mission } from '@/types';

interface AgentDetailResponse {
  agent: Agent;
  missions: Mission[];
}

export default function AgentDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const { data, loading } = useFetch<AgentDetailResponse>(`/api/agents/${id}`);
  const agent = data?.agent;
  const missions = data?.missions ?? [];

  const stats = useMemo(() => {
    const completed = missions.filter((m) => m.status === 'completed');
    const executing = missions.filter((m) => m.status === 'executing');
    const failed = missions.filter((m) => m.status === 'failed');
    return {
      total: missions.length,
      completed: completed.length,
      executing: executing.length,
      failed: failed.length,
    };
  }, [missions]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-56 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <AlertTriangle className="h-12 w-12 text-muted mb-4" />
        <p className="text-lg font-medium text-foreground">Agent not found</p>
        <p className="text-sm text-muted-foreground mt-1">
          The agent you're looking for doesn't exist.
        </p>
        <Link
          href="/agents"
          className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
        >
          Back to Agents
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/agents"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Agents
      </Link>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-6">
            <div className="text-5xl">{agent.avatar}</div>
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-foreground">{agent.name}</h1>
                <Badge variant={statusVariant[agent.status]}>
                  <div className={cn('h-1.5 w-1.5 rounded-full mr-1', statusColor[agent.status])} />
                  {agent.status}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground capitalize">{agent.role}</p>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Award className="h-3 w-3" />
                  Authority: {agent.authority}
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {agent.missionsCompleted} missions completed
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Last active {formatRelativeTime(agent.lastActive)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Reputation</p>
              <div className="mt-1 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <span className="text-lg font-bold text-foreground">{agent.reputation}%</span>
              </div>
              <div className="mt-2 h-1.5 w-full rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${agent.reputation}%` }}
                />
              </div>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Active Missions</p>
              <div className="mt-1 flex items-center gap-2">
                <Target className="h-4 w-4 text-blue-500" />
                <span className="text-lg font-bold text-foreground">{stats.executing}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{stats.total} total assigned</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Success Rate</p>
              <div className="mt-1 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-lg font-bold text-foreground">
                  {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : '—'}%
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {stats.completed} completed, {stats.failed} failed
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Skills</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {agent.skills.map((skill) => (
                <Badge key={skill} variant="secondary">
                  {skill}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Assigned Missions ({missions.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {missions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Briefcase className="h-10 w-10 text-muted mb-3" />
                <p className="text-sm font-medium text-foreground">No missions assigned</p>
                <p className="text-xs text-muted-foreground mt-1">
                  This agent has not been assigned to any missions yet.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {missions.map((mission) => (
                  <Link
                    key={mission.id}
                    href={`/missions/${mission.id}`}
                    className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">
                        {mission.title}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground uppercase">
                          {mission.type}
                        </span>
                        <span className="text-[10px] text-muted-foreground">&middot;</span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatRelativeTime(mission.createdAt)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Badge
                        variant={statusVariant[mission.status]}
                        className="text-[10px] px-1.5 py-0"
                      >
                        {mission.status}
                      </Badge>
                      <div className="flex items-center gap-1.5">
                        <div className="h-1.5 w-12 rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${mission.progress}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground w-6 text-right">
                          {mission.progress}%
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
