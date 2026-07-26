'use client';

import {
  Blocks,
  Box,
  Cpu,
  Dna,
  Download,
  FileDown,
  FileJson,
  FileText as FileTextIcon,
  Puzzle,
} from 'lucide-react';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFetch } from '@/lib/hooks/use-api';
import { cn } from '@/lib/utils';
import type { EcosystemSummary } from '@/types';

function DistributionBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground">
          {count} ({pct}%)
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function SummaryTab({ data }: { data: EcosystemSummary }) {
  const total = data.totalSkills + data.totalMCPs + data.designSystemCount + data.activeAgents;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Components
            </CardTitle>
            <Box className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Skills</CardTitle>
            <Puzzle className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-500">{data.totalSkills}</div>
            <p className="text-xs text-muted-foreground">{data.activeSkills} active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">MCPs</CardTitle>
            <Cpu className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">{data.totalMCPs}</div>
            <p className="text-xs text-muted-foreground">{data.connectedMCPs} connected</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Design Systems
            </CardTitle>
            <Blocks className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-500">{data.designSystemCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Component Distribution</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <DistributionBar
            label="Skills"
            count={data.totalSkills}
            total={total}
            color="bg-purple-500"
          />
          <DistributionBar label="MCPs" count={data.totalMCPs} total={total} color="bg-blue-500" />
          <DistributionBar
            label="Design Systems"
            count={data.designSystemCount}
            total={total}
            color="bg-amber-500"
          />
          <DistributionBar
            label="Active Agents"
            count={data.activeAgents}
            total={total}
            color="bg-green-500"
          />
        </CardContent>
      </Card>
    </div>
  );
}

function AgentsTab({ data }: { data: EcosystemSummary }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Agents Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Box className="h-16 w-16 text-muted mx-auto mb-4" />
            <p className="text-lg font-medium text-foreground">{data.activeAgents} Active Agents</p>
            <p className="text-sm text-muted-foreground mt-1">
              Agent details available on the Agents page.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SkillsTab({ data }: { data: EcosystemSummary }) {
  const sourceDist = useMemo(() => {
    const dist: Record<string, number> = {};
    for (const s of data.skills) {
      dist[s.source] = (dist[s.source] ?? 0) + 1;
    }
    return dist;
  }, [data.skills]);

  const statusDist = useMemo(() => {
    const dist: Record<string, number> = {};
    for (const s of data.skills) {
      dist[s.status] = (dist[s.status] ?? 0) + 1;
    }
    return dist;
  }, [data.skills]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Skills by Source</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Object.entries(sourceDist).map(([source, count]) => (
            <DistributionBar
              key={source}
              label={source.toUpperCase()}
              count={count}
              total={data.skills.length}
              color={
                source === 'aitmpl'
                  ? 'bg-purple-500'
                  : source === 'od'
                    ? 'bg-blue-500'
                    : source === 'bos'
                      ? 'bg-amber-500'
                      : 'bg-green-500'
              }
            />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Skills by Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Object.entries(statusDist).map(([status, count]) => (
            <DistributionBar
              key={status}
              label={status.charAt(0).toUpperCase() + status.slice(1)}
              count={count}
              total={data.skills.length}
              color={
                status === 'active'
                  ? 'bg-green-500'
                  : status === 'inactive'
                    ? 'bg-gray-500'
                    : status === 'outdated'
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
              }
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function MCPsTab({ data }: { data: EcosystemSummary }) {
  const statusDist = useMemo(() => {
    const dist: Record<string, number> = {};
    for (const m of data.mcps) {
      dist[m.status] = (dist[m.status] ?? 0) + 1;
    }
    return dist;
  }, [data.mcps]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>MCP Server Status Distribution</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {Object.entries(statusDist).map(([status, count]) => (
          <DistributionBar
            key={status}
            label={status.charAt(0).toUpperCase() + status.slice(1)}
            count={count}
            total={data.mcps.length}
            color={
              status === 'connected'
                ? 'bg-green-500'
                : status === 'offline'
                  ? 'bg-gray-500'
                  : 'bg-red-500'
            }
          />
        ))}
      </CardContent>
    </Card>
  );
}

function DesignSystemsTab({ data }: { data: EcosystemSummary }) {
  const statusDist = useMemo(() => {
    const dist: Record<string, number> = {};
    for (const ds of data.designSystems) {
      dist[ds.status] = (dist[ds.status] ?? 0) + 1;
    }
    return dist;
  }, [data.designSystems]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Design System Status Distribution</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {Object.entries(statusDist).map(([status, count]) => (
          <DistributionBar
            key={status}
            label={status.charAt(0).toUpperCase() + status.slice(1)}
            count={count}
            total={data.designSystems.length}
            color={
              status === 'active'
                ? 'bg-green-500'
                : status === 'inactive'
                  ? 'bg-gray-500'
                  : status === 'outdated'
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
            }
          />
        ))}
      </CardContent>
    </Card>
  );
}

function DNAsTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>DNA Patterns</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          {[
            {
              name: 'Enterprise Governance',
              desc: 'Enterprise governance patterns for AI agent teams',
              personas: 12,
              rules: 24,
            },
            {
              name: 'Military Operations',
              desc: 'Chain of command and strict hierarchy patterns',
              personas: 8,
              rules: 18,
            },
            {
              name: 'Surgical Team',
              desc: 'Zero-defect precision for critical operations',
              personas: 6,
              rules: 15,
            },
            {
              name: 'Lean Factory',
              desc: 'Kaizen continuous improvement patterns',
              personas: 10,
              rules: 20,
            },
          ].map((p) => (
            <div key={p.name} className="rounded-lg border border-border p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Dna className="h-4 w-4 text-primary" />
                <p className="text-sm font-medium text-foreground">{p.name}</p>
              </div>
              <p className="text-xs text-muted-foreground">{p.desc}</p>
              <div className="flex gap-3 text-xs text-muted-foreground">
                <span>{p.personas} personas</span>
                <span>{p.rules} rules</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

async function handleExport(format: 'json' | 'markdown' | 'html') {
  try {
    const res = await fetch('/api/ecosystem');
    const data = await res.json();

    let content = '';
    let mimeType = '';
    let extension = '';

    if (format === 'json') {
      content = JSON.stringify(data, null, 2);
      mimeType = 'application/json';
      extension = 'json';
    } else if (format === 'markdown') {
      content = `# BehaviorOS Ecosystem Report\n\n`;
      content += `**Generated:** ${new Date().toISOString()}\n\n`;
      content += `## Summary\n\n`;
      content += `- Skills: ${data.totalSkills}\n`;
      content += `- MCPs: ${data.totalMCPs}\n`;
      content += `- Active Agents: ${data.activeAgents}\n`;
      content += `- Design Systems: ${data.designSystemCount}\n\n`;
      content += `## Skills\n\n`;
      for (const skill of data.skills ?? []) {
        content += `- **${skill.name}** v${skill.version} — ${skill.description} (${skill.source})\n`;
      }
      mimeType = 'text/markdown';
      extension = 'md';
    } else {
      content = `<!DOCTYPE html><html><head><title>BehaviorOS Ecosystem Report</title>`;
      content += `<style>body{font-family:system-ui;max-width:800px;margin:auto;padding:2rem}</style></head><body>`;
      content += `<h1>BehaviorOS Ecosystem Report</h1>`;
      content += `<p><em>Generated: ${new Date().toISOString()}</em></p>`;
      content += `<h2>Summary</h2><ul>`;
      content += `<li>Skills: ${data.totalSkills}</li>`;
      content += `<li>MCPs: ${data.totalMCPs}</li>`;
      content += `<li>Active Agents: ${data.activeAgents}</li>`;
      content += `<li>Design Systems: ${data.designSystemCount}</li></ul>`;
      content += `</body></html>`;
      mimeType = 'text/html';
      extension = 'html';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `behavioros-ecosystem-report.${extension}`;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    // ignore
  }
}

export default function ReportPage() {
  const { data, loading } = useFetch<EcosystemSummary>('/api/ecosystem');

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileTextIcon className="h-5 w-5 text-primary" />
            <span className="text-sm text-muted-foreground">Loading report...</span>
          </div>
        </div>
        <div className="h-96 w-full animate-pulse rounded-lg border border-border bg-card" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <FileTextIcon className="h-12 w-12 text-muted mb-4" />
        <p className="text-lg font-medium text-foreground">Report data unavailable</p>
        <p className="text-sm text-muted-foreground mt-1">Could not fetch ecosystem data.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileTextIcon className="h-5 w-5 text-primary" />
          <span className="text-sm text-muted-foreground">Ecosystem Report</span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => handleExport('json')}>
            <FileJson className="h-4 w-4 mr-1" />
            JSON
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleExport('markdown')}>
            <FileDown className="h-4 w-4 mr-1" />
            Markdown
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleExport('html')}>
            <Download className="h-4 w-4 mr-1" />
            HTML
          </Button>
        </div>
      </div>

      <Tabs defaultValue="summary">
        <TabsList>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="agents">Agents</TabsTrigger>
          <TabsTrigger value="skills">Skills</TabsTrigger>
          <TabsTrigger value="mcps">MCPs</TabsTrigger>
          <TabsTrigger value="design-systems">Design Systems</TabsTrigger>
          <TabsTrigger value="dnas">DNAs</TabsTrigger>
        </TabsList>

        <TabsContent value="summary">
          <SummaryTab data={data} />
        </TabsContent>

        <TabsContent value="agents">
          <AgentsTab data={data} />
        </TabsContent>

        <TabsContent value="skills">
          <SkillsTab data={data} />
        </TabsContent>

        <TabsContent value="mcps">
          <MCPsTab data={data} />
        </TabsContent>

        <TabsContent value="design-systems">
          <DesignSystemsTab data={data} />
        </TabsContent>

        <TabsContent value="dnas">
          <DNAsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
