'use client';

import { ChevronDown, ChevronUp, Inbox, Plus, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { priorityVariant, statusVariant } from '@/lib/status-maps';
import { formatRelativeTime } from '@/lib/utils';
import type { Mission, MissionPriority, MissionType } from '@/types';

interface MissionsResponse {
  missions?: Mission[];
  total?: number;
}

const missionTypes: MissionType[] = [
  'feature',
  'bugfix',
  'refactor',
  'research',
  'incident',
  'experiment',
  'custom',
];
const missionPriorities: MissionPriority[] = ['critical', 'high', 'medium', 'low'];

export default function MissionsPage() {
  const { data, loading } = useFetch<MissionsResponse>('/api/missions');
  const missions = data?.missions ?? [];

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    type: 'feature' as MissionType,
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
        window.location.reload();
      }
    } catch {
      // keep empty
    }
  }

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
        setForm({ title: '', description: '', type: 'feature', priority: 'medium' });
        await fetchMissions();
      } else {
        const json = await res.json();
        setError(json.error || 'Failed to create mission');
      }
    } catch {
      setError('Network error');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-64"
              placeholder="Search missions..."
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
            <SelectTrigger>
              <SelectValue>{statusFilter === 'all' ? 'All Statuses' : statusFilter}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="executing">Executing</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? <X className="h-4 w-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
          {showCreate ? 'Cancel' : 'New Mission'}
        </Button>
      </div>

      {showCreate && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle>Create New Mission</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="mission-title" className="text-sm text-muted-foreground">
                    Title *
                  </label>
                  <Input
                    id="mission-title"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="Mission title"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="mission-desc" className="text-sm text-muted-foreground">
                    Description
                  </label>
                  <Input
                    id="mission-desc"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Brief description"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="mission-type" className="text-sm text-muted-foreground">
                    Type
                  </label>
                  <Select
                    value={form.type}
                    onValueChange={(v) => v && setForm({ ...form, type: v as MissionType })}
                  >
                    <SelectTrigger id="mission-type" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {missionTypes.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label htmlFor="mission-priority" className="text-sm text-muted-foreground">
                    Priority
                  </label>
                  <Select
                    value={form.priority}
                    onValueChange={(v) => v && setForm({ ...form, priority: v as MissionPriority })}
                  >
                    <SelectTrigger id="mission-priority" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {missionPriorities.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
              {['a', 'b', 'c', 'd', 'e'].map((k) => (
                <div
                  key={`mission-skeleton-${k}`}
                  className="h-12 w-full animate-pulse rounded bg-muted"
                />
              ))}
            </div>
          ) : filteredMissions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Inbox className="h-12 w-12 text-muted mb-4" />
              <p className="text-lg font-medium text-foreground">No missions found</p>
              <p className="text-sm text-muted-foreground mt-1">
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
                  <TableRow key={mission.id}>
                    <TableCell>
                      <button
                        type="button"
                        className="cursor-pointer"
                        onClick={() => setExpandedId(expandedId === mission.id ? null : mission.id)}
                      >
                        {expandedId === mission.id ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-foreground">{mission.title}</p>
                        <p className="text-xs text-muted-foreground">{mission.id}</p>
                      </div>
                    </TableCell>
                    <TableCell className="capitalize text-muted-foreground">
                      {mission.type}
                    </TableCell>
                    <TableCell>
                      <Badge variant={priorityVariant[mission.priority]}>{mission.priority}</Badge>
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
                        <div className="h-2 w-20 rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary animate-progress"
                            style={{ width: `${mission.progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">{mission.progress}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatRelativeTime(mission.createdAt)}
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
