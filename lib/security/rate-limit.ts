import { NextRequest } from 'next/server';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

// In-memory store for development
// In production, use Redis or similar
const store: RateLimitStore = {};

export interface RateLimitOptions {
  windowMs?: number;
  max?: number;
  keyGenerator?: (req: NextRequest) => string;
}

export class RateLimiter {
  private windowMs: number;
  private max: number;
  private keyGenerator: (req: NextRequest) => string;

  constructor(options: RateLimitOptions = {}) {
    this.windowMs = options.windowMs || 60000; // 1 minute default
    this.max = options.max || 100; // 100 requests default
    this.keyGenerator = options.keyGenerator || this.defaultKeyGenerator;
  }

  private defaultKeyGenerator(req: NextRequest): string {
    return req.ip || req.headers.get('x-forwarded-for') || 'unknown';
  }

  async limit(req: NextRequest): Promise<{
    success: boolean;
    limit: number;
    remaining: number;
    reset: Date;
  }> {
    const key = this.keyGenerator(req);
    const now = Date.now();
    
    // Clean up expired entries
    this.cleanup(now);
    
    // Get or create entry
    if (!store[key] || store[key].resetTime <= now) {
      store[key] = {
        count: 0,
        resetTime: now + this.windowMs,
      };
    }
    
    const entry = store[key];
    entry.count++;
    
    const remaining = Math.max(0, this.max - entry.count);
    const reset = new Date(entry.resetTime);
    
    return {
      success: entry.count <= this.max,
      limit: this.max,
      remaining,
      reset,
    };
  }

  private cleanup(now: number): void {
    Object.keys(store).forEach(key => {
      if (store[key].resetTime <= now) {
        delete store[key];
      }
    });
  }
}

// Pre-configured rate limiters for different endpoints
export const rateLimiters = {
  api: new RateLimiter({
    windowMs: 60000, // 1 minute
    max: 100,
  }),
  
  auth: new RateLimiter({
    windowMs: 900000, // 15 minutes
    max: 5,
  }),
  
  generate: new RateLimiter({
    windowMs: 60000, // 1 minute
    max: 10,
  }),
  
  scrape: new RateLimiter({
    windowMs: 60000, // 1 minute
    max: 5,
  }),
};

/**
 * Middleware helper for rate limiting
 */
export async function withRateLimit(
  req: NextRequest,
  limiter: RateLimiter = rateLimiters.api
): Promise<Response | null> {
  const result = await limiter.limit(req);
  
  if (!result.success) {
    return new Response(
      JSON.stringify({
        error: 'Too many requests',
        retryAfter: result.reset.toISOString(),
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': result.limit.toString(),
          'X-RateLimit-Remaining': result.remaining.toString(),
          'X-RateLimit-Reset': result.reset.toISOString(),
          'Retry-After': Math.ceil((result.reset.getTime() - Date.now()) / 1000).toString(),
        },
      }
    );
  }
  
  return null;
}