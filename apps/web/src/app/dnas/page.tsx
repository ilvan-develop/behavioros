'use client';

import { Activity, ChevronDown, ChevronUp, Dna, Plus, Shield, Users } from 'lucide-react';
import { useState } from 'react';
import { Header } from '@/components/layout/header';
import { Sidebar } from '@/components/layout/sidebar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { dnaPackages } from '@/lib/mock-data';

export default function DnasPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header title="DNAs" description="Behavioral DNA packages for your AI teams" />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Dna className="h-5 w-5 text-[#0A7C4F]" />
                <span className="text-sm text-[#a1a1aa]">
                  {dnaPackages.length} DNA packages available
                </span>
              </div>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Create DNA
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {dnaPackages.map((dna) => (
                <Card
                  key={dna.id}
                  className="hover:border-[#333] transition-colors cursor-pointer"
                  onClick={() => setExpandedId(expandedId === dna.id ? null : dna.id)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0A7C4F]/10">
                          <Dna className="h-5 w-5 text-[#0A7C4F]" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{dna.name}</CardTitle>
                          <p className="text-xs text-[#a1a1aa]">v{dna.version}</p>
                        </div>
                      </div>
                      {expandedId === dna.id ? (
                        <ChevronUp className="h-4 w-4 text-[#a1a1aa]" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-[#a1a1aa]" />
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-[#a1a1aa] line-clamp-2">{dna.description}</p>

                    <div className="flex flex-wrap gap-2">
                      {dna.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>

                    <div className="grid grid-cols-3 gap-4 pt-2">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-[#a1a1aa]" />
                        <div>
                          <p className="text-lg font-semibold text-[#fafafa]">
                            {dna.personasCount}
                          </p>
                          <p className="text-xs text-[#a1a1aa]">Personas</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-[#a1a1aa]" />
                        <div>
                          <p className="text-lg font-semibold text-[#fafafa]">{dna.rulesCount}</p>
                          <p className="text-xs text-[#a1a1aa]">Rules</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4 text-[#a1a1aa]" />
                        <div>
                          <p className="text-lg font-semibold text-[#fafafa]">
                            {dna.qualityGatesCount}
                          </p>
                          <p className="text-xs text-[#a1a1aa]">Quality Gates</p>
                        </div>
                      </div>
                    </div>

                    {expandedId === dna.id && (
                      <div className="pt-4 border-t border-[#262626] space-y-4">
                        <div>
                          <h4 className="text-sm font-medium text-[#fafafa] mb-2">
                            Included Components
                          </h4>
                          <div className="grid grid-cols-2 gap-2 text-sm text-[#a1a1aa]">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-1.5 rounded-full bg-[#0A7C4F]" />
                              {dna.personasCount} Agent Personas
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-1.5 rounded-full bg-[#0A7C4F]" />
                              {dna.rulesCount} Governance Rules
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-1.5 rounded-full bg-[#0A7C4F]" />
                              {dna.qualityGatesCount} Quality Gates
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-1.5 rounded-full bg-[#0A7C4F]" />
                              {dna.tags.length} Categories
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm">Activate DNA</Button>
                          <Button size="sm" variant="outline">
                            Preview
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
          </div>
        </main>
      </div>
    </div>
  );
}
