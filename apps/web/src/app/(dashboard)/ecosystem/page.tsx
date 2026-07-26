'use client';

import { Blocks, Box, BugPlay, Cpu, Dna, Puzzle, RefreshCw, Wrench } from 'lucide-react';
import { useMemo } from 'react';
import { SourceBadge } from '@/components/dashboard/source-badge';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFetch } from '@/lib/hooks/use-api';
import type { EcosystemSummary } from '@/types';

export default function EcosystemPage() {
  const { data, loading } = useFetch<EcosystemSummary>('/api/ecosystem');

  const statsCards = useMemo(() => {
    if (!data) return [];
    return [
      {
        title: 'Total Skills',
        value: data.totalSkills,
        icon: <Puzzle className="h-4 w-4" />,
        detail: `${data.activeSkills} active`,
      },
      {
        title: 'Connected MCPs',
        value: data.connectedMCPs,
        icon: <Cpu className="h-4 w-4" />,
        detail: `of ${data.totalMCPs} total`,
      },
      {
        title: 'Active Agents',
        value: data.activeAgents,
        icon: <Box className="h-4 w-4" />,
        detail: 'registered in system',
      },
      {
        title: 'Design Systems',
        value: data.designSystemCount,
        icon: <Blocks className="h-4 w-4" />,
        detail: 'components available',
      },
    ];
  }, [data]);

  async function handleQuickAction(action: string) {
    try {
      const endpoint =
        action === 'install'
          ? '/api/ecosystem/install'
          : action === 'sync'
            ? '/api/ecosystem/sync'
            : '/api/ecosystem/doctor';
      const method = action === 'install' ? 'POST' : 'POST';
      const body =
        action === 'install' ? { type: 'skill', id: 'all' } : action === 'sync' ? {} : {};

      await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      window.location.reload();
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statsCards.map((stat) => (
          <Card key={stat.title} className="hover:border-border/60 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className="text-muted-foreground">{stat.icon}</div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-7 w-16 animate-pulse rounded bg-muted" />
              ) : (
                <>
                  <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                  <p className="text-xs text-muted-foreground">{stat.detail}</p>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" onClick={() => handleQuickAction('install')}>
          <Wrench className="h-4 w-4 mr-1" />
          Install
        </Button>
        <Button size="sm" variant="outline" onClick={() => handleQuickAction('sync')}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Sync
        </Button>
        <Button size="sm" variant="outline" onClick={() => handleQuickAction('doctor')}>
          <BugPlay className="h-4 w-4 mr-1" />
          Doctor
        </Button>
      </div>

      {/* Skills Grid */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Skills ({data?.skills?.length ?? 0})</CardTitle>
          {!loading && data && data.skills.length > 4 && (
            <a
              href="/ecosystem/skills"
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              View all
            </a>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {['a', 'b', 'c', 'd'].map((k) => (
                <div
                  key={`sk-skeleton-${k}`}
                  className="h-32 w-full animate-pulse rounded-lg border border-border bg-card"
                />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {data?.skills?.slice(0, 4).map((skill) => (
                <Card key={skill.id} className="hover:border-border/60 transition-colors">
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                        <Puzzle className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-sm">{skill.name}</CardTitle>
                        <p className="text-xs text-muted-foreground">v{skill.version}</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                      {skill.description}
                    </p>
                    <div className="flex items-center gap-2">
                      <SourceBadge source={skill.source} />
                      <StatusBadge status={skill.status} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* MCPs Grid */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>MCP Servers ({data?.mcps?.length ?? 0})</CardTitle>
          {!loading && data && data.mcps.length > 4 && (
            <a
              href="/ecosystem/mcps"
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              View all
            </a>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {['a', 'b', 'c', 'd'].map((k) => (
                <div
                  key={`mcp-skeleton-${k}`}
                  className="h-24 w-full animate-pulse rounded-lg border border-border bg-card"
                />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {data?.mcps?.slice(0, 4).map((mcp) => (
                <Card key={mcp.id} className="hover:border-border/60 transition-colors">
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                        <Cpu className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-sm">{mcp.name}</CardTitle>
                        <p className="text-xs text-muted-foreground">{mcp.toolsCount} tools</p>
                      </div>
                    </div>
                    <StatusBadge status={mcp.status} />
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Design Systems Grid */}
      <Card>
        <CardHeader>
          <CardTitle>Design Systems ({data?.designSystems?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {['a', 'b', 'c', 'd'].map((k) => (
                <div
                  key={`ds-skeleton-${k}`}
                  className="h-20 w-full animate-pulse rounded-lg border border-border bg-card"
                />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {data?.designSystems?.map((ds) => (
                <Card key={ds.id} className="hover:border-border/60 transition-colors">
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                        <Blocks className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-sm">{ds.name}</CardTitle>
                        <p className="text-xs text-muted-foreground">v{ds.version}</p>
                      </div>
                    </div>
                    <StatusBadge status={ds.status} />
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      {ds.components > 0 ? `${ds.components} components` : ds.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* DNA Quick Reference */}
      <Card>
        <CardHeader>
          <CardTitle>Behavioral DNA Patterns</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                name: 'Enterprise Governance',
                desc: 'Enterprise governance patterns for AI agent teams',
                icon: <Dna className="h-4 w-4" />,
              },
              {
                name: 'Military Operations',
                desc: 'Chain of command and strict hierarchy patterns',
                icon: <Dna className="h-4 w-4" />,
              },
              {
                name: 'Surgical Team',
                desc: 'Zero-defect precision for critical operations',
                icon: <Dna className="h-4 w-4" />,
              },
              {
                name: 'Lean Factory',
                desc: 'Kaizen continuous improvement patterns',
                icon: <Dna className="h-4 w-4" />,
              },
            ].map((pattern) => (
              <div
                key={pattern.name}
                className="flex items-start gap-3 rounded-lg border border-border p-3"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                  {pattern.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{pattern.name}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{pattern.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
