import React from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'secondary' | 'outline' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  onRemove?: () => void;
  removable?: boolean;
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  (
    { variant = 'default', size = 'md', onRemove, removable, className, children, ...props },
    ref
  ) => {
    const variants = {
      default: 'bg-gray-100 text-gray-800',
      primary: 'bg-blue-100 text-blue-800',
      success: 'bg-green-100 text-green-800',
      warning: 'bg-yellow-100 text-yellow-800',
      danger: 'bg-red-100 text-red-800',
      info: 'bg-indigo-100 text-indigo-800',
      secondary: 'bg-gray-100 text-gray-900',
      outline: 'border border-gray-300 text-gray-700',
      destructive: 'bg-red-100 text-red-900',
    };

    const sizes = {
      sm: 'px-2 py-0.5 text-xs',
      md: 'px-2.5 py-1 text-sm',
      lg: 'px-3 py-1.5 text-base',
    };

    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center font-medium rounded-full',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {children}
        {(removable || onRemove) && (
          <button
            type="button"
            onClick={onRemove}
            className={cn(
              'ml-1.5 inline-flex items-center justify-center rounded-full',
              'hover:bg-black hover:bg-opacity-10 focus:outline-none focus:ring-2 focus:ring-offset-1',
              size === 'sm' && 'h-3 w-3',
              size === 'md' && 'h-4 w-4',
              size === 'lg' && 'h-5 w-5'
            )}
            aria-label="Remove badge"
          >
            <X
              className={cn(
                size === 'sm' && 'h-2 w-2',
                size === 'md' && 'h-3 w-3',
                size === 'lg' && 'h-4 w-4'
              )}
            />
          </button>
        )}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

export { Badge };
export default Badge;
