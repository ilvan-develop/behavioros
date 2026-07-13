'use client';

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
import { missions } from '@/lib/mock-data';
import { formatRelativeTime } from '@/lib/utils';

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
      </CardContent>
    </Card>
  );
}
