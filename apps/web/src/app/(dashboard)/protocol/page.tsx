'use client';

import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  Shield,
  XCircle,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFetch } from '@/lib/hooks/use-api';
import { cn, formatRelativeTime } from '@/lib/utils';
import type { ProtocolStatus } from '@/types';

const levelColors: Record<string, string> = {
  strict: 'bg-red-500/10 text-red-600 border-red-200',
  standard: 'bg-blue-500/10 text-blue-600 border-blue-200',
  audit: 'bg-yellow-500/10 text-yellow-600 border-yellow-200',
};

const enforcementColors: Record<string, string> = {
  critical: 'text-red-500',
  high: 'text-orange-500',
  medium: 'text-blue-500',
};

const severityColors: Record<string, string> = {
  critical: 'bg-red-500/10 text-red-600 border-red-200',
  high: 'bg-orange-500/10 text-orange-600 border-orange-200',
  medium: 'bg-blue-500/10 text-blue-600 border-blue-200',
  low: 'bg-gray-500/10 text-gray-600 border-gray-200',
};

export default function ProtocolPage() {
  const { data, loading } = useFetch<ProtocolStatus>('/api/protocol');
  const steps = data?.steps ?? [];
  const violations = data?.violations ?? [];

  const [expandedViolation, setExpandedViolation] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState('all');

  const enforcedCount = steps.filter((s) => s.enforced).length;
  const criticalEnforced = steps.filter(
    (s) => s.enforcementLevel === 'critical' && s.enforced,
  ).length;
  const criticalTotal = steps.filter((s) => s.enforcementLevel === 'critical').length;

  const filteredViolations = useMemo(() => {
    if (severityFilter === 'all') return violations;
    return violations.filter((v) => v.severity === severityFilter);
  }, [violations, severityFilter]);

  const level = data?.enforcementLevel ?? 'standard';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-primary" />
          <span className="text-sm text-muted-foreground">
            {loading ? 'Loading...' : `${enforcedCount}/${steps.length} steps enforced`}
          </span>
          {data?.dnaLoaded && (
            <Badge variant="success" className="text-xs">
              DNA Active
            </Badge>
          )}
        </div>
      </div>

      {/* Enforcement Level */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Enforcement Level</CardTitle>
          <Button size="sm" variant="outline">
            Change Level
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold',
                levelColors[level],
              )}
            >
              <Shield className="h-4 w-4" />
              {level.charAt(0).toUpperCase() + level.slice(1)}
            </div>
            <span className="text-sm text-muted-foreground">
              {level === 'strict'
                ? 'All 7 protocol steps are strictly enforced. No actions bypass the protocol.'
                : level === 'standard'
                  ? 'Core steps (1,3,5,6) are enforced. Warning on skipped steps.'
                  : 'Audit mode: violations are logged but not blocked.'}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 7-Step Checklist */}
      <Card>
        <CardHeader>
          <CardTitle>
            7-Step Protocol Checklist
            <span className="text-sm font-normal text-muted-foreground ml-2">
              ({criticalEnforced}/{criticalTotal} critical enforced)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((k) => (
                <div
                  key={`step-skeleton-${k}`}
                  className="h-14 w-full animate-pulse rounded bg-muted"
                />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {steps.map((step) => (
                <div
                  key={step.id}
                  className={cn(
                    'flex items-center justify-between rounded-lg border border-border p-3 transition-colors',
                    step.enforced ? 'bg-card' : 'bg-muted/30 border-dashed',
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full">
                      {step.enforced ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-yellow-500" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'text-sm font-medium',
                            step.enforced ? 'text-foreground' : 'text-muted-foreground',
                          )}
                        >
                          Step {step.id}: {step.name}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn('text-xs', enforcementColors[step.enforcementLevel])}
                        >
                          {step.enforcementLevel}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Tool: {step.tool} &middot;{' '}
                        {step.enforced ? 'Enforced' : 'Not enforced (warning only)'}
                      </p>
                    </div>
                  </div>
                  <Badge variant={step.enforced ? 'success' : 'warning'}>
                    {step.enforced ? 'Active' : 'Warning'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Violations Log */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle>Recent Violations ({violations.length})</CardTitle>
            <Select value={severityFilter} onValueChange={(v) => v && setSeverityFilter(v)}>
              <SelectTrigger>
                <SelectValue>
                  {severityFilter === 'all' ? 'All Severities' : severityFilter}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm">
            <FileText className="h-4 w-4 mr-1" />
            Export Log
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {['a', 'b', 'c', 'd'].map((k) => (
                <div
                  key={`viol-skeleton-${k}`}
                  className="h-14 w-full animate-pulse rounded bg-muted"
                />
              ))}
            </div>
          ) : filteredViolations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
              <p className="text-lg font-medium text-foreground">No violations</p>
              <p className="text-sm text-muted-foreground mt-1">
                {violations.length === 0
                  ? 'All protocol steps are being followed correctly.'
                  : 'No violations match the selected filter.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredViolations.map((violation) => (
                <div key={violation.id} className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        {violation.severity === 'critical' ? (
                          <XCircle className="h-4 w-4 text-red-500" />
                        ) : violation.severity === 'high' ? (
                          <AlertTriangle className="h-4 w-4 text-orange-500" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-blue-500" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">
                            {violation.step}
                          </span>
                          <Badge
                            variant="outline"
                            className={cn('text-xs', severityColors[violation.severity])}
                          >
                            {violation.severity}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">{violation.message}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatRelativeTime(violation.timestamp)}
                      </span>
                      <button
                        type="button"
                        className="cursor-pointer"
                        onClick={() =>
                          setExpandedViolation(
                            expandedViolation === violation.id ? null : violation.id,
                          )
                        }
                      >
                        {expandedViolation === violation.id ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                    </div>
                  </div>

                  {expandedViolation === violation.id && (
                    <div className="ml-7 pt-2 border-t border-border space-y-2">
                      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <div>
                          <span className="font-medium text-foreground">Violation ID:</span>{' '}
                          {violation.id}
                        </div>
                        <div>
                          <span className="font-medium text-foreground">Step:</span>{' '}
                          {violation.step}
                        </div>
                        <div>
                          <span className="font-medium text-foreground">Severity:</span>{' '}
                          {violation.severity}
                        </div>
                        <div>
                          <span className="font-medium text-foreground">Timestamp:</span>{' '}
                          {new Date(violation.timestamp).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
