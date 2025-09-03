# TASK-015: Error Boundaries & Recovery

## Overview

**Priority**: P0 - Blocker  
**Estimate**: 3 hours  
**Owner**: Frontend Developer  
**Dependencies**: All previous components  
**Status**: Not Started

## Problem Statement

We need comprehensive error handling throughout the application to ensure graceful degradation when issues occur. This includes React error boundaries, API error handling, and user-friendly error states that maintain user trust while providing actionable recovery options.

## Technical Requirements

### 1. Global Error Boundary

#### File: `components/errors/global-error-boundary.tsx`

```typescript
'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { captureException } from '@sentry/nextjs';
import { AlertTriangle, RefreshCw, Home, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorBoundaryKey: number;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorBoundaryKey: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to error reporting service
    console.error('Error Boundary Caught:', error, errorInfo);

    // Send to Sentry
    captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack
        }
      },
      tags: {
        component: 'GlobalErrorBoundary'
      }
    });

    this.setState({
      error,
      errorInfo
    });

    // Store error in localStorage for debugging
    if (typeof window !== 'undefined') {
      const errorLog = {
        timestamp: new Date().toISOString(),
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack
      };

      const existingLogs = JSON.parse(
        localStorage.getItem('errorLogs') || '[]'
      );

      localStorage.setItem(
        'errorLogs',
        JSON.stringify([errorLog, ...existingLogs].slice(0, 10))
      );
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorBoundaryKey: this.state.errorBoundaryKey + 1
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return <>{this.props.fallback}</>;
      }

      const isDevelopment = process.env.NODE_ENV === 'development';

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
          <Card className="max-w-2xl w-full">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 h-12 w-12 text-destructive">
                <AlertTriangle className="h-full w-full" />
              </div>
              <CardTitle className="text-2xl">
                Oops! Something went wrong
              </CardTitle>
              <CardDescription>
                We apologize for the inconvenience. The application encountered an unexpected error.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Error Details (Development Only) */}
              {isDevelopment && this.state.error && (
                <div className="rounded-lg bg-muted p-4 space-y-2">
                  <p className="font-mono text-sm text-destructive">
                    {this.state.error.message}
                  </p>
                  {this.state.error.stack && (
                    <pre className="text-xs overflow-auto max-h-40 text-muted-foreground">
                      {this.state.error.stack}
                    </pre>
                  )}
                  {this.state.errorInfo?.componentStack && (
                    <details className="cursor-pointer">
                      <summary className="text-xs text-muted-foreground">
                        Component Stack
                      </summary>
                      <pre className="text-xs overflow-auto max-h-40 mt-2">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              {/* Recovery Actions */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={this.handleReset}
                  variant="default"
                  className="flex-1"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Try Again
                </Button>

                <Button
                  onClick={this.handleReload}
                  variant="outline"
                  className="flex-1"
                >
                  Reload Page
                </Button>

                <Button
                  onClick={this.handleHome}
                  variant="outline"
                  className="flex-1"
                >
                  <Home className="mr-2 h-4 w-4" />
                  Go Home
                </Button>
              </div>

              {/* Support Link */}
              <div className="text-center text-sm text-muted-foreground">
                <p>If the problem persists, please contact support</p>
                <a
                  href="mailto:support@contentmax.io"
                  className="inline-flex items-center gap-1 text-primary hover:underline mt-1"
                >
                  <Mail className="h-3 w-3" />
                  support@contentmax.io
                </a>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <React.Fragment key={this.state.errorBoundaryKey}>
        {this.props.children}
      </React.Fragment>
    );
  }
}
```

### 2. Component-Level Error Boundaries

#### File: `components/errors/component-error-boundary.tsx`

```typescript
'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  componentName: string;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showDetails?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
}

export class ComponentErrorBoundary extends Component<Props, State> {
  private maxRetries = 3;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`Error in ${this.props.componentName}:`, error, errorInfo);

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Auto-retry logic for transient errors
    if (this.shouldAutoRetry(error) && this.state.retryCount < this.maxRetries) {
      setTimeout(() => {
        this.handleRetry();
      }, 1000 * Math.pow(2, this.state.retryCount)); // Exponential backoff
    }
  }

  shouldAutoRetry(error: Error): boolean {
    // Check for transient error patterns
    const transientErrors = [
      'Network request failed',
      'Failed to fetch',
      'ChunkLoadError',
      'Loading chunk'
    ];

    return transientErrors.some(pattern =>
      error.message.includes(pattern)
    );
  }

  handleRetry = () => {
    this.setState(prevState => ({
      hasError: false,
      error: null,
      retryCount: prevState.retryCount + 1
    }));
  };

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      retryCount: 0
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return <>{this.props.fallback}</>;
      }

      return (
        <Alert variant="destructive" className="my-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>
            Error in {this.props.componentName}
          </AlertTitle>
          <AlertDescription className="space-y-2">
            <p>This component encountered an error and cannot be displayed.</p>

            {this.props.showDetails && this.state.error && (
              <p className="font-mono text-xs">
                {this.state.error.message}
              </p>
            )}

            {this.state.retryCount > 0 && (
              <p className="text-xs text-muted-foreground">
                Retry attempt {this.state.retryCount} of {this.maxRetries}
              </p>
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={this.handleReset}
              className="mt-2"
            >
              Try Again
            </Button>
          </AlertDescription>
        </Alert>
      );
    }

    return this.props.children;
  }
}

// Hook for using error boundary in functional components
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  componentName: string,
  options?: {
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
    showDetails?: boolean;
  }
) {
  return React.forwardRef<any, P>((props, ref) => (
    <ComponentErrorBoundary
      componentName={componentName}
      {...options}
    >
      <Component {...props} ref={ref} />
    </ComponentErrorBoundary>
  ));
}
```

### 3. API Error Handler

#### File: `lib/errors/api-error-handler.ts`

```typescript
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { captureException } from '@sentry/nextjs';

export class APIError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export interface ErrorResponse {
  error: {
    message: string;
    code?: string;
    statusCode: number;
    timestamp: string;
    requestId?: string;
    details?: any;
  };
}

/**
 * Central API error handler
 */
export function handleAPIError(error: unknown, requestId?: string): NextResponse<ErrorResponse> {
  console.error('API Error:', error);

  let statusCode = 500;
  let message = 'An unexpected error occurred';
  let code = 'INTERNAL_ERROR';
  let details: any = undefined;

  // Handle different error types
  if (error instanceof APIError) {
    statusCode = error.statusCode;
    message = error.message;
    code = error.code || code;
    details = error.details;
  } else if (error instanceof ZodError) {
    statusCode = 400;
    message = 'Validation error';
    code = 'VALIDATION_ERROR';
    details = error.errors;
  } else if (error instanceof Error) {
    // Check for specific error patterns
    if (error.message.includes('Unauthorized')) {
      statusCode = 401;
      code = 'UNAUTHORIZED';
      message = 'Authentication required';
    } else if (error.message.includes('Forbidden')) {
      statusCode = 403;
      code = 'FORBIDDEN';
      message = 'Access denied';
    } else if (error.message.includes('Not found')) {
      statusCode = 404;
      code = 'NOT_FOUND';
      message = 'Resource not found';
    } else if (error.message.includes('Rate limit')) {
      statusCode = 429;
      code = 'RATE_LIMITED';
      message = 'Too many requests';
    } else {
      message = error.message;
    }
  }

  // Log to Sentry for 5xx errors
  if (statusCode >= 500) {
    captureException(error, {
      tags: {
        type: 'api_error',
        statusCode,
        requestId,
      },
    });
  }

  return NextResponse.json(
    {
      error: {
        message,
        code,
        statusCode,
        timestamp: new Date().toISOString(),
        requestId,
        details: process.env.NODE_ENV === 'development' ? details : undefined,
      },
    },
    { status: statusCode }
  );
}

/**
 * Async error wrapper for API routes
 */
export function withErrorHandler<T extends any[], R>(handler: (...args: T) => Promise<R>) {
  return async (...args: T): Promise<R | NextResponse<ErrorResponse>> => {
    const requestId = crypto.randomUUID();

    try {
      return await handler(...args);
    } catch (error) {
      return handleAPIError(error, requestId);
    }
  };
}
```

### 4. Client-Side Error Handling

#### File: `hooks/use-error-handler.ts`

```typescript
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { captureException } from '@sentry/nextjs';

export interface ErrorState {
  error: Error | null;
  isError: boolean;
  message: string | null;
  retry: () => void;
  reset: () => void;
}

export function useErrorHandler() {
  const [errorState, setErrorState] = useState<ErrorState>({
    error: null,
    isError: false,
    message: null,
    retry: () => {},
    reset: () => {},
  });

  const handleError = useCallback(
    (
      error: unknown,
      options?: {
        message?: string;
        showToast?: boolean;
        capture?: boolean;
        retry?: () => void;
      }
    ) => {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      const message = options?.message || errorObj.message || 'An error occurred';

      // Update state
      setErrorState({
        error: errorObj,
        isError: true,
        message,
        retry: options?.retry || (() => {}),
        reset: () =>
          setErrorState({
            error: null,
            isError: false,
            message: null,
            retry: () => {},
            reset: () => {},
          }),
      });

      // Show toast notification
      if (options?.showToast !== false) {
        toast.error(message, {
          action: options?.retry
            ? {
                label: 'Retry',
                onClick: options.retry,
              }
            : undefined,
        });
      }

      // Capture to Sentry
      if (options?.capture !== false) {
        captureException(errorObj, {
          tags: {
            component: 'useErrorHandler',
          },
        });
      }

      console.error('Error handled:', errorObj);
    },
    []
  );

  return {
    ...errorState,
    handleError,
  };
}
```

### 5. Fetch Wrapper with Retry Logic

#### File: `lib/fetch/fetch-with-retry.ts`

```typescript
export interface FetchOptions extends RequestInit {
  retries?: number;
  retryDelay?: number;
  timeout?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

export class FetchError extends Error {
  constructor(
    message: string,
    public response?: Response,
    public status?: number
  ) {
    super(message);
    this.name = 'FetchError';
  }
}

/**
 * Fetch with automatic retry and timeout
 */
export async function fetchWithRetry(url: string, options: FetchOptions = {}): Promise<Response> {
  const { retries = 3, retryDelay = 1000, timeout = 30000, onRetry, ...fetchOptions } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Check for HTTP errors
      if (!response.ok) {
        // Retry on 5xx errors or specific 4xx errors
        if (response.status >= 500 || response.status === 429) {
          throw new FetchError(
            `HTTP ${response.status}: ${response.statusText}`,
            response,
            response.status
          );
        }

        // Don't retry on client errors
        throw new FetchError(
          `HTTP ${response.status}: ${response.statusText}`,
          response,
          response.status
        );
      }

      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on client errors or abort
      if (
        error instanceof FetchError &&
        error.status &&
        error.status >= 400 &&
        error.status < 500 &&
        error.status !== 429
      ) {
        throw error;
      }

      // Don't retry if aborted
      if (error.name === 'AbortError') {
        throw new FetchError('Request timeout', undefined, 408);
      }

      // Last attempt, throw error
      if (attempt === retries) {
        throw lastError;
      }

      // Call retry callback
      if (onRetry) {
        onRetry(attempt + 1, lastError);
      }

      // Wait before retry with exponential backoff
      await new Promise((resolve) => setTimeout(resolve, retryDelay * Math.pow(2, attempt)));
    }
  }

  throw lastError || new Error('Fetch failed');
}
```

### 6. Error Recovery UI Components

#### File: `components/errors/error-recovery.tsx`

```typescript
'use client';

import { AlertCircle, RefreshCw, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface ErrorRecoveryProps {
  error: Error | null;
  retry?: () => void;
  reset?: () => void;
  type?: 'inline' | 'page' | 'modal';
}

export function ErrorRecovery({
  error,
  retry,
  reset,
  type = 'inline'
}: ErrorRecoveryProps) {
  // Detect error type
  const isNetworkError = error?.message.toLowerCase().includes('network') ||
                        error?.message.toLowerCase().includes('fetch');

  const isTimeoutError = error?.message.toLowerCase().includes('timeout');

  if (type === 'inline') {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription className="space-y-2">
          <p>{error?.message || 'Something went wrong'}</p>
          {(retry || reset) && (
            <div className="flex gap-2 mt-2">
              {retry && (
                <Button size="sm" variant="outline" onClick={retry}>
                  <RefreshCw className="mr-2 h-3 w-3" />
                  Retry
                </Button>
              )}
              {reset && (
                <Button size="sm" variant="ghost" onClick={reset}>
                  Dismiss
                </Button>
              )}
            </div>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  if (type === 'page') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
        <div className="text-center space-y-4 max-w-md">
          <div className="mx-auto h-12 w-12 text-muted-foreground">
            {isNetworkError ? (
              <WifiOff className="h-full w-full" />
            ) : (
              <AlertCircle className="h-full w-full" />
            )}
          </div>

          <h2 className="text-xl font-semibold">
            {isNetworkError ? 'Connection Problem' :
             isTimeoutError ? 'Request Timeout' :
             'Something went wrong'}
          </h2>

          <p className="text-muted-foreground">
            {isNetworkError ?
              'Please check your internet connection and try again.' :
             isTimeoutError ?
              'The request took too long to complete. Please try again.' :
              error?.message || 'An unexpected error occurred.'}
          </p>

          <div className="flex gap-3 justify-center">
            {retry && (
              <Button onClick={retry}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
            )}
            {reset && (
              <Button variant="outline" onClick={reset}>
                Go Back
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
```

## Acceptance Criteria

- [ ] Global error boundary catches all unhandled errors
- [ ] Component-level boundaries isolate failures
- [ ] User-friendly error messages without technical details
- [ ] Automatic retry for transient errors
- [ ] Error logging to Sentry in production
- [ ] Local error log storage for debugging
- [ ] Recovery actions (retry, reload, navigate)
- [ ] Network error detection and handling
- [ ] Form validation error display
- [ ] Loading states during recovery attempts

## Implementation Steps

1. **Hour 1**: Global and component error boundaries
2. **Hour 2**: API error handling and fetch wrapper
3. **Hour 3**: Recovery UI components and testing

## Testing

```typescript
describe('Error Boundaries', () => {
  it('should catch and display errors', () => {
    const ThrowError = () => {
      throw new Error('Test error');
    };

    const { getByText } = render(
      <GlobalErrorBoundary>
        <ThrowError />
      </GlobalErrorBoundary>
    );

    expect(getByText(/Something went wrong/i)).toBeInTheDocument();
    expect(getByText(/Try Again/i)).toBeInTheDocument();
  });

  it('should retry transient errors automatically', async () => {
    const spy = jest.fn();

    const NetworkError = () => {
      spy();
      if (spy.mock.calls.length < 3) {
        throw new Error('Network request failed');
      }
      return <div>Success</div>;
    };

    const { getByText } = render(
      <ComponentErrorBoundary componentName="Test">
        <NetworkError />
      </ComponentErrorBoundary>
    );

    await waitFor(() => {
      expect(getByText('Success')).toBeInTheDocument();
    });

    expect(spy).toHaveBeenCalledTimes(3);
  });
});
```

## Notes

- Consider implementing error budget monitoring
- Add user feedback mechanism for errors
- Create error recovery documentation for support team
- Monitor error rates and patterns for proactive fixes
