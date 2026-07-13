import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'destructive' | 'success' | 'warning' | 'info';
}

const Badge = forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
          {
            'border-transparent bg-[#0A7C4F] text-white': variant === 'default',
            'border-transparent bg-[#262626] text-[#a1a1aa]': variant === 'secondary',
            'border-[#333] text-[#a1a1aa]': variant === 'outline',
            'border-transparent bg-red-600/20 text-red-400': variant === 'destructive',
            'border-transparent bg-green-600/20 text-green-400': variant === 'success',
            'border-transparent bg-yellow-600/20 text-yellow-400': variant === 'warning',
            'border-transparent bg-blue-600/20 text-blue-400': variant === 'info',
          },
          className,
        )}
        {...props}
      />
    );
  },
);
Badge.displayName = 'Badge';

export { Badge };
