import React from 'react';
import { cn } from '@/lib/utils';

export interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: 'primary' | 'white' | 'gray';
  label?: string;
}

const Spinner = React.forwardRef<HTMLDivElement, SpinnerProps>(
  ({ size = 'md', color = 'primary', label, className, ...props }, ref) => {
    const sizeClasses = {
      sm: 'h-4 w-4',
      md: 'h-8 w-8',
      lg: 'h-12 w-12',
      xl: 'h-16 w-16',
    };

    const colorClasses = {
      primary: 'border-blue-600',
      white: 'border-white',
      gray: 'border-gray-600',
    };

    return (
      <div
        ref={ref}
        role="status"
        aria-label={label || 'Loading'}
        className={cn('inline-flex flex-col items-center justify-center', className)}
        {...props}
      >
        <div
          className={cn(
            'animate-spin rounded-full border-2 border-transparent',
            sizeClasses[size],
            colorClasses[color]
          )}
          style={{
            borderTopColor: 'currentColor',
            borderRightColor: 'currentColor',
          }}
        />
        {label && <span className="mt-2 text-sm text-gray-600">{label}</span>}
        <span className="sr-only">{label || 'Loading...'}</span>
      </div>
    );
  }
);

Spinner.displayName = 'Spinner';

export default Spinner;
