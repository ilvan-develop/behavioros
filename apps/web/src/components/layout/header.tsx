'use client';

import { Bell, Search, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HeaderProps {
  title: string;
  description?: string;
}

export function Header({ title, description }: HeaderProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-[#262626] bg-[#0a0a0a] px-6">
      <div>
        <h1 className="text-lg font-semibold text-[#fafafa]">{title}</h1>
        {description && <p className="text-xs text-[#a1a1aa]">{description}</p>}
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="text-[#a1a1aa]">
          <Search className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="text-[#a1a1aa]">
          <Bell className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="text-[#a1a1aa]">
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
