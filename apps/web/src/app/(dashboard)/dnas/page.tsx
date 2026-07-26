'use client';

import { Activity, ChevronDown, ChevronUp, Dna, Plus, Search, Shield, Users } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useFetch } from '@/lib/hooks/use-api';
import type { DnaPackage } from '@/types';

interface DnasResponse {
  packages?: DnaPackage[];
  total?: number;
}

export default function DnasPage() {
  const { data, loading } = useFetch<DnasResponse>('/api/dnas');
  const dnas = data?.packages ?? [];

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredDnas = useMemo(() => {
    if (!searchQuery) return dnas;
    const q = searchQuery.toLowerCase();
    return dnas.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q) ||
        d.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [dnas, searchQuery]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Dna className="h-5 w-5 text-primary" />
          <span className="text-sm text-muted-foreground">
            {loading ? 'Loading...' : `${filteredDnas.length} DNA packages available`}
          </span>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-56"
              placeholder="Search DNAs..."
            />
          </div>
        </div>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Create DNA
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {['a', 'b', 'c', 'd'].map((k) => (
            <div
              key={`dna-skeleton-${k}`}
              className="h-48 w-full animate-pulse rounded-lg border border-border bg-card"
            />
          ))}
        </div>
      ) : filteredDnas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Dna className="h-12 w-12 text-muted mb-4" />
          <p className="text-lg font-medium text-foreground">No DNA packages found</p>
          <p className="text-sm text-muted-foreground mt-1">
            {dnas.length === 0
              ? 'Create a DNA package to define behavioral patterns.'
              : 'Try adjusting your search query.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredDnas.map((dna) => (
            <Card key={dna.id} className="hover:border-border/60 transition-colors">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Dna className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <Link
                        href={`/dnas/${dna.id}`}
                        className="text-base font-semibold text-foreground hover:text-primary transition-colors"
                      >
                        {dna.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">v{dna.version}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setExpandedId(expandedId === dna.id ? null : dna.id)}
                    className="h-8 w-8"
                  >
                    {expandedId === dna.id ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground line-clamp-2">{dna.description}</p>

                <div className="flex flex-wrap gap-2">
                  {dna.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-4 pt-2">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-lg font-semibold text-foreground">{dna.personasCount}</p>
                      <p className="text-xs text-muted-foreground">Personas</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-lg font-semibold text-foreground">{dna.rulesCount}</p>
                      <p className="text-xs text-muted-foreground">Rules</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-lg font-semibold text-foreground">
                        {dna.qualityGatesCount}
                      </p>
                      <p className="text-xs text-muted-foreground">Quality Gates</p>
                    </div>
                  </div>
                </div>

                {expandedId === dna.id && (
                  <div className="pt-4 border-t border-border space-y-4">
                    <div>
                      <h4 className="text-sm font-medium text-foreground mb-2">
                        Included Components
                      </h4>
                      <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                          {dna.personasCount} Agent Personas
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                          {dna.rulesCount} Governance Rules
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                          {dna.qualityGatesCount} Quality Gates
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                          {dna.tags.length} Categories
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Link
                        href={`/dnas/${dna.id}`}
                        className="inline-flex h-8 items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/80 transition-colors"
                      >
                        View Details
                      </Link>
                      <Button size="sm" variant="outline">
                        Activate
                      </Button>
                      <Button size="sm" variant="outline">
                        Duplicate
                      </Button>
                    </div>
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
