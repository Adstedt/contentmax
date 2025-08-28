import React from 'react';
import { cn } from '@/lib/utils';
import { AlertCircle, CheckCircle, Info, XCircle, X } from 'lucide-react';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'info' | 'success' | 'warning' | 'error' | 'destructive';
  title?: string;
  dismissible?: boolean;
  onDismiss?: () => void;
  icon?: React.ReactNode;
  showIcon?: boolean;
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  (
    {
      variant = 'info',
      title,
      dismissible = false,
      onDismiss,
      icon,
      showIcon = true,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const variants = {
      info: {
        container: 'bg-blue-50 border-blue-200 text-blue-800',
        icon: <Info className="h-5 w-5 text-blue-400" />,
        title: 'text-blue-800',
      },
      success: {
        container: 'bg-green-50 border-green-200 text-green-800',
        icon: <CheckCircle className="h-5 w-5 text-green-400" />,
        title: 'text-green-800',
      },
      warning: {
        container: 'bg-yellow-50 border-yellow-200 text-yellow-800',
        icon: <AlertCircle className="h-5 w-5 text-yellow-400" />,
        title: 'text-yellow-800',
      },
      error: {
        container: 'bg-red-50 border-red-200 text-red-800',
        icon: <XCircle className="h-5 w-5 text-red-400" />,
        title: 'text-red-800',
      },
      destructive: {
        container: 'bg-red-50 border-red-200 text-red-800',
        icon: <XCircle className="h-5 w-5 text-red-400" />,
        title: 'text-red-800',
      },
    };

    const variantStyles = variants[variant];
    const displayIcon = icon || variantStyles.icon;

    return (
      <div
        ref={ref}
        role="alert"
        className={cn('rounded-md border p-4', variantStyles.container, className)}
        {...props}
      >
        <div className="flex">
          {showIcon && displayIcon && <div className="flex-shrink-0">{displayIcon}</div>}
          <div className={cn('flex-1', showIcon && displayIcon && 'ml-3')}>
            {title && (
              <h3 className={cn('text-sm font-medium', variantStyles.title, children && 'mb-1')}>
                {title}
              </h3>
            )}
            {children && <div className="text-sm">{children}</div>}
          </div>
          {(dismissible || onDismiss) && (
            <div className="ml-auto pl-3">
              <button
                type="button"
                onClick={onDismiss}
                className={cn(
                  'inline-flex rounded-md p-1.5',
                  'hover:bg-black hover:bg-opacity-10 focus:outline-none focus:ring-2 focus:ring-offset-2',
                  variant === 'info' && 'focus:ring-blue-500',
                  variant === 'success' && 'focus:ring-green-500',
                  variant === 'warning' && 'focus:ring-yellow-500',
                  (variant === 'error' || variant === 'destructive') && 'focus:ring-red-500'
                )}
                aria-label="Dismiss alert"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }
);

Alert.displayName = 'Alert';

// Additional exports for better compatibility
export const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('text-sm [&_p]:leading-relaxed', className)} {...props} />
));
AlertDescription.displayName = 'AlertDescription';

export const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5 ref={ref} className={cn('mb-1 font-medium leading-none tracking-tight', className)} {...props} />
));
AlertTitle.displayName = 'AlertTitle';

export { Alert };
export default Alert;