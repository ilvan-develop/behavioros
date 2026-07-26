'use client';

import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  FileText,
  Lightbulb,
  ListTodo,
  Search,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFetch } from '@/lib/hooks/use-api';
import { formatRelativeTime } from '@/lib/utils';
import type { LearningReport } from '@/types';

const typeIcons: Record<string, React.ReactNode> = {
  observation: <FileText className="h-4 w-4 text-blue-500" />,
  pattern: <TrendingUp className="h-4 w-4 text-purple-500" />,
  insight: <Lightbulb className="h-4 w-4 text-yellow-500" />,
  feedback: <ListTodo className="h-4 w-4 text-green-500" />,
  correction: <CheckCircle2 className="h-4 w-4 text-red-500" />,
};

const impactColors: Record<string, string> = {
  low: 'bg-gray-500/10 text-gray-600 border-gray-200',
  medium: 'bg-blue-500/10 text-blue-600 border-blue-200',
  high: 'bg-orange-500/10 text-orange-600 border-orange-200',
  critical: 'bg-red-500/10 text-red-600 border-red-200',
};

const confidenceColors: Record<string, string> = {
  high: 'text-green-500',
  medium: 'text-yellow-500',
  low: 'text-red-500',
};

function confidenceLevel(v: number): string {
  if (v >= 0.8) return 'high';
  if (v >= 0.6) return 'medium';
  return 'low';
}

export default function LearningPage() {
  const { data, loading } = useFetch<LearningReport>('/api/learning');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [impactFilter, setImpactFilter] = useState('all');

  const filteredEvents = useMemo(() => {
    if (!data?.recentEvents) return [];
    return data.recentEvents.filter((e) => {
      const matchesSearch =
        !searchQuery ||
        e.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.source.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = typeFilter === 'all' || e.type === typeFilter;
      const matchesImpact = impactFilter === 'all' || e.impact === impactFilter;
      return matchesSearch && matchesType && matchesImpact;
    });
  }, [data, searchQuery, typeFilter, impactFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Brain className="h-5 w-5 text-primary" />
          <span className="text-sm text-muted-foreground">
            {loading ? 'Loading...' : `${data?.totalEvents ?? 0} total events`}
          </span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Events
            </CardTitle>
            <FileText className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-10 w-16 animate-pulse rounded bg-muted" />
            ) : (
              <div className="text-3xl font-bold text-foreground">{data?.totalEvents ?? 0}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Applied</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-10 w-16 animate-pulse rounded bg-muted" />
            ) : (
              <div className="text-3xl font-bold text-green-500">{data?.appliedCount ?? 0}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-10 w-16 animate-pulse rounded bg-muted" />
            ) : (
              <div className="text-3xl font-bold text-yellow-500">{data?.pendingCount ?? 0}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Patterns</CardTitle>
            <Brain className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-10 w-16 animate-pulse rounded bg-muted" />
            ) : (
              <div className="text-3xl font-bold text-purple-500">{data?.patterns.length ?? 0}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Trends */}
      <Card>
        <CardHeader>
          <CardTitle>Event Distribution by Type</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-24 w-full animate-pulse rounded bg-muted" />
          ) : (
            <div className="grid gap-4 md:grid-cols-5">
              {(data?.trends ?? []).map((t) => (
                <div
                  key={t.type}
                  className="flex flex-col items-center rounded-lg border border-border p-4"
                >
                  <div className="mb-2">{typeIcons[t.type]}</div>
                  <span className="text-lg font-bold text-foreground">{t.count}</span>
                  <span className="text-xs text-muted-foreground capitalize">{t.type}</span>
                  <Badge
                    variant="outline"
                    className={`mt-1 text-xs ${
                      t.trend === 'up'
                        ? 'text-green-500'
                        : t.trend === 'down'
                          ? 'text-red-500'
                          : 'text-muted-foreground'
                    }`}
                  >
                    {t.trend}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detected Patterns */}
      <Card>
        <CardHeader>
          <CardTitle>Detected Patterns ({data?.patterns.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {['a', 'b', 'c'].map((k) => (
                <div
                  key={`pat-skeleton-${k}`}
                  className="h-20 w-full animate-pulse rounded bg-muted"
                />
              ))}
            </div>
          ) : (data?.patterns ?? []).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Brain className="h-12 w-12 text-muted mb-4" />
              <p className="text-lg font-medium text-foreground">No patterns detected yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Patterns are automatically detected as learning events are recorded.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {(data?.patterns ?? []).map((pattern) => (
                <div key={pattern.id} className="rounded-lg border border-border p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        <TrendingUp className="h-4 w-4 text-purple-500" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">
                            {pattern.description}
                          </span>
                          <Badge variant="outline" className="text-xs capitalize">
                            {pattern.type}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span>
                            Confidence:{' '}
                            <span className={confidenceColors[confidenceLevel(pattern.confidence)]}>
                              {Math.round(pattern.confidence * 100)}%
                            </span>
                          </span>
                          <span>{pattern.events} events</span>
                          {pattern.suggestedAction && (
                            <span>Suggested: {pattern.suggestedAction}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Events */}
      <Card>
        <CardHeader>
          <CardTitle>Learning Events</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                placeholder="Search events..."
              />
            </div>
            <Select value={typeFilter} onValueChange={(v) => v && setTypeFilter(v)}>
              <SelectTrigger>
                <SelectValue>{typeFilter === 'all' ? 'All Types' : typeFilter}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="observation">Observation</SelectItem>
                <SelectItem value="pattern">Pattern</SelectItem>
                <SelectItem value="insight">Insight</SelectItem>
                <SelectItem value="feedback">Feedback</SelectItem>
                <SelectItem value="correction">Correction</SelectItem>
              </SelectContent>
            </Select>
            <Select value={impactFilter} onValueChange={(v) => v && setImpactFilter(v)}>
              <SelectTrigger>
                <SelectValue>{impactFilter === 'all' ? 'All Impacts' : impactFilter}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Impacts</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="space-y-2">
              {['a', 'b', 'c', 'd', 'e'].map((k) => (
                <div
                  key={`evt-skeleton-${k}`}
                  className="h-14 w-full animate-pulse rounded bg-muted"
                />
              ))}
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-12 w-12 text-muted mb-4" />
              <p className="text-lg font-medium text-foreground">No events found</p>
              <p className="text-sm text-muted-foreground mt-1">
                {data?.recentEvents.length === 0
                  ? 'Record a learning event to see it here.'
                  : 'Try adjusting your search or filters.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-start justify-between rounded-lg border border-border p-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">{typeIcons[event.type]}</div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{event.source}</span>
                        <Badge
                          variant="outline"
                          className={`text-xs ${impactColors[event.impact]}`}
                        >
                          {event.impact}
                        </Badge>
                        <Badge variant={event.applied ? 'success' : 'warning'} className="text-xs">
                          {event.applied ? 'Applied' : 'Pending'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">{event.content}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="capitalize">{event.type}</span>
                        <span>{formatRelativeTime(event.timestamp)}</span>
                        {event.missionId && <span>Mission: {event.missionId}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Anomalies */}
      {(data?.anomalies ?? []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Detected Anomalies
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(data?.anomalies ?? []).map((anomaly) => (
                <div
                  key={anomaly.id}
                  className="flex items-start gap-3 rounded-lg border border-border p-3"
                >
                  <XCircle className="h-4 w-4 text-red-500 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{anomaly.description}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <Badge
                        variant="outline"
                        className={`text-xs ${impactColors[anomaly.severity]}`}
                      >
                        {anomaly.severity}
                      </Badge>
                      <span>{formatRelativeTime(anomaly.timestamp)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
