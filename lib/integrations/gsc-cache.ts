import { CacheEntry, GSCCacheKey } from '@/types/google.types';
import crypto from 'crypto';

export class GSCDataCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private readonly DEFAULT_TTL = 24 * 60 * 60; // 24 hours in seconds

  /**
   * Generate cache key from parameters
   */
  generateKey(params: GSCCacheKey): string {
    const keyString = JSON.stringify(params, Object.keys(params).sort());
    return crypto.createHash('md5').update(keyString).digest('hex');
  }

  /**
   * Get cached data if valid
   */
  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if cache is still valid
    const now = new Date();
    const entryAge = (now.getTime() - entry.timestamp.getTime()) / 1000; // Age in seconds
    
    if (entryAge > entry.ttl) {
      // Cache expired
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set cache data
   */
  async set<T>(key: string, data: T, ttl?: number): Promise<void> {
    const entry: CacheEntry<T> = {
      data,
      timestamp: new Date(),
      ttl: ttl || this.DEFAULT_TTL,
    };

    this.cache.set(key, entry);
    
    // Clean up old entries periodically
    if (this.cache.size > 100) {
      this.cleanup();
    }
  }

  /**
   * Invalidate cache entry
   */
  async invalidate(key: string): Promise<void> {
    this.cache.delete(key);
  }

  /**
   * Invalidate all cache entries for a project
   */
  async invalidateProject(projectId: string): Promise<void> {
    const keysToDelete: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      // Check if this cache entry belongs to the project
      // This is a simplified check - in production you might want to store metadata
      if (key.includes(projectId)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    this.cache.clear();
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = new Date();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      const entryAge = (now.getTime() - entry.timestamp.getTime()) / 1000;
      
      if (entryAge > entry.ttl) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    entries: Array<{ key: string; timestamp: Date; ttl: number }>;
  } {
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      timestamp: entry.timestamp,
      ttl: entry.ttl,
    }));

    return {
      size: this.cache.size,
      entries,
    };
  }

  /**
   * Check if cache has valid entry
   */
  async has(key: string): Promise<boolean> {
    const data = await this.get(key);
    return data !== null;
  }

  /**
   * Get remaining TTL for cache entry
   */
  getTTL(key: string): number | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    const now = new Date();
    const entryAge = (now.getTime() - entry.timestamp.getTime()) / 1000;
    const remainingTTL = entry.ttl - entryAge;
    
    return remainingTTL > 0 ? remainingTTL : 0;
  }
}

// Singleton instance for application-wide caching
let cacheInstance: GSCDataCache | null = null;

export function getGSCCache(): GSCDataCache {
  if (!cacheInstance) {
    cacheInstance = new GSCDataCache();
  }
  return cacheInstance;
}