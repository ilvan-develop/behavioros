import { type ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        className={cn(
          'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A7C4F] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] disabled:pointer-events-none disabled:opacity-50',
          {
            'bg-[#0A7C4F] text-white hover:bg-[#0A7C4F]/90 shadow-lg shadow-[#0A7C4F]/20':
              variant === 'default',
            'border border-[#262626] bg-transparent text-[#fafafa] hover:bg-[#1a1a1a] hover:border-[#333]':
              variant === 'outline',
            'text-[#a1a1aa] hover:bg-[#1a1a1a] hover:text-[#fafafa]': variant === 'ghost',
            'bg-red-600 text-white hover:bg-red-700': variant === 'destructive',
          },
          {
            'h-9 px-4 py-2': size === 'default',
            'h-7 rounded-md px-3 text-xs': size === 'sm',
            'h-10 rounded-md px-6': size === 'lg',
            'h-9 w-9 p-0': size === 'icon',
          },
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button };
