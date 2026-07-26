import { cn } from '@/lib/utils';
import type { SkillSource } from '@/types';

const sourceConfig: Record<SkillSource, { label: string; bg: string; text: string }> = {
  aitmpl: { label: 'AITMPL', bg: 'bg-purple-500/10', text: 'text-purple-600' },
  od: { label: 'OD', bg: 'bg-blue-500/10', text: 'text-blue-600' },
  bos: { label: 'BOS', bg: 'bg-amber-500/10', text: 'text-amber-600' },
  local: { label: 'Local', bg: 'bg-green-500/10', text: 'text-green-600' },
};

interface SourceBadgeProps {
  source: SkillSource;
  className?: string;
}

export function SourceBadge({ source, className }: SourceBadgeProps) {
  const config = sourceConfig[source] ?? {
    label: source,
    bg: 'bg-gray-500/10',
    text: 'text-gray-500',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold',
        config.bg,
        config.text,
        className,
      )}
    >
      {config.label}
    </span>
  );
}
