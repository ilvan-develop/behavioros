'use client';

import { ChevronDown, ChevronUp, Filter, Plus } from 'lucide-react';
import { useState } from 'react';
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

export default function MissionsPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header title="Missions" description="Track and manage AI missions" />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-1" />
                  Filter
                </Button>
              </div>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                New Mission
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>All Missions ({missions.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Assigned</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {missions.map((mission) => (
                      <>
                        <TableRow
                          key={mission.id}
                          className="cursor-pointer"
                          onClick={() =>
                            setExpandedId(expandedId === mission.id ? null : mission.id)
                          }
                        >
                          <TableCell>
                            {expandedId === mission.id ? (
                              <ChevronUp className="h-4 w-4 text-[#a1a1aa]" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-[#a1a1aa]" />
                            )}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium text-[#fafafa]">{mission.title}</p>
                              <p className="text-xs text-[#a1a1aa]">{mission.id}</p>
                            </div>
                          </TableCell>
                          <TableCell className="capitalize text-[#a1a1aa]">
                            {mission.type}
                          </TableCell>
                          <TableCell>
                            <Badge variant={priorityVariant[mission.priority]}>
                              {mission.priority}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusVariant[mission.status]}>{mission.status}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {mission.assignedTo.map((agent: string) => (
                                <Badge key={agent} variant="outline" className="text-xs">
                                  {agent}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-20 rounded-full bg-[#262626]">
                                <div
                                  className="h-full rounded-full bg-[#0A7C4F] animate-progress"
                                  style={{ width: `${mission.progress}%` }}
                                />
                              </div>
                              <span className="text-xs text-[#a1a1aa]">{mission.progress}%</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-[#a1a1aa]">
                            {formatRelativeTime(mission.createdAt)}
                          </TableCell>
                        </TableRow>
                        {expandedId === mission.id && (
                          <TableRow key={`${mission.id}-details`}>
                            <TableCell colSpan={8} className="bg-[#0a0a0a]">
                              <div className="p-4 space-y-4">
                                <div>
                                  <h4 className="text-sm font-medium text-[#fafafa] mb-1">
                                    Description
                                  </h4>
                                  <p className="text-sm text-[#a1a1aa]">{mission.description}</p>
                                </div>
                                <div>
                                  <h4 className="text-sm font-medium text-[#fafafa] mb-1">Tags</h4>
                                  <div className="flex gap-2">
                                    {mission.tags.map((tag: string) => (
                                      <Badge key={tag} variant="secondary">
                                        {tag}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <Button size="sm" variant="outline">
                                    Edit Mission
                                  </Button>
                                  <Button size="sm" variant="outline">
                                    View Logs
                                  </Button>
                                  {mission.status === 'draft' && (
                                    <Button size="sm">Start Mission</Button>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
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
