import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitize HTML content to prevent XSS attacks
 */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
  });
}

/**
 * Sanitize user input to prevent injection attacks
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove HTML brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
}

/**
 * Validate and sanitize URL
 */
export function validateUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }
    
    // Prevent localhost and private IPs in production
    if (process.env.NODE_ENV === 'production') {
      const hostname = parsed.hostname.toLowerCase();
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('172.')
      ) {
        return null;
      }
    }
    
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Common validation schemas
 */
export const ValidationSchemas = {
  // User input
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be at most 20 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'),
  
  email: z.string()
    .email('Invalid email address')
    .max(255, 'Email must be at most 255 characters'),
  
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password must be at most 100 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  
  // Content
  title: z.string()
    .min(1, 'Title is required')
    .max(200, 'Title must be at most 200 characters')
    .transform(sanitizeInput),
  
  description: z.string()
    .max(1000, 'Description must be at most 1000 characters')
    .transform(sanitizeInput),
  
  content: z.string()
    .max(50000, 'Content must be at most 50000 characters')
    .transform(sanitizeHtml),
  
  // API
  apiKey: z.string()
    .regex(/^[a-zA-Z0-9_-]{32,}$/, 'Invalid API key format'),
  
  // IDs
  uuid: z.string()
    .uuid('Invalid UUID format'),
  
  // Pagination
  page: z.coerce.number()
    .int()
    .min(1)
    .default(1),
  
  limit: z.coerce.number()
    .int()
    .min(1)
    .max(100)
    .default(10),
};

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export const RateLimits: Record<string, RateLimitConfig> = {
  api: { windowMs: 60000, maxRequests: 100 }, // 100 requests per minute
  auth: { windowMs: 900000, maxRequests: 5 }, // 5 attempts per 15 minutes
  generate: { windowMs: 60000, maxRequests: 10 }, // 10 generations per minute
  scrape: { windowMs: 60000, maxRequests: 5 }, // 5 scrapes per minute
};

/**
 * SQL injection prevention - parameterized query helper
 */
export function buildSafeQuery(
  baseQuery: string,
  params: Record<string, any>
): { query: string; values: any[] } {
  const values: any[] = [];
  let paramIndex = 1;
  
  const query = baseQuery.replace(/:(\w+)/g, (match, param) => {
    if (Object.prototype.hasOwnProperty.call(params, param)) {
      values.push(params[param]);
      return `$${paramIndex++}`;
    }
    return match;
  });
  
  return { query, values };
}

/**
 * Check for common SQL injection patterns
 */
export function detectSQLInjection(input: string): boolean {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE)\b)/i,
    /(--|\||;|\/\*|\*\/)/,
    /(\bOR\b\s*\d+\s*=\s*\d+)/i,
    /(\bAND\b\s*\d+\s*=\s*\d+)/i,
    /('\s*OR\s*')/i,
  ];
  
  return sqlPatterns.some(pattern => pattern.test(input));
}

/**
 * File upload validation
 */
export interface FileValidationOptions {
  maxSize?: number; // in bytes
  allowedTypes?: string[];
  allowedExtensions?: string[];
}

export function validateFile(
  file: File,
  options: FileValidationOptions = {}
): { valid: boolean; error?: string } {
  const {
    maxSize = 10 * 1024 * 1024, // 10MB default
    allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
  } = options;
  
  // Check file size
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File size exceeds ${maxSize / (1024 * 1024)}MB limit`,
    };
  }
  
  // Check MIME type
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `File type ${file.type} is not allowed`,
    };
  }
  
  // Check file extension
  const extension = '.' + file.name.split('.').pop()?.toLowerCase();
  if (!allowedExtensions.includes(extension)) {
    return {
      valid: false,
      error: `File extension ${extension} is not allowed`,
    };
  }
  
  return { valid: true };
}