export const statusColor: Record<string, string> = {
  idle: 'bg-green-500',
  working: 'bg-blue-500',
  reviewing: 'bg-yellow-500',
  blocked: 'bg-red-500',
  offline: 'bg-gray-500',
};

export const statusVariant: Record<
  string,
  'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info'
> = {
  idle: 'success',
  working: 'info',
  reviewing: 'warning',
  blocked: 'destructive',
  offline: 'secondary',
  draft: 'outline',
  executing: 'info',
  completed: 'success',
  failed: 'destructive',
  paused: 'warning',
};

export const priorityVariant: Record<
  string,
  'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info'
> = {
  critical: 'destructive',
  high: 'warning',
  medium: 'info',
  low: 'secondary',
};

export const severityVariant: Record<
  string,
  'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info'
> = {
  critical: 'destructive',
  high: 'warning',
  medium: 'info',
  low: 'secondary',
  info: 'outline',
};

export const resultVariant: Record<string, 'success' | 'destructive' | 'warning'> = {
  pass: 'success',
  fail: 'destructive',
  warn: 'warning',
};

export const actionVariant: Record<string, 'destructive' | 'warning' | 'info' | 'secondary'> = {
  block: 'destructive',
  escalate: 'warning',
  warn: 'info',
  log: 'secondary',
};

export const levelVariant: Record<string, 'destructive' | 'warning' | 'secondary' | 'outline'> = {
  critical: 'destructive',
  high: 'warning',
  medium: 'secondary',
  low: 'outline',
};
