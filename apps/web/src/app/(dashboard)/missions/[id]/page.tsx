'use client';

import { AlertTriangle, ArrowLeft, CheckCircle2, Clock, Play, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useFetch } from '@/lib/hooks/use-api';
import { priorityVariant, statusVariant } from '@/lib/status-maps';
import { formatRelativeTime } from '@/lib/utils';
import type { AuditEvent, LearningEvent, Mission } from '@/types';

interface MissionDetailResponse {
  mission: Mission;
}

interface AuditResponse {
  events?: AuditEvent[];
}

interface LearningResponse {
  recentEvents?: LearningEvent[];
}

const statusColors: Record<string, string> = {
  draft: 'text-muted-foreground',
  executing: 'text-blue-500',
  completed: 'text-green-500',
  failed: 'text-red-500',
  paused: 'text-yellow-500',
};

const statusIcons: Record<string, React.ReactNode> = {
  draft: <Clock className="h-5 w-5" />,
  executing: <Play className="h-5 w-5 text-blue-500" />,
  completed: <CheckCircle2 className="h-5 w-5 text-green-500" />,
  failed: <XCircle className="h-5 w-5 text-red-500" />,
  paused: <AlertTriangle className="h-5 w-5 text-yellow-500" />,
};

export default function MissionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data: missionData, loading } = useFetch<MissionDetailResponse>(`/api/missions/${id}`);
  const { data: auditData } = useFetch<AuditResponse>('/api/audit');
  const { data: learningData } = useFetch<LearningResponse>('/api/learning');

  const mission = missionData?.mission;

  const missionEvents = useMemo(() => {
    const events: { time: string; type: string; description: string; severity?: string }[] = [];

    if (auditData?.events) {
      for (const e of auditData.events) {
        if (e.mission === id) {
          events.push({
            time: e.timestamp,
            type: e.type,
            description: e.description,
            severity: e.severity,
          });
        }
      }
    }

    if (learningData?.recentEvents) {
      for (const e of learningData.recentEvents) {
        if (e.missionId === id) {
          events.push({
            time: e.timestamp,
            type: e.type,
            description: e.content,
            severity: e.impact,
          });
        }
      }
    }

    events.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
    return events;
  }, [auditData, learningData, id]);

  const handleAction = useCallback(
    async (action: 'start' | 'complete' | 'fail') => {
      try {
        const res = await fetch(`/api/missions/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        });
        if (res.ok) {
          router.refresh();
        }
      } catch {
        // silent
      }
    },
    [id, router],
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!mission) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <AlertTriangle className="h-12 w-12 text-muted mb-4" />
        <p className="text-lg font-medium text-foreground">Mission not found</p>
        <p className="text-sm text-muted-foreground mt-1">
          The mission you're looking for doesn't exist.
        </p>
        <Link
          href="/missions"
          className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
        >
          Back to Missions
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/missions"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Missions
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">{mission.title}</h1>
            <Badge variant={statusVariant[mission.status]}>{mission.status}</Badge>
            <Badge variant={priorityVariant[mission.priority]}>{mission.priority}</Badge>
          </div>
          {mission.description && (
            <p className="text-sm text-muted-foreground">{mission.description}</p>
          )}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>ID: {mission.id}</span>
            <span>Type: {mission.type}</span>
            <span>Created: {formatRelativeTime(mission.createdAt)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {mission.status === 'draft' && (
            <Button size="sm" onClick={() => handleAction('start')}>
              <Play className="h-4 w-4 mr-1" />
              Start Mission
            </Button>
          )}
          {mission.status === 'executing' && (
            <>
              <Button size="sm" onClick={() => handleAction('complete')}>
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Complete
              </Button>
              <Button size="sm" variant="destructive" onClick={() => handleAction('fail')}>
                <XCircle className="h-4 w-4 mr-1" />
                Fail
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Progress</p>
              <div className="flex items-center gap-2">
                <div className="h-2.5 flex-1 rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${mission.progress}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-foreground">{mission.progress}%</span>
              </div>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-1">Status</p>
              <div className="flex items-center gap-2">
                {statusIcons[mission.status]}
                <span className={`text-sm font-medium capitalize ${statusColors[mission.status]}`}>
                  {mission.status}
                </span>
              </div>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-1">Assigned To</p>
              <div className="flex flex-wrap gap-1">
                {mission.assignedTo.length > 0 ? (
                  mission.assignedTo.map((agent) => (
                    <Badge key={agent} variant="outline" className="text-xs">
                      {agent}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">Unassigned</span>
                )}
              </div>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-1">Tags</p>
              <div className="flex flex-wrap gap-1">
                {mission.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-1">Timeline</p>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>Created: {formatRelativeTime(mission.createdAt)}</p>
                <p>Updated: {formatRelativeTime(mission.updatedAt)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Activity Timeline ({missionEvents.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {missionEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Clock className="h-10 w-10 text-muted mb-3" />
                <p className="text-sm font-medium text-foreground">No events yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Activity for this mission will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-0">
                {missionEvents.map((event, i) => (
                  <div key={`${event.time}-${i}`} className="relative flex gap-4 pb-6 last:pb-0">
                    <div className="flex flex-col items-center">
                      <div
                        className={`h-2.5 w-2.5 rounded-full ring-4 ring-background ${
                          event.severity === 'critical' || event.severity === 'high'
                            ? 'bg-red-500'
                            : event.severity === 'medium' || event.severity === 'warn'
                              ? 'bg-yellow-500'
                              : 'bg-blue-500'
                        }`}
                      />
                      {i < missionEvents.length - 1 && (
                        <div className="mt-1 w-px flex-1 bg-border" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground">
                          {formatRelativeTime(event.time)}
                        </span>
                        <Badge
                          variant={
                            event.severity === 'critical' || event.severity === 'high'
                              ? 'destructive'
                              : 'outline'
                          }
                          className="text-[10px] px-1 py-0"
                        >
                          {event.type}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-sm text-foreground">{event.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
