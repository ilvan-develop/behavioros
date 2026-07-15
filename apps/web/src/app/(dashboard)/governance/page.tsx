'use client';

import { ChevronDown, ChevronUp, Plus, Shield } from 'lucide-react';
import { useState } from 'react';
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
import { useFetch } from '@/lib/hooks/use-api';
import { actionVariant, levelVariant } from '@/lib/status-maps';
import type { GovernanceRule } from '@/types';

interface GovernanceResponse {
  rules?: GovernanceRule[];
  dnaLoaded?: boolean;
  dnaName?: string;
}

export default function GovernancePage() {
  const { data, loading } = useFetch<GovernanceResponse>('/api/governance');
  const rules = data?.rules ?? [];
  const dnaInfo = { loaded: !!data?.dnaLoaded, name: data?.dnaName };

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const enabledCount = rules.filter((r) => r.enabled).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <span className="text-sm text-muted-foreground">
            {loading ? 'Loading...' : `${enabledCount} active rules`}
          </span>
          {dnaInfo.loaded && dnaInfo.name && (
            <Badge variant="success" className="text-xs">
              {dnaInfo.name}
            </Badge>
          )}
        </div>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" />
          New Rule
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Governance Rules ({rules.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {['a', 'b', 'c', 'd', 'e'].map((k) => (
                <div
                  key={`gov-skeleton-${k}`}
                  className="h-12 w-full animate-pulse rounded bg-muted"
                />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell>
                      <button
                        type="button"
                        className="cursor-pointer"
                        onClick={() => setExpandedId(expandedId === rule.id ? null : rule.id)}
                      >
                        {expandedId === rule.id ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-foreground">{rule.name}</p>
                        <p className="text-xs text-muted-foreground">{rule.id}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={levelVariant[rule.level]}>{rule.level}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={actionVariant[rule.action]}>{rule.action}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{rule.scope}</TableCell>
                    <TableCell>
                      <Badge variant={rule.enabled ? 'success' : 'secondary'}>
                        {rule.enabled ? 'Enabled' : 'Disabled'}
                      </Badge>
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
