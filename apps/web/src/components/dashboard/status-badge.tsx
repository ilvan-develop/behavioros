import { cn } from '@/lib/utils';

const statusConfig: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  active: { label: 'Active', dot: 'bg-green-500', bg: 'bg-green-500/10', text: 'text-green-600' },
  inactive: {
    label: 'Inactive',
    dot: 'bg-gray-400',
    bg: 'bg-gray-500/10',
    text: 'text-gray-500',
  },
  outdated: {
    label: 'Outdated',
    dot: 'bg-yellow-500',
    bg: 'bg-yellow-500/10',
    text: 'text-yellow-600',
  },
  conflict: {
    label: 'Conflict',
    dot: 'bg-red-500',
    bg: 'bg-red-500/10',
    text: 'text-red-600',
  },
  connected: {
    label: 'Connected',
    dot: 'bg-green-500',
    bg: 'bg-green-500/10',
    text: 'text-green-600',
  },
  offline: {
    label: 'Offline',
    dot: 'bg-gray-400',
    bg: 'bg-gray-500/10',
    text: 'text-gray-500',
  },
  error: {
    label: 'Error',
    dot: 'bg-red-500',
    bg: 'bg-red-500/10',
    text: 'text-red-600',
  },
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] ?? {
    label: status,
    dot: 'bg-gray-400',
    bg: 'bg-gray-500/10',
    text: 'text-gray-500',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        config.bg,
        config.text,
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', config.dot)} />
      {config.label}
    </span>
  );
}
