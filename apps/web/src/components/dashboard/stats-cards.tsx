import { Activity, Bot, FileText, Target, TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface StatCard {
  title: string;
  value: string | number;
  change: string;
  trend: 'up' | 'down';
  icon: React.ReactNode;
}

const stats: StatCard[] = [
  {
    title: 'Total Missions',
    value: 10,
    change: '+2 this week',
    trend: 'up',
    icon: <Target className="h-4 w-4" />,
  },
  {
    title: 'Active Agents',
    value: '4/6',
    change: '2 idle',
    trend: 'up',
    icon: <Bot className="h-4 w-4" />,
  },
  {
    title: 'Quality Score',
    value: '87%',
    change: '+3% vs last week',
    trend: 'up',
    icon: <Activity className="h-4 w-4" />,
  },
  {
    title: 'Audit Events',
    value: 20,
    change: '3 critical',
    trend: 'down',
    icon: <FileText className="h-4 w-4" />,
  },
];

export function StatsCards() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.title} className="hover:border-[#333] transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-[#a1a1aa]">{stat.title}</CardTitle>
            <div className="text-[#a1a1aa]">{stat.icon}</div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#fafafa]">{stat.value}</div>
            <div className="flex items-center gap-1 text-xs text-[#a1a1aa]">
              {stat.trend === 'up' ? (
                <TrendingUp className="h-3 w-3 text-green-500" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-500" />
              )}
              <span>{stat.change}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
