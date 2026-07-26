'use client';

import {
  Activity,
  Blocks,
  Bot,
  Brain,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Cpu,
  Dna,
  FileText,
  LayoutDashboard,
  Puzzle,
  Shield,
  Target,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Missions', href: '/missions', icon: Target },
  { name: 'Agents', href: '/agents', icon: Bot },
  { name: 'Governance', href: '/governance', icon: Shield },
  { name: 'Quality', href: '/quality', icon: Activity },
  { name: 'Audit', href: '/audit', icon: FileText },
  { name: 'Learning', href: '/learning', icon: Brain },
  { name: 'DNAs', href: '/dnas', icon: Dna },
];

const ecosystemItems = [
  { name: 'Status', href: '/ecosystem', icon: Blocks },
  { name: 'Skills', href: '/ecosystem/skills', icon: Puzzle },
  { name: 'MCPs', href: '/ecosystem/mcps', icon: Cpu },
  { name: 'Report', href: '/ecosystem/report', icon: FileText },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [ecosystemOpen, setEcosystemOpen] = useState(pathname.startsWith('/ecosystem'));

  return (
    <aside
      className={cn(
        'flex h-screen flex-col border-r border-border bg-background transition-all duration-300',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        {!collapsed && (
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <span className="text-sm font-bold text-primary-foreground">B</span>
            </div>
            <span className="text-sm font-semibold text-foreground">BehaviorOS</span>
          </Link>
        )}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <nav className="flex-1 space-y-1 p-2">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                collapsed && 'justify-center px-2',
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.name}</span>}
            </Link>
          );
        })}

        {/* Ecosystem */}
        <div>
          <button
            type="button"
            onClick={() => setEcosystemOpen(!ecosystemOpen)}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
              pathname.startsWith('/ecosystem')
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              collapsed && 'justify-center px-2',
            )}
          >
            <Blocks className="h-4 w-4 shrink-0" />
            {!collapsed && (
              <>
                <span className="flex-1 text-left">Ecosystem</span>
                {ecosystemOpen ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </>
            )}
          </button>
          {!collapsed && ecosystemOpen && (
            <div className="ml-4 mt-1 space-y-1">
              {ecosystemItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    <item.icon className="h-3.5 w-3.5 shrink-0" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Protocol */}
        <Link
          href="/protocol"
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
            pathname === '/protocol'
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            collapsed && 'justify-center px-2',
          )}
        >
          <Shield className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Protocol</span>}
        </Link>
      </nav>

      <div className="border-t border-border p-4">
        {!collapsed && (
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
              <span className="text-xs text-muted-foreground">OS</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">Operator</p>
              <p className="text-xs text-muted-foreground truncate">admin@behavioros.ai</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
