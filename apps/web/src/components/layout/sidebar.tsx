'use client';

import {
  Activity,
  Bot,
  ChevronLeft,
  ChevronRight,
  Dna,
  FileText,
  LayoutDashboard,
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
  { name: 'DNAs', href: '/dnas', icon: Dna },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        'flex h-screen flex-col border-r border-[#262626] bg-[#0a0a0a] transition-all duration-300',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      <div className="flex h-14 items-center justify-between border-b border-[#262626] px-4">
        {!collapsed && (
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0A7C4F]">
              <span className="text-sm font-bold text-white">B</span>
            </div>
            <span className="text-sm font-semibold text-[#fafafa]">BehaviorOS</span>
          </Link>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="rounded-md p-1.5 text-[#a1a1aa] hover:bg-[#1a1a1a] hover:text-[#fafafa] transition-colors"
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
                  ? 'bg-[#0A7C4F]/10 text-[#0A7C4F]'
                  : 'text-[#a1a1aa] hover:bg-[#1a1a1a] hover:text-[#fafafa]',
                collapsed && 'justify-center px-2',
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-[#262626] p-4">
        {!collapsed && (
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1a1a1a]">
              <span className="text-xs text-[#a1a1aa]">OS</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-[#fafafa] truncate">Operator</p>
              <p className="text-xs text-[#a1a1aa] truncate">admin@behavioros.ai</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
