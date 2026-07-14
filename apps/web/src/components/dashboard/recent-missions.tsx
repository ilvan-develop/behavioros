'use client';

import { useEffect, useState } from 'react';
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
import { formatRelativeTime } from '@/lib/utils';
import type { Mission } from '@/types';

interface MissionsResponse {
  missions?: Mission[];
  total?: number;
}

const statusVariant: Record<
  string,
  'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'info'
> = {
  draft: 'secondary',
  executing: 'info',
  completed: 'success',
  failed: 'destructive',
  paused: 'warning',
};

const priorityVariant: Record<string, 'destructive' | 'warning' | 'secondary' | 'outline'> = {
  critical: 'destructive',
  high: 'warning',
  medium: 'secondary',
  low: 'outline',
};

export function RecentMissions() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMissions() {
      try {
        const res = await fetch('/api/missions');
        if (res.ok) {
          const data: MissionsResponse = await res.json();
          setMissions(data.missions ?? []);
        }
      } catch {
        // keep empty
      } finally {
        setLoading(false);
      }
    }
    fetchMissions();
  }, []);

  const recentMissions = missions.slice(0, 5);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Recent Missions</CardTitle>
        <a href="/missions" className="text-sm text-[#0A7C4F] hover:underline">
          View all
        </a>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 w-full animate-pulse rounded bg-[#262626]" />
            ))}
          </div>
        ) : recentMissions.length === 0 ? (
          <p className="text-sm text-[#a1a1aa] py-4 text-center">
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
                  <TableCell className="font-medium text-[#fafafa]">{mission.title}</TableCell>
                  <TableCell className="capitalize text-[#a1a1aa]">{mission.type}</TableCell>
                  <TableCell>
                    <Badge variant={priorityVariant[mission.priority]}>{mission.priority}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[mission.status]}>{mission.status}</Badge>
                  </TableCell>
                  <TableCell className="text-[#a1a1aa]">
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
