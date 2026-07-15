'use client';

import { AlertTriangle, CheckCircle, Clock, FileSearch, Info, Shield, XCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useFetch } from '@/lib/hooks/use-api';
import { resultVariant, severityVariant } from '@/lib/status-maps';
import { formatDate } from '@/lib/utils';
import type { AuditEvent } from '@/types';

interface AuditResponse {
  auditEvents?: AuditEvent[];
}

const severityIcon: Record<string, React.ReactNode> = {
  critical: <XCircle className="h-4 w-4 text-red-500" />,
  high: <AlertTriangle className="h-4 w-4 text-orange-500" />,
  medium: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
  low: <Info className="h-4 w-4 text-blue-500" />,
  info: <Info className="h-4 w-4 text-muted-foreground" />,
};

const severityFilters = ['all', 'critical', 'high', 'medium', 'low', 'info'] as const;

export default function AuditPage() {
  const { data, loading } = useFetch<AuditResponse>('/api/audit');
  const events = data?.auditEvents ?? [];

  const [severityFilter, setSeverityFilter] = useState<string>('all');

  const filteredEvents = useMemo(() => {
    if (severityFilter === 'all') return events;
    return events.filter((e) => e.severity === severityFilter);
  }, [events, severityFilter]);

  const criticalCount = events.filter((e) => e.severity === 'critical').length;
  const warningCount = events.filter(
    (e) => e.severity === 'medium' || e.severity === 'high',
  ).length;
  const passedCount = events.filter((e) => e.result === 'pass').length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Events
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-7 w-12 animate-pulse rounded bg-muted" />
            ) : (
              <div className="text-2xl font-bold text-foreground">{events.length}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Critical</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-7 w-12 animate-pulse rounded bg-muted" />
            ) : (
              <div className="text-2xl font-bold text-red-500">{criticalCount}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Warnings</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-7 w-12 animate-pulse rounded bg-muted" />
            ) : (
              <div className="text-2xl font-bold text-yellow-500">{warningCount}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Passed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-7 w-12 animate-pulse rounded bg-muted" />
            ) : (
              <div className="text-2xl font-bold text-green-500">{passedCount}</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle>Event Log</CardTitle>
            <Select value={severityFilter} onValueChange={(v) => v && setSeverityFilter(v)}>
              <SelectTrigger>
                <SelectValue>
                  {severityFilter === 'all' ? 'All Severities' : severityFilter}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {severityFilters.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s === 'all' ? 'All Severities' : s.charAt(0).toUpperCase() + s.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm">
            <Shield className="h-4 w-4 mr-1" />
            Export
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((k) => (
                <div
                  key={`audit-skeleton-${k}`}
                  className="h-10 w-full animate-pulse rounded bg-muted"
                />
              ))}
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FileSearch className="h-12 w-12 text-muted mb-4" />
              <p className="text-lg font-medium text-foreground">No audit events found</p>
              <p className="text-sm text-muted-foreground mt-1">
                {events.length === 0
                  ? 'Run an audit to see events here.'
                  : 'No events match the selected severity filter.'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Agent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEvents.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="text-muted-foreground font-mono text-xs">
                      {formatDate(event.timestamp)}
                    </TableCell>
                    <TableCell className="text-foreground">{event.type}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {severityIcon[event.severity]}
                        <Badge variant={severityVariant[event.severity]}>{event.severity}</Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={resultVariant[event.result]}>{event.result}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-md truncate">
                      {event.description}
                    </TableCell>
                    <TableCell>
                      {event.agent ? (
                        <Badge variant="outline">{event.agent}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
