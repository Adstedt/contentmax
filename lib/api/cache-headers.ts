import { NextResponse } from 'next/server';

export interface CacheOptions {
  maxAge?: number;
  sMaxAge?: number;
  staleWhileRevalidate?: number;
  private?: boolean;
  immutable?: boolean;
}

/**
 * Add cache control headers to a NextResponse
 */
export function withCacheHeaders(
  response: NextResponse,
  options: CacheOptions = {}
): NextResponse {
  const {
    maxAge = 0,
    sMaxAge = 0,
    staleWhileRevalidate = 0,
    private: isPrivate = false,
    immutable = false,
  } = options;

  const directives: string[] = [];

  if (isPrivate) {
    directives.push('private');
  } else {
    directives.push('public');
  }

  if (maxAge > 0) {
    directives.push(`max-age=${maxAge}`);
  }

  if (sMaxAge > 0) {
    directives.push(`s-maxage=${sMaxAge}`);
  }

  if (staleWhileRevalidate > 0) {
    directives.push(`stale-while-revalidate=${staleWhileRevalidate}`);
  }

  if (immutable) {
    directives.push('immutable');
  }

  response.headers.set('Cache-Control', directives.join(', '));

  return response;
}

/**
 * Cache presets for common scenarios
 */
export const CachePresets = {
  // No caching
  noCache: { maxAge: 0, sMaxAge: 0 },
  
  // Cache for 1 minute in browser, 5 minutes on CDN
  shortLived: { maxAge: 60, sMaxAge: 300 },
  
  // Cache for 5 minutes in browser, 1 hour on CDN, revalidate in background
  standard: { maxAge: 300, sMaxAge: 3600, staleWhileRevalidate: 86400 },
  
  // Cache for 1 hour in browser, 1 day on CDN
  longLived: { maxAge: 3600, sMaxAge: 86400 },
  
  // Cache forever (for truly immutable content)
  immutable: { maxAge: 31536000, immutable: true },
  
  // Private cache (user-specific content)
  private: { maxAge: 300, private: true },
};