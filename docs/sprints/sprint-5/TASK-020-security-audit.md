# TASK-020: Security Audit & Hardening

## Overview

**Priority**: P0 - Blocker  
**Estimate**: 3 hours  
**Owner**: Security Engineer / Backend Developer  
**Dependencies**: All features complete  
**Status**: Not Started

## Problem Statement

We need to perform a comprehensive security audit and implement hardening measures before production deployment. This includes authentication security, API protection, data encryption, and vulnerability scanning to ensure the platform meets security best practices.

## Technical Requirements

### 1. Authentication & Authorization Security

#### File: `lib/auth/security-config.ts`

```typescript
import { NextAuthOptions } from 'next-auth';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import speakeasy from 'speakeasy';
import { RateLimiter } from '@/lib/security/rate-limiter';

const rateLimiter = new RateLimiter();

// Password validation schema
const PasswordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),

  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
        },
      },
    }),

    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        totpCode: { label: '2FA Code', type: 'text' },
      },

      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Invalid credentials');
        }

        // Rate limiting
        const isRateLimited = await rateLimiter.check(
          `login:${credentials.email}`,
          5, // max attempts
          60000 // window (1 minute)
        );

        if (isRateLimited) {
          throw new Error('Too many login attempts. Please try again later.');
        }

        // Find user
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          select: {
            id: true,
            email: true,
            password: true,
            name: true,
            emailVerified: true,
            twoFactorEnabled: true,
            twoFactorSecret: true,
            accountLocked: true,
            lockoutUntil: true,
          },
        });

        if (!user || !user.password) {
          await rateLimiter.increment(`login:${credentials.email}`);
          throw new Error('Invalid credentials');
        }

        // Check account lockout
        if (user.accountLocked || (user.lockoutUntil && user.lockoutUntil > new Date())) {
          throw new Error('Account is locked. Please contact support.');
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(credentials.password, user.password);

        if (!isValidPassword) {
          await rateLimiter.increment(`login:${credentials.email}`);

          // Track failed attempts
          await prisma.loginAttempt.create({
            data: {
              userId: user.id,
              success: false,
              ipAddress: credentials.ipAddress || 'unknown',
              userAgent: credentials.userAgent || 'unknown',
            },
          });

          // Lock account after 10 failed attempts
          const recentFailures = await prisma.loginAttempt.count({
            where: {
              userId: user.id,
              success: false,
              createdAt: {
                gte: new Date(Date.now() - 3600000), // last hour
              },
            },
          });

          if (recentFailures >= 10) {
            await prisma.user.update({
              where: { id: user.id },
              data: {
                accountLocked: true,
                lockoutUntil: new Date(Date.now() + 3600000), // 1 hour
              },
            });
          }

          throw new Error('Invalid credentials');
        }

        // Check email verification
        if (!user.emailVerified) {
          throw new Error('Please verify your email address');
        }

        // Check 2FA
        if (user.twoFactorEnabled && user.twoFactorSecret) {
          if (!credentials.totpCode) {
            throw new Error('2FA_REQUIRED');
          }

          const verified = speakeasy.totp.verify({
            secret: user.twoFactorSecret,
            encoding: 'base32',
            token: credentials.totpCode,
            window: 2,
          });

          if (!verified) {
            await rateLimiter.increment(`login:${credentials.email}`);
            throw new Error('Invalid 2FA code');
          }
        }

        // Successful login
        await prisma.loginAttempt.create({
          data: {
            userId: user.id,
            success: true,
            ipAddress: credentials.ipAddress || 'unknown',
            userAgent: credentials.userAgent || 'unknown',
          },
        });

        // Reset rate limiter
        await rateLimiter.reset(`login:${credentials.email}`);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      },
    }),
  ],

  session: {
    strategy: 'jwt',
    maxAge: 30 * 60, // 30 minutes
    updateAge: 5 * 60, // Update every 5 minutes
  },

  jwt: {
    secret: process.env.NEXTAUTH_SECRET,
    maxAge: 30 * 60, // 30 minutes
  },

  pages: {
    signIn: '/login',
    signOut: '/logout',
    error: '/auth/error',
    verifyRequest: '/auth/verify',
    newUser: '/onboarding',
  },

  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.userId = user.id;
        token.role = user.role;

        // Add session fingerprint
        token.fingerprint = generateSessionFingerprint();
      }

      // Check if token should be refreshed
      if (token.exp && Date.now() / 1000 > token.exp - 300) {
        // Refresh token 5 minutes before expiry
        token = await refreshAccessToken(token);
      }

      return token;
    },

    async session({ session, token }) {
      if (token) {
        session.userId = token.userId;
        session.role = token.role;

        // Validate session fingerprint
        if (!validateSessionFingerprint(token.fingerprint)) {
          throw new Error('Session hijacking detected');
        }
      }

      return session;
    },

    async signIn({ user, account, profile }) {
      // Additional security checks
      if (account?.provider === 'google') {
        // Verify Google account
        if (!profile?.email_verified) {
          return false;
        }
      }

      // Check IP-based restrictions
      const ipAddress = getClientIP();
      const isAllowed = await checkIPAllowlist(ipAddress);

      if (!isAllowed) {
        await logSecurityEvent('blocked_ip', {
          userId: user.id,
          ipAddress,
        });
        return false;
      }

      return true;
    },
  },
};

// Session fingerprinting
function generateSessionFingerprint(): string {
  // Combine multiple factors for fingerprint
  const factors = [getUserAgent(), getAcceptLanguage(), getAcceptEncoding(), getScreenResolution()];

  return crypto.createHash('sha256').update(factors.join('|')).digest('hex');
}

function validateSessionFingerprint(fingerprint: string): boolean {
  const currentFingerprint = generateSessionFingerprint();
  return currentFingerprint === fingerprint;
}

// Security event logging
async function logSecurityEvent(type: string, data: Record<string, any>): Promise<void> {
  await prisma.securityLog.create({
    data: {
      type,
      data,
      timestamp: new Date(),
      severity: getEventSeverity(type),
    },
  });

  // Alert on critical events
  if (getEventSeverity(type) === 'critical') {
    await sendSecurityAlert(type, data);
  }
}
```

### 2. API Security Middleware

#### File: `middleware.ts`

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { RateLimiter } from '@/lib/security/rate-limiter';
import crypto from 'crypto';

const rateLimiter = new RateLimiter();

// Security headers
const securityHeaders = {
  'X-DNS-Prefetch-Control': 'on',
  'X-Frame-Options': 'SAMEORIGIN',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': generateCSP(),
};

function generateCSP(): string {
  const directives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.google-analytics.com https://www.googletagmanager.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://api.contentmax.io https://www.google-analytics.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    'upgrade-insecure-requests',
  ];

  return directives.join('; ');
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Apply security headers
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  // CORS configuration
  const origin = request.headers.get('origin');
  const allowedOrigins = [
    'https://contentmax.io',
    'https://www.contentmax.io',
    'https://staging.contentmax.io',
  ];

  if (origin && allowedOrigins.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }

  // API route protection
  if (request.nextUrl.pathname.startsWith('/api')) {
    // Skip auth for public endpoints
    const publicEndpoints = ['/api/health', '/api/auth'];
    const isPublic = publicEndpoints.some((endpoint) =>
      request.nextUrl.pathname.startsWith(endpoint)
    );

    if (!isPublic) {
      // Verify JWT token
      const token = await getToken({ req: request });

      if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      // Check token expiration
      if (token.exp && Date.now() / 1000 > token.exp) {
        return NextResponse.json({ error: 'Token expired' }, { status: 401 });
      }

      // Rate limiting per user
      const rateLimitKey = `api:${token.userId}`;
      const isRateLimited = await rateLimiter.check(
        rateLimitKey,
        100, // requests
        60000 // per minute
      );

      if (isRateLimited) {
        return NextResponse.json(
          { error: 'Rate limit exceeded' },
          {
            status: 429,
            headers: {
              'X-RateLimit-Limit': '100',
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': new Date(Date.now() + 60000).toISOString(),
            },
          }
        );
      }

      // Add request ID for tracing
      const requestId = crypto.randomUUID();
      response.headers.set('X-Request-Id', requestId);

      // Log API access
      await logAPIAccess({
        userId: token.userId,
        endpoint: request.nextUrl.pathname,
        method: request.method,
        requestId,
        timestamp: new Date(),
      });
    }

    // Input sanitization
    if (request.method === 'POST' || request.method === 'PUT') {
      try {
        const contentType = request.headers.get('content-type');

        if (contentType?.includes('application/json')) {
          const body = await request.json();

          // Check for common injection patterns
          if (containsSQLInjection(JSON.stringify(body))) {
            return NextResponse.json({ error: 'Invalid input detected' }, { status: 400 });
          }

          // Check payload size (1MB limit)
          const size = new TextEncoder().encode(JSON.stringify(body)).length;
          if (size > 1048576) {
            return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
          }
        }
      } catch (error) {
        // Invalid JSON
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
      }
    }
  }

  // Admin route protection
  if (request.nextUrl.pathname.startsWith('/admin')) {
    const token = await getToken({ req: request });

    if (!token || token.role !== 'admin') {
      return NextResponse.redirect(new URL('/403', request.url));
    }
  }

  return response;
}

// SQL injection detection
function containsSQLInjection(input: string): boolean {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|CREATE|ALTER|EXEC|EXECUTE)\b)/gi,
    /(--|\||;|\/\*|\*\/|xp_|sp_|0x)/gi,
    /(\bOR\b\s*\d+\s*=\s*\d+)/gi,
    /(\bAND\b\s*\d+\s*=\s*\d+)/gi,
  ];

  return sqlPatterns.some((pattern) => pattern.test(input));
}

// API access logging
async function logAPIAccess(data: any): Promise<void> {
  // Implementation depends on your logging system
  console.log('API Access:', data);
}

export const config = {
  matcher: ['/api/:path*', '/admin/:path*', '/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

### 3. Data Encryption

#### File: `lib/security/encryption.ts`

```typescript
import crypto from 'crypto';

const algorithm = 'aes-256-gcm';
const saltLength = 64;
const tagLength = 16;
const ivLength = 16;
const iterations = 100000;
const keyLength = 32;

export class Encryption {
  private masterKey: string;

  constructor() {
    this.masterKey = process.env.ENCRYPTION_MASTER_KEY!;

    if (!this.masterKey || this.masterKey.length < 32) {
      throw new Error('Invalid encryption master key');
    }
  }

  /**
   * Encrypt sensitive data
   */
  async encrypt(text: string): Promise<string> {
    const salt = crypto.randomBytes(saltLength);
    const iv = crypto.randomBytes(ivLength);

    // Derive key from master key
    const key = crypto.pbkdf2Sync(this.masterKey, salt, iterations, keyLength, 'sha256');

    // Create cipher
    const cipher = crypto.createCipheriv(algorithm, key, iv);

    // Encrypt data
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);

    // Get auth tag
    const tag = cipher.getAuthTag();

    // Combine salt, iv, tag, and encrypted data
    const combined = Buffer.concat([salt, iv, tag, encrypted]);

    return combined.toString('base64');
  }

  /**
   * Decrypt sensitive data
   */
  async decrypt(encryptedText: string): Promise<string> {
    const combined = Buffer.from(encryptedText, 'base64');

    // Extract components
    const salt = combined.slice(0, saltLength);
    const iv = combined.slice(saltLength, saltLength + ivLength);
    const tag = combined.slice(saltLength + ivLength, saltLength + ivLength + tagLength);
    const encrypted = combined.slice(saltLength + ivLength + tagLength);

    // Derive key
    const key = crypto.pbkdf2Sync(this.masterKey, salt, iterations, keyLength, 'sha256');

    // Create decipher
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    decipher.setAuthTag(tag);

    // Decrypt data
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

    return decrypted.toString('utf8');
  }

  /**
   * Hash sensitive data (one-way)
   */
  hash(text: string): string {
    return crypto
      .createHash('sha256')
      .update(text + this.masterKey)
      .digest('hex');
  }

  /**
   * Generate secure random token
   */
  generateToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Encrypt API keys for storage
   */
  async encryptAPIKey(apiKey: string): Promise<{
    encrypted: string;
    keyId: string;
    lastFour: string;
  }> {
    const encrypted = await this.encrypt(apiKey);
    const keyId = this.generateToken(16);
    const lastFour = apiKey.slice(-4);

    return {
      encrypted,
      keyId,
      lastFour,
    };
  }

  /**
   * Mask sensitive data for logging
   */
  maskSensitiveData(data: any): any {
    const sensitiveKeys = [
      'password',
      'apiKey',
      'secret',
      'token',
      'authorization',
      'creditCard',
      'ssn',
      'email',
    ];

    if (typeof data === 'string') {
      return '***MASKED***';
    }

    if (typeof data === 'object' && data !== null) {
      const masked = Array.isArray(data) ? [...data] : { ...data };

      for (const key in masked) {
        if (
          sensitiveKeys.some((sensitive) => key.toLowerCase().includes(sensitive.toLowerCase()))
        ) {
          masked[key] = '***MASKED***';
        } else if (typeof masked[key] === 'object') {
          masked[key] = this.maskSensitiveData(masked[key]);
        }
      }

      return masked;
    }

    return data;
  }
}
```

### 4. Security Scanner

#### File: `scripts/security-audit.ts`

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

interface SecurityIssue {
  severity: 'critical' | 'high' | 'medium' | 'low';
  type: string;
  description: string;
  file?: string;
  line?: number;
  recommendation: string;
}

export class SecurityAuditor {
  private issues: SecurityIssue[] = [];

  /**
   * Run complete security audit
   */
  async runAudit(): Promise<SecurityIssue[]> {
    console.log('🔒 Starting security audit...\n');

    await this.checkDependencies();
    await this.checkCodePatterns();
    await this.checkEnvironmentVariables();
    await this.checkAPIEndpoints();
    await this.checkAuthentication();
    await this.checkDatabaseQueries();
    await this.checkFilePermissions();
    await this.runOWASPChecks();

    this.generateReport();

    return this.issues;
  }

  /**
   * Check for vulnerable dependencies
   */
  private async checkDependencies(): Promise<void> {
    console.log('Checking dependencies...');

    try {
      // Run npm audit
      const { stdout } = await execAsync('npm audit --json');
      const audit = JSON.parse(stdout);

      if (audit.metadata.vulnerabilities) {
        const vulns = audit.metadata.vulnerabilities;

        if (vulns.critical > 0) {
          this.issues.push({
            severity: 'critical',
            type: 'dependency',
            description: `${vulns.critical} critical vulnerabilities in dependencies`,
            recommendation: 'Run "npm audit fix" or update vulnerable packages',
          });
        }

        if (vulns.high > 0) {
          this.issues.push({
            severity: 'high',
            type: 'dependency',
            description: `${vulns.high} high severity vulnerabilities in dependencies`,
            recommendation: 'Review and update affected packages',
          });
        }
      }
    } catch (error) {
      console.error('Dependency check failed:', error);
    }
  }

  /**
   * Check for insecure code patterns
   */
  private async checkCodePatterns(): Promise<void> {
    console.log('Checking code patterns...');

    const patterns = [
      {
        pattern: /eval\s*\(/g,
        severity: 'critical' as const,
        description: 'Use of eval() detected',
        recommendation: 'Remove eval() and use safer alternatives',
      },
      {
        pattern: /dangerouslySetInnerHTML/g,
        severity: 'high' as const,
        description: 'Use of dangerouslySetInnerHTML detected',
        recommendation: 'Sanitize HTML content with DOMPurify',
      },
      {
        pattern: /process\.env\./g,
        severity: 'medium' as const,
        description: 'Direct environment variable access',
        recommendation: 'Use validated configuration module',
      },
      {
        pattern: /console\.(log|debug|info)/g,
        severity: 'low' as const,
        description: 'Console statements in production code',
        recommendation: 'Remove console statements for production',
      },
    ];

    const files = await this.getSourceFiles();

    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');
      const lines = content.split('\n');

      patterns.forEach(({ pattern, severity, description, recommendation }) => {
        lines.forEach((line, index) => {
          if (pattern.test(line)) {
            this.issues.push({
              severity,
              type: 'code_pattern',
              description,
              file: path.relative(process.cwd(), file),
              line: index + 1,
              recommendation,
            });
          }
        });
      });
    }
  }

  /**
   * Check environment variables
   */
  private async checkEnvironmentVariables(): Promise<void> {
    console.log('Checking environment variables...');

    const requiredVars = ['NEXTAUTH_SECRET', 'ENCRYPTION_MASTER_KEY', 'DATABASE_URL'];

    const missingVars = requiredVars.filter((v) => !process.env[v]);

    if (missingVars.length > 0) {
      this.issues.push({
        severity: 'critical',
        type: 'configuration',
        description: `Missing required environment variables: ${missingVars.join(', ')}`,
        recommendation: 'Set all required environment variables',
      });
    }

    // Check for weak secrets
    if (process.env.NEXTAUTH_SECRET && process.env.NEXTAUTH_SECRET.length < 32) {
      this.issues.push({
        severity: 'high',
        type: 'configuration',
        description: 'NEXTAUTH_SECRET is too short',
        recommendation: 'Use a secret at least 32 characters long',
      });
    }
  }

  /**
   * Check API endpoints for security
   */
  private async checkAPIEndpoints(): Promise<void> {
    console.log('Checking API endpoints...');

    const apiFiles = await this.getAPIFiles();

    for (const file of apiFiles) {
      const content = await fs.readFile(file, 'utf-8');

      // Check for missing authentication
      if (!content.includes('getServerSession') && !content.includes('getToken')) {
        this.issues.push({
          severity: 'high',
          type: 'api_security',
          description: 'API endpoint without authentication',
          file: path.relative(process.cwd(), file),
          recommendation: 'Add authentication check to API endpoint',
        });
      }

      // Check for missing input validation
      if (!content.includes('zod') && !content.includes('joi') && !content.includes('yup')) {
        this.issues.push({
          severity: 'medium',
          type: 'api_security',
          description: 'API endpoint without input validation',
          file: path.relative(process.cwd(), file),
          recommendation: 'Add input validation using Zod or similar',
        });
      }
    }
  }

  /**
   * Run OWASP security checks
   */
  private async runOWASPChecks(): Promise<void> {
    console.log('Running OWASP checks...');

    // Check for common OWASP Top 10 issues
    const checks = [
      this.checkInjection(),
      this.checkBrokenAuth(),
      this.checkSensitiveDataExposure(),
      this.checkXXE(),
      this.checkBrokenAccessControl(),
      this.checkSecurityMisconfiguration(),
      this.checkXSS(),
      this.checkInsecureDeserialization(),
      this.checkComponentVulnerabilities(),
      this.checkInsufficientLogging(),
    ];

    await Promise.all(checks);
  }

  /**
   * Helper methods
   */
  private async getSourceFiles(): Promise<string[]> {
    const { stdout } = await execAsync(
      'find . -type f \\( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \\) -not -path "./node_modules/*" -not -path "./.next/*"'
    );
    return stdout.split('\n').filter(Boolean);
  }

  private async getAPIFiles(): Promise<string[]> {
    const { stdout } = await execAsync(
      'find ./app/api -type f \\( -name "*.ts" -o -name "*.js" \\) 2>/dev/null || echo ""'
    );
    return stdout.split('\n').filter(Boolean);
  }

  /**
   * Generate security report
   */
  private generateReport(): void {
    console.log('\n📊 Security Audit Report\n');
    console.log('=' * 60);

    const bySerity = {
      critical: this.issues.filter((i) => i.severity === 'critical'),
      high: this.issues.filter((i) => i.severity === 'high'),
      medium: this.issues.filter((i) => i.severity === 'medium'),
      low: this.issues.filter((i) => i.severity === 'low'),
    };

    console.log(`Critical: ${bySerity.critical.length}`);
    console.log(`High: ${bySerity.high.length}`);
    console.log(`Medium: ${bySerity.medium.length}`);
    console.log(`Low: ${bySerity.low.length}`);
    console.log('=' * 60);

    if (bySerity.critical.length > 0) {
      console.log('\n❌ CRITICAL ISSUES:');
      bySerity.critical.forEach((issue) => {
        console.log(`\n- ${issue.description}`);
        if (issue.file) console.log(`  File: ${issue.file}:${issue.line || ''}`);
        console.log(`  Fix: ${issue.recommendation}`);
      });
    }

    if (bySerity.high.length > 0) {
      console.log('\n⚠️  HIGH SEVERITY ISSUES:');
      bySerity.high.forEach((issue) => {
        console.log(`\n- ${issue.description}`);
        if (issue.file) console.log(`  File: ${issue.file}:${issue.line || ''}`);
        console.log(`  Fix: ${issue.recommendation}`);
      });
    }

    // Save report to file
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: this.issues.length,
        critical: bySerity.critical.length,
        high: bySerity.high.length,
        medium: bySerity.medium.length,
        low: bySerity.low.length,
      },
      issues: this.issues,
    };

    fs.writeFile('security-audit-report.json', JSON.stringify(report, null, 2));

    console.log('\n✅ Report saved to security-audit-report.json');

    // Fail if critical issues found
    if (bySerity.critical.length > 0) {
      console.error('\n🚨 Critical security issues found. Fix before deploying!');
      process.exit(1);
    }
  }
}

// Run audit if executed directly
if (require.main === module) {
  const auditor = new SecurityAuditor();
  auditor.runAudit().catch(console.error);
}
```

### 5. Security Configuration

#### File: `.env.production.example`

```env
# Security Configuration
NODE_ENV=production

# Authentication
NEXTAUTH_URL=https://contentmax.io
NEXTAUTH_SECRET= # Generate with: openssl rand -base64 32

# Encryption
ENCRYPTION_MASTER_KEY= # Generate with: openssl rand -hex 32

# Database
DATABASE_URL= # Use connection pooling
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10

# Rate Limiting
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX_REQUESTS=100

# Session Configuration
SESSION_MAX_AGE=1800 # 30 minutes
SESSION_UPDATE_AGE=300 # 5 minutes

# CORS
ALLOWED_ORIGINS=https://contentmax.io,https://www.contentmax.io

# Security Headers
CSP_REPORT_URI=https://contentmax.io/api/csp-report
HSTS_MAX_AGE=31536000

# API Security
API_KEY_SALT= # Generate with: openssl rand -hex 16
JWT_ALGORITHM=RS256

# 2FA
TOTP_WINDOW=2
TOTP_STEP=30

# Password Policy
PASSWORD_MIN_LENGTH=12
PASSWORD_REQUIRE_UPPERCASE=true
PASSWORD_REQUIRE_LOWERCASE=true
PASSWORD_REQUIRE_NUMBERS=true
PASSWORD_REQUIRE_SYMBOLS=true

# Account Security
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_DURATION=3600000 # 1 hour
PASSWORD_RESET_TOKEN_EXPIRY=3600000 # 1 hour
EMAIL_VERIFICATION_TOKEN_EXPIRY=86400000 # 24 hours
```

## Acceptance Criteria

- [ ] Authentication with 2FA support
- [ ] Session management with fingerprinting
- [ ] Rate limiting on all endpoints
- [ ] Input validation and sanitization
- [ ] SQL injection prevention
- [ ] XSS protection
- [ ] CSRF protection
- [ ] Security headers configured
- [ ] Data encryption at rest
- [ ] Security audit passing with no critical issues

## Implementation Steps

1. **Hour 1**: Authentication and session security
2. **Hour 2**: API security middleware and rate limiting
3. **Hour 3**: Data encryption and security scanning

## Testing

```bash
# Run security audit
pnpm security:audit

# Test rate limiting
for i in {1..150}; do
  curl -X GET https://localhost:3000/api/test \
    -H "Authorization: Bearer $TOKEN"
done

# Test SQL injection prevention
curl -X POST https://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "test\"; DROP TABLE users; --"}'

# Penetration testing
nikto -h https://localhost:3000
nmap -sV --script=http-security-headers localhost
```

## Notes

- Schedule regular security audits
- Keep dependencies updated
- Monitor security advisories
- Implement security training for team
- Consider bug bounty program
