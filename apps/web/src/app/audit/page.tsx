'use client';

import { AlertTriangle, CheckCircle, Clock, FileSearch, Info, Shield, XCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Header } from '@/components/layout/header';
import { Sidebar } from '@/components/layout/sidebar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  info: <Info className="h-4 w-4 text-[#a1a1aa]" />,
};

const severityVariant: Record<
  string,
  'destructive' | 'warning' | 'info' | 'secondary' | 'outline'
> = {
  critical: 'destructive',
  high: 'warning',
  medium: 'info',
  low: 'secondary',
  info: 'outline',
};

const resultVariant: Record<string, 'success' | 'destructive' | 'warning'> = {
  pass: 'success',
  fail: 'destructive',
  warn: 'warning',
};

const severityFilters = ['all', 'critical', 'high', 'medium', 'low', 'info'] as const;

export default function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<string>('all');

  const filteredEvents = useMemo(() => {
    if (severityFilter === 'all') return events;
    return events.filter((e) => e.severity === severityFilter);
  }, [events, severityFilter]);

  useEffect(() => {
    async function fetchAudit() {
      try {
        const res = await fetch('/api/audit');
        if (res.ok) {
          const data: AuditResponse = await res.json();
          setEvents(data.auditEvents ?? []);
        }
      } catch {
        // keep empty
      } finally {
        setLoading(false);
      }
    }
    fetchAudit();
  }, []);

  const criticalCount = events.filter((e) => e.severity === 'critical').length;
  const warningCount = events.filter(
    (e) => e.severity === 'medium' || e.severity === 'high',
  ).length;
  const passedCount = events.filter((e) => e.result === 'pass').length;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header title="Audit Log" description="Track all system events and actions" />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-[#a1a1aa]">Total Events</CardTitle>
                  <Clock className="h-4 w-4 text-[#a1a1aa]" />
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="h-7 w-12 animate-pulse rounded bg-[#262626]" />
                  ) : (
                    <div className="text-2xl font-bold text-[#fafafa]">{events.length}</div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-[#a1a1aa]">Critical</CardTitle>
                  <XCircle className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="h-7 w-12 animate-pulse rounded bg-[#262626]" />
                  ) : (
                    <div className="text-2xl font-bold text-red-500">{criticalCount}</div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-[#a1a1aa]">Warnings</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="h-7 w-12 animate-pulse rounded bg-[#262626]" />
                  ) : (
                    <div className="text-2xl font-bold text-yellow-500">{warningCount}</div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-[#a1a1aa]">Passed</CardTitle>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="h-7 w-12 animate-pulse rounded bg-[#262626]" />
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
                  <select
                    value={severityFilter}
                    onChange={(e) => setSeverityFilter(e.target.value)}
                    className="rounded-md border border-[#262626] bg-[#0a0a0a] px-3 py-2 text-sm text-[#fafafa] focus:border-[#0A7C4F] focus:outline-none"
                  >
                    {severityFilters.map((s) => (
                      <option key={s} value={s}>
                        {s === 'all' ? 'All Severities' : s.charAt(0).toUpperCase() + s.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <Button variant="outline" size="sm">
                  <Shield className="h-4 w-4 mr-1" />
                  Export
                </Button>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="h-10 w-full animate-pulse rounded bg-[#262626]" />
                    ))}
                  </div>
                ) : filteredEvents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <FileSearch className="h-12 w-12 text-[#262626] mb-4" />
                    <p className="text-lg font-medium text-[#fafafa]">No audit events found</p>
                    <p className="text-sm text-[#a1a1aa] mt-1">
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
                          <TableCell className="text-[#a1a1aa] font-mono text-xs">
                            {formatDate(event.timestamp)}
                          </TableCell>
                          <TableCell className="text-[#fafafa]">{event.type}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {severityIcon[event.severity]}
                              <Badge variant={severityVariant[event.severity]}>
                                {event.severity}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={resultVariant[event.result]}>{event.result}</Badge>
                          </TableCell>
                          <TableCell className="text-[#a1a1aa] max-w-md truncate">
                            {event.description}
                          </TableCell>
                          <TableCell>
                            {event.agent ? (
                              <Badge variant="outline">{event.agent}</Badge>
                            ) : (
                              <span className="text-[#a1a1aa]">-</span>
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
        </main>
      </div>
    </div>
  );
}
