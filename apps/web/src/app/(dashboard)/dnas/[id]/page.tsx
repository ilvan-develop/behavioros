'use client';

import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Award,
  BookOpen,
  Dna,
  FileText,
  Shield,
  Users,
  Workflow,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useFetch } from '@/lib/hooks/use-api';
import type { DNADetail } from '@/types/dna';

interface DNADetailResponse {
  dna?: DNADetail;
  error?: string;
}

export default function DNADetailPage() {
  const params = useParams();
  const id = params.id as string;

  const { data, loading } = useFetch<DNADetailResponse>(`/api/dnas/${id}`);
  const dna = data?.dna;

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!dna) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <AlertTriangle className="h-12 w-12 text-muted mb-4" />
        <p className="text-lg font-medium text-foreground">DNA not found</p>
        <p className="text-sm text-muted-foreground mt-1">
          The DNA package you're looking for doesn't exist.
        </p>
        <Link
          href="/dnas"
          className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
        >
          Back to DNAs
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/dnas"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to DNAs
      </Link>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Dna className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-foreground">{dna.name}</h1>
                <Badge variant="secondary">v{dna.version}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{dna.description}</p>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {dna.author && (
                  <span className="flex items-center gap-1">
                    <Award className="h-3 w-3" />
                    {dna.author}
                  </span>
                )}
                {dna.license && (
                  <span className="flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    {dna.license}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {dna.personas.length} personas
                </span>
                <span className="flex items-center gap-1">
                  <Shield className="h-3 w-3" />
                  {dna.governance?.length ?? 0} rules
                </span>
                <span className="flex items-center gap-1">
                  <Activity className="h-3 w-3" />
                  {dna.quality?.length ?? 0} quality gates
                </span>
              </div>
              {dna.tags && dna.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {dna.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-primary" />
              Personas ({dna.personas.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {dna.personas.map((persona) => (
              <div key={persona.role} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">{persona.name}</p>
                  <Badge variant="outline" className="text-[10px]">
                    {persona.authority}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{persona.description}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {persona.skills?.map((skill) => (
                    <Badge key={skill} variant="secondary" className="text-[10px]">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4 text-primary" />
              Governance Rules ({(dna.governance ?? []).length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!dna.governance || dna.governance.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No governance rules defined.
              </p>
            ) : (
              <div className="space-y-2">
                {dna.governance.map((rule) => (
                  <div key={rule.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-foreground">{rule.name}</p>
                      <Badge variant="secondary" className="text-[10px]">
                        {rule.action ?? rule.severity}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{rule.description}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Type: {rule.type}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-primary" />
              Quality Gates ({(dna.quality ?? []).length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!dna.quality || dna.quality.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No quality gates defined.
              </p>
            ) : (
              <div className="space-y-2">
                {dna.quality.map((gate) => (
                  <div
                    key={gate.id}
                    className="flex items-center justify-between rounded-lg border border-border p-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{gate.name}</p>
                      <p className="text-xs text-muted-foreground">{gate.metric}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-foreground">
                        {gate.operator} {gate.threshold}
                      </p>
                      <Badge variant="outline" className="text-[10px]">
                        {gate.action ?? 'block'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="h-4 w-4 text-primary" />
              Patterns ({(dna.patterns ?? []).length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!dna.patterns || dna.patterns.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No behavioral patterns defined.
              </p>
            ) : (
              <div className="space-y-2">
                {dna.patterns.map((pattern, i) => (
                  <div key={pattern.id ?? `p-${i}`} className="rounded-lg border border-border p-3">
                    <p className="text-sm font-medium text-foreground">{pattern.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{pattern.description}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Workflow className="h-4 w-4 text-primary" />
              Workflows ({(dna.workflows ?? []).length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!dna.workflows || dna.workflows.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No workflows defined.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {dna.workflows.map((step) => (
                  <div key={step.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-foreground">{step.name}</p>
                      <Badge variant="secondary" className="text-[10px]">
                        Step {step.order}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{step.description}</p>
                    {step.inputs && step.inputs.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {step.inputs.map((inp) => (
                          <Badge key={inp} variant="outline" className="text-[10px]">
                            in: {inp}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
