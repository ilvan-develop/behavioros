'use client';

import { AlertTriangle, CheckCircle, Clock, Info, Shield, XCircle } from 'lucide-react';
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
import { auditEvents } from '@/lib/mock-data';
import { formatDate } from '@/lib/utils';

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

export default function AuditPage() {
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
                  <div className="text-2xl font-bold text-[#fafafa]">{auditEvents.length}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-[#a1a1aa]">Critical</CardTitle>
                  <XCircle className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-500">
                    {auditEvents.filter((e) => e.severity === 'critical').length}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-[#a1a1aa]">Warnings</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-500">
                    {
                      auditEvents.filter((e) => e.severity === 'medium' || e.severity === 'high')
                        .length
                    }
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-[#a1a1aa]">Passed</CardTitle>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-500">
                    {auditEvents.filter((e) => e.result === 'pass').length}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Event Log</CardTitle>
                <Button variant="outline" size="sm">
                  <Shield className="h-4 w-4 mr-1" />
                  Export
                </Button>
              </CardHeader>
              <CardContent>
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
                    {auditEvents.map((event) => (
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
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
