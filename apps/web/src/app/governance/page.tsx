'use client';

import { ChevronDown, ChevronUp, Plus, Shield } from 'lucide-react';
import { useEffect, useState } from 'react';
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
import type { GovernanceRule } from '@/types';

interface GovernanceResponse {
  rules?: GovernanceRule[];
  dnaLoaded?: boolean;
  dnaName?: string;
}

const levelVariant: Record<string, 'destructive' | 'warning' | 'secondary' | 'outline'> = {
  critical: 'destructive',
  high: 'warning',
  medium: 'secondary',
  low: 'outline',
};

const actionVariant: Record<string, 'destructive' | 'warning' | 'info' | 'secondary'> = {
  block: 'destructive',
  escalate: 'warning',
  warn: 'info',
  log: 'secondary',
};

export default function GovernancePage() {
  const [rules, setRules] = useState<GovernanceRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dnaInfo, setDnaInfo] = useState<{ loaded: boolean; name?: string }>({ loaded: false });

  useEffect(() => {
    async function fetchRules() {
      try {
        const res = await fetch('/api/governance');
        if (res.ok) {
          const data: GovernanceResponse = await res.json();
          setRules(data.rules ?? []);
          setDnaInfo({ loaded: !!data.dnaLoaded, name: data.dnaName });
        }
      } catch {
        // keep empty
      } finally {
        setLoading(false);
      }
    }
    fetchRules();
  }, []);

  const enabledCount = rules.filter((r) => r.enabled).length;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header title="Governance" description="Rules and policies for your AI team" />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-[#0A7C4F]" />
                <span className="text-sm text-[#a1a1aa]">
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
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="h-12 w-full animate-pulse rounded bg-[#262626]" />
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
                        <>
                          <TableRow
                            key={rule.id}
                            className="cursor-pointer"
                            onClick={() => setExpandedId(expandedId === rule.id ? null : rule.id)}
                          >
                            <TableCell>
                              {expandedId === rule.id ? (
                                <ChevronUp className="h-4 w-4 text-[#a1a1aa]" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-[#a1a1aa]" />
                              )}
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium text-[#fafafa]">{rule.name}</p>
                                <p className="text-xs text-[#a1a1aa]">{rule.id}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={levelVariant[rule.level]}>{rule.level}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={actionVariant[rule.action]}>{rule.action}</Badge>
                            </TableCell>
                            <TableCell className="text-[#a1a1aa]">{rule.scope}</TableCell>
                            <TableCell>
                              <Badge variant={rule.enabled ? 'success' : 'secondary'}>
                                {rule.enabled ? 'Enabled' : 'Disabled'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                          {expandedId === rule.id && (
                            <TableRow key={`${rule.id}-details`}>
                              <TableCell colSpan={6} className="bg-[#0a0a0a]">
                                <div className="p-4 space-y-4">
                                  <div>
                                    <h4 className="text-sm font-medium text-[#fafafa] mb-1">
                                      Description
                                    </h4>
                                    <p className="text-sm text-[#a1a1aa]">{rule.description}</p>
                                  </div>
                                  <div>
                                    <h4 className="text-sm font-medium text-[#fafafa] mb-1">
                                      Conditions
                                    </h4>
                                    <ul className="list-disc list-inside text-sm text-[#a1a1aa]">
                                      {rule.conditions.map((condition, i) => (
                                        <li key={i}>{condition}</li>
                                      ))}
                                    </ul>
                                  </div>
                                  <div className="flex gap-2">
                                    <Button size="sm" variant="outline">
                                      Edit Rule
                                    </Button>
                                    <Button size="sm" variant="outline">
                                      {rule.enabled ? 'Disable' : 'Enable'}
                                    </Button>
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
