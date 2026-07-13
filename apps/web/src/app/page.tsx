'use client';

import { AgentStatusGrid } from '@/components/dashboard/agent-status-grid';
import { RecentMissions } from '@/components/dashboard/recent-missions';
import { StatsCards } from '@/components/dashboard/stats-cards';
import { Header } from '@/components/layout/header';
import { Sidebar } from '@/components/layout/sidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function DashboardPage() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header title="Dashboard" description="Overview of your AI operations" />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            <StatsCards />

            <div className="grid gap-6 lg:grid-cols-7">
              <div className="lg:col-span-4">
                <RecentMissions />
              </div>
              <div className="lg:col-span-3">
                <AgentStatusGrid />
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Quality Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-lg border border-[#262626] bg-[#0a0a0a] p-4">
                    <p className="text-sm text-[#a1a1aa]">Overall Score</p>
                    <p className="text-3xl font-bold text-[#0A7C4F]">87%</p>
                  </div>
                  <div className="rounded-lg border border-[#262626] bg-[#0a0a0a] p-4">
                    <p className="text-sm text-[#a1a1aa]">Gates Passed</p>
                    <p className="text-3xl font-bold text-green-500">4/6</p>
                  </div>
                  <div className="rounded-lg border border-[#262626] bg-[#0a0a0a] p-4">
                    <p className="text-sm text-[#a1a1aa]">Open Issues</p>
                    <p className="text-3xl font-bold text-yellow-500">2</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
