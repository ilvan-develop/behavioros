import { Suspense } from 'react';
import { AgentStatusGrid } from '@/components/dashboard/agent-status-grid';
import { RecentMissions } from '@/components/dashboard/recent-missions';
import { StatsCards } from '@/components/dashboard/stats-cards';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

async function getQualityData() {
  try {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const res = await fetch(`${base}/api/quality`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json() as Promise<{
      qualityGates?: { status: string; metrics: { status: string }[] }[];
    }>;
  } catch {
    return null;
  }
}

async function getLearningData() {
  try {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const res = await fetch(`${base}/api/learning`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json() as Promise<{
      totalEvents: number;
      pendingCount: number;
      anomalies: unknown[];
    }>;
  } catch {
    return null;
  }
}

async function QualityOverview() {
  const [quality, learning] = await Promise.all([getQualityData(), getLearningData()]);

  const gates = quality?.qualityGates ?? [];
  const totalMetrics = gates.reduce((acc, g) => acc + g.metrics.length, 0);
  const passedMetrics = gates.reduce(
    (acc, g) => acc + g.metrics.filter((m) => m.status === 'pass').length,
    0,
  );
  const overallScore = totalMetrics > 0 ? Math.round((passedMetrics / totalMetrics) * 100) : '—';
  const _failedGates = gates.filter((g) => g.status === 'fail').length;
  const openIssues = (learning?.pendingCount ?? 0) + (learning?.anomalies?.length ?? 0);

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">Overall Score</p>
        <p className="text-3xl font-bold text-primary">
          {overallScore}
          {typeof overallScore === 'number' ? '%' : ''}
        </p>
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">Gates Passed</p>
        <p className="text-3xl font-bold text-success">
          {gates.filter((g) => g.status !== 'fail').length}/{gates.length}
        </p>
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">Open Issues</p>
        <p className="text-3xl font-bold text-warning">{openIssues}</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <Suspense fallback={<Skeleton className="h-28 w-full rounded-xl" />}>
        <StatsCards />
      </Suspense>

      <div className="grid gap-6 lg:grid-cols-7">
        <div className="lg:col-span-4">
          <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
            <RecentMissions />
          </Suspense>
        </div>
        <div className="lg:col-span-3">
          <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
            <AgentStatusGrid />
          </Suspense>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quality Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense
            fallback={
              <div className="grid gap-4 md:grid-cols-3">
                {['a', 'b', 'c'].map((k) => (
                  <div key={k} className="h-24 animate-pulse rounded-lg bg-muted" />
                ))}
              </div>
            }
          >
            <QualityOverview />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
