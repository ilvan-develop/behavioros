'use client';

import { ChevronDown, ChevronUp, Filter, Inbox, Plus, Search, X } from 'lucide-react';
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
import { formatRelativeTime } from '@/lib/utils';
import type { Mission, MissionPriority, MissionType } from '@/types';

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

const missionTypes: MissionType[] = ['build', 'review', 'deploy', 'research', 'monitor'];
const missionPriorities: MissionPriority[] = ['critical', 'high', 'medium', 'low'];
const statusFilters = ['all', 'draft', 'executing', 'completed', 'failed'] as const;

export default function MissionsPage() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    type: 'build' as MissionType,
    priority: 'medium' as MissionPriority,
  });
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredMissions = useMemo(() => {
    return missions.filter((m) => {
      const matchesSearch =
        !searchQuery ||
        m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || m.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [missions, searchQuery, statusFilter]);

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

  useEffect(() => {
    fetchMissions();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      setError('Title is required');
      return;
    }
    setCreating(true);
    setError('');
    try {
      const res = await fetch('/api/missions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setShowCreate(false);
        setForm({ title: '', description: '', type: 'build', priority: 'medium' });
        await fetchMissions();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to create mission');
      }
    } catch {
      setError('Network error');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header title="Missions" description="Track and manage AI missions" />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#52525b]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="rounded-md border border-[#262626] bg-[#0a0a0a] pl-9 pr-3 py-2 text-sm text-[#fafafa] placeholder:text-[#52525b] focus:border-[#0A7C4F] focus:outline-none w-64"
                    placeholder="Search missions..."
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-md border border-[#262626] bg-[#0a0a0a] px-3 py-2 text-sm text-[#fafafa] focus:border-[#0A7C4F] focus:outline-none"
                >
                  {statusFilters.map((s) => (
                    <option key={s} value={s}>
                      {s === 'all' ? 'All Statuses' : s.charAt(0).toUpperCase() + s.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
                {showCreate ? <X className="h-4 w-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                {showCreate ? 'Cancel' : 'New Mission'}
              </Button>
            </div>

            {showCreate && (
              <Card className="border-[#0A7C4F]/30">
                <CardHeader>
                  <CardTitle>Create New Mission</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCreate} className="space-y-4">
                    {error && <p className="text-sm text-red-500">{error}</p>}
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm text-[#a1a1aa]">Title *</label>
                        <input
                          type="text"
                          value={form.title}
                          onChange={(e) => setForm({ ...form, title: e.target.value })}
                          className="w-full rounded-md border border-[#262626] bg-[#0a0a0a] px-3 py-2 text-sm text-[#fafafa] placeholder:text-[#52525b] focus:border-[#0A7C4F] focus:outline-none"
                          placeholder="Mission title"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm text-[#a1a1aa]">Description</label>
                        <input
                          type="text"
                          value={form.description}
                          onChange={(e) => setForm({ ...form, description: e.target.value })}
                          className="w-full rounded-md border border-[#262626] bg-[#0a0a0a] px-3 py-2 text-sm text-[#fafafa] placeholder:text-[#52525b] focus:border-[#0A7C4F] focus:outline-none"
                          placeholder="Brief description"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm text-[#a1a1aa]">Type</label>
                        <select
                          value={form.type}
                          onChange={(e) =>
                            setForm({ ...form, type: e.target.value as MissionType })
                          }
                          className="w-full rounded-md border border-[#262626] bg-[#0a0a0a] px-3 py-2 text-sm text-[#fafafa] focus:border-[#0A7C4F] focus:outline-none"
                        >
                          {missionTypes.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm text-[#a1a1aa]">Priority</label>
                        <select
                          value={form.priority}
                          onChange={(e) =>
                            setForm({ ...form, priority: e.target.value as MissionPriority })
                          }
                          className="w-full rounded-md border border-[#262626] bg-[#0a0a0a] px-3 py-2 text-sm text-[#fafafa] focus:border-[#0A7C4F] focus:outline-none"
                        >
                          {missionPriorities.map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" size="sm" disabled={creating}>
                        {creating ? 'Creating...' : 'Create Mission'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setShowCreate(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>All Missions ({filteredMissions.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="h-12 w-full animate-pulse rounded bg-[#262626]" />
                    ))}
                  </div>
                ) : filteredMissions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Inbox className="h-12 w-12 text-[#262626] mb-4" />
                    <p className="text-lg font-medium text-[#fafafa]">No missions found</p>
                    <p className="text-sm text-[#a1a1aa] mt-1">
                      {missions.length === 0
                        ? 'Create your first mission to get started.'
                        : 'Try adjusting your search or filters.'}
                    </p>
                  </div>
                ) : (
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
                      {filteredMissions.map((mission) => (
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
                              <Badge variant={statusVariant[mission.status]}>
                                {mission.status}
                              </Badge>
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
                                    <h4 className="text-sm font-medium text-[#fafafa] mb-1">
                                      Tags
                                    </h4>
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
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
