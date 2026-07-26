'use client';

import { Puzzle, Search, Terminal } from 'lucide-react';
import { useMemo, useState } from 'react';
import { SourceBadge } from '@/components/dashboard/source-badge';
import { StatusBadge } from '@/components/dashboard/status-badge';
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
import { useFetch } from '@/lib/hooks/use-api';
import { cn } from '@/lib/utils';
import type { EcosystemSkill, SkillSource } from '@/types';

interface SkillsResponse {
  skills: EcosystemSkill[];
  total: number;
  categories: string[];
  sources: SkillSource[];
}

export default function SkillsPage() {
  const { data, loading } = useFetch<SkillsResponse>('/api/ecosystem/skills');
  const skills = data?.skills ?? [];

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [installingId, setInstallingId] = useState<string | null>(null);

  const filteredSkills = useMemo(() => {
    return skills.filter((s) => {
      const matchesSearch =
        !searchQuery ||
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || s.category === categoryFilter;
      const matchesSource = sourceFilter === 'all' || s.source === sourceFilter;
      return matchesSearch && matchesCategory && matchesSource;
    });
  }, [skills, searchQuery, categoryFilter, sourceFilter]);

  async function handleInstall(skill: EcosystemSkill) {
    setInstallingId(skill.id);
    try {
      await fetch('/api/ecosystem/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'skill', id: skill.id, source: skill.source }),
      });
      // Simulate brief install delay
      await new Promise((r) => setTimeout(r, 800));
    } catch {
      // ignore
    } finally {
      setInstallingId(null);
    }
  }

  const categories = data?.categories ?? [];
  const sources = data?.sources ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Puzzle className="h-5 w-5 text-primary" />
          <span className="text-sm text-muted-foreground">
            {loading ? 'Loading...' : `${filteredSkills.length} skills`}
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 w-64"
            placeholder="Search skills..."
          />
        </div>

        <Select value={categoryFilter} onValueChange={(v) => v && setCategoryFilter(v)}>
          <SelectTrigger>
            <SelectValue>
              {categoryFilter === 'all' ? 'All Categories' : categoryFilter}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sourceFilter} onValueChange={(v) => v && setSourceFilter(v)}>
          <SelectTrigger>
            <SelectValue>{sourceFilter === 'all' ? 'All Sources' : sourceFilter}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            {sources.map((src) => (
              <SelectItem key={src} value={src}>
                {src.toUpperCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Skills List */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {['a', 'b', 'c', 'd', 'e', 'f'].map((k) => (
            <div
              key={`skill-skeleton-${k}`}
              className="h-40 w-full animate-pulse rounded-lg border border-border bg-card"
            />
          ))}
        </div>
      ) : filteredSkills.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Puzzle className="h-12 w-12 text-muted mb-4" />
            <p className="text-lg font-medium text-foreground">No skills found</p>
            <p className="text-sm text-muted-foreground mt-1">
              {skills.length === 0
                ? 'No skills are available. Run a sync to discover skills.'
                : 'Try adjusting your search or filters.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredSkills.map((skill) => (
            <Card
              key={skill.id}
              className={cn(
                'hover:border-border/60 transition-colors',
                expandedId === skill.id && 'border-primary/30',
              )}
            >
              <CardHeader
                className="flex flex-row items-start justify-between space-y-0 cursor-pointer"
                onClick={() => setExpandedId(expandedId === skill.id ? null : skill.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Puzzle className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{skill.name}</CardTitle>
                    <p className="text-xs text-muted-foreground">v{skill.version}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <SourceBadge source={skill.source} />
                  <StatusBadge status={skill.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{skill.description}</p>

                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {skill.category}
                  </Badge>
                  {skill.source !== 'aitmpl' && skill.source !== 'bos' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7"
                      disabled={installingId === skill.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleInstall(skill);
                      }}
                    >
                      {installingId === skill.id ? (
                        <>Installing...</>
                      ) : (
                        <>
                          <Terminal className="h-3 w-3 mr-1" />
                          Install
                        </>
                      )}
                    </Button>
                  )}
                </div>

                {expandedId === skill.id && (
                  <div className="pt-3 border-t border-border space-y-3">
                    {skill.prerequisites.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          Prerequisites
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {skill.prerequisites.map((p) => (
                            <Badge key={p} variant="outline" className="text-xs">
                              {p}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        Install Command
                      </p>
                      <pre className="rounded-md bg-muted px-3 py-2 text-xs font-mono text-foreground overflow-x-auto">
                        {skill.installCommand}
                      </pre>
                    </div>

                    {Object.keys(skill.metadata).length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Metadata</p>
                        <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                          {Object.entries(skill.metadata).map(([key, value]) => (
                            <div key={key} className="flex items-center gap-1">
                              <span className="font-medium">{key}:</span>
                              <span>{value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
