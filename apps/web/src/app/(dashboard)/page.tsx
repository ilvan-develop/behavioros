import { Suspense } from 'react';
import { AgentStatusGrid } from '@/components/dashboard/agent-status-grid';
import { RecentMissions } from '@/components/dashboard/recent-missions';
import { StatsCards } from '@/components/dashboard/stats-cards';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

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
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Overall Score</p>
              <p className="text-3xl font-bold text-primary">87%</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Gates Passed</p>
              <p className="text-3xl font-bold text-success">4/6</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Open Issues</p>
              <p className="text-3xl font-bold text-warning">2</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
