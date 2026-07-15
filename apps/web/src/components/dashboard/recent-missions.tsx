'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useFetch } from '@/lib/hooks/use-api';
import { priorityVariant, statusVariant } from '@/lib/status-maps';
import { formatRelativeTime } from '@/lib/utils';
import type { Mission } from '@/types';

interface MissionsResponse {
  missions?: Mission[];
  total?: number;
}

export function RecentMissions() {
  const { data, loading } = useFetch<MissionsResponse>('/api/missions');
  const missions = data?.missions ?? [];
  const recentMissions = missions.slice(0, 5);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Recent Missions</CardTitle>
        <Link href="/missions" className="text-sm text-primary hover:underline">
          View all
        </Link>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {['a', 'b', 'c', 'd', 'e'].map((k) => (
              <div
                key={`recent-skeleton-${k}`}
                className="h-10 w-full animate-pulse rounded bg-muted"
              />
            ))}
          </div>
        ) : recentMissions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No missions yet. Create one to get started.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentMissions.map((mission) => (
                <TableRow key={mission.id}>
                  <TableCell className="font-medium text-foreground">{mission.title}</TableCell>
                  <TableCell className="capitalize text-muted-foreground">{mission.type}</TableCell>
                  <TableCell>
                    <Badge variant={priorityVariant[mission.priority]}>{mission.priority}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[mission.status]}>{mission.status}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatRelativeTime(mission.updatedAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
