'use client';

import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ComponentCardProps {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  statusBadge?: ReactNode;
  sourceBadge?: ReactNode;
  children?: ReactNode;
  className?: string;
  onClick?: () => void;
}

export function ComponentCard({
  icon,
  title,
  subtitle,
  statusBadge,
  sourceBadge,
  children,
  className,
  onClick,
}: ComponentCardProps) {
  return (
    <Card
      className={cn(
        'hover:border-border/60 transition-colors',
        onClick && 'cursor-pointer',
        className,
      )}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            {icon}
          </div>
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {sourceBadge}
          {statusBadge}
        </div>
      </CardHeader>
      {children && <CardContent className="space-y-3">{children}</CardContent>}
    </Card>
  );
}
