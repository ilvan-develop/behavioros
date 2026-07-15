'use client';

import { Activity, AlertTriangle, CheckCircle, ClipboardCheck, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFetch } from '@/lib/hooks/use-api';
import { cn } from '@/lib/utils';
import type { QualityGate } from '@/types';

interface QualityResponse {
  qualityMetrics?: unknown;
  qualityGates?: QualityGate[];
}

const statusIcon: Record<string, React.ReactNode> = {
  pass: <CheckCircle className="h-5 w-5 text-green-500" />,
  fail: <XCircle className="h-5 w-5 text-red-500" />,
  warn: <AlertTriangle className="h-5 w-5 text-yellow-500" />,
};

const statusVariant: Record<string, 'success' | 'destructive' | 'warning'> = {
  pass: 'success',
  fail: 'destructive',
  warn: 'warning',
};

const statusColor: Record<string, string> = {
  pass: 'text-green-500',
  fail: 'text-red-500',
  warn: 'text-yellow-500',
};

export default function QualityPage() {
  const { data, loading } = useFetch<QualityResponse>('/api/quality');

  const gates: QualityGate[] = data?.qualityGates ?? [];

  const totalMetrics = gates.reduce((acc, gate) => acc + gate.metrics.length, 0);
  const passedMetrics = gates.reduce(
    (acc, gate) => acc + gate.metrics.filter((m) => m.status === 'pass').length,
    0,
  );
  const overallScore = totalMetrics > 0 ? Math.round((passedMetrics / totalMetrics) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Overall Quality Score
            </CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-10 w-20 animate-pulse rounded bg-muted" />
            ) : (
              <>
                <div className="text-4xl font-bold text-primary">{overallScore}%</div>
                <p className="text-xs text-muted-foreground">
                  {passedMetrics} of {totalMetrics} metrics passing
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Gates Passed
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-10 w-20 animate-pulse rounded bg-muted" />
            ) : (
              <>
                <div className="text-4xl font-bold text-green-500">
                  {gates.filter((g) => g.status === 'pass').length}/{gates.length}
                </div>
                <p className="text-xs text-muted-foreground">
                  {gates.filter((g) => g.status === 'fail').length} failed,{' '}
                  {gates.filter((g) => g.status === 'warn').length} warnings
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Open Issues</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-10 w-20 animate-pulse rounded bg-muted" />
            ) : (
              <>
                <div className="text-4xl font-bold text-yellow-500">
                  {gates.reduce(
                    (acc, gate) => acc + gate.metrics.filter((m) => m.status !== 'pass').length,
                    0,
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Metrics below threshold</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {['a', 'b', 'c', 'd'].map((k) => (
            <div
              key={`quality-skeleton-${k}`}
              className="h-64 w-full animate-pulse rounded-lg border border-border bg-card"
            />
          ))}
        </div>
      ) : gates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ClipboardCheck className="h-12 w-12 text-muted mb-4" />
          <p className="text-lg font-medium text-foreground">No quality gates yet</p>
          <p className="text-sm text-muted-foreground mt-1">Run an audit to see quality metrics.</p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {gates.map((gate) => (
            <Card key={gate.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-3">
                  {statusIcon[gate.status]}
                  <div>
                    <CardTitle className="text-base">{gate.name}</CardTitle>
                    <p className="text-xs text-muted-foreground">{gate.description}</p>
                  </div>
                </div>
                <Badge variant={statusVariant[gate.status]}>{gate.status}</Badge>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {gate.metrics.map((metric) => (
                    <div key={metric.id} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{metric.name}</span>
                        <div className="flex items-center gap-2">
                          <span className={cn('font-medium', statusColor[metric.status])}>
                            {metric.value}
                            {metric.unit}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            / {metric.threshold}
                            {metric.unit}
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all',
                            metric.status === 'pass' && 'bg-green-500',
                            metric.status === 'fail' && 'bg-red-500',
                            metric.status === 'warn' && 'bg-yellow-500',
                          )}
                          style={{
                            width: `${Math.min(100, (metric.value / metric.threshold) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
