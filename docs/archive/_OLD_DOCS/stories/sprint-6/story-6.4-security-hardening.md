# Story 6.4: Security Hardening

## User Story

As a security officer,
I want comprehensive security measures implemented,
So that the system is protected against common vulnerabilities and attacks.

## Size & Priority

- **Size**: L (8 hours)
- **Priority**: P0 - Critical
- **Sprint**: 6
- **Dependencies**: Task 1.3 (Auth system)

## Description

Implement comprehensive security hardening including input validation, rate limiting, SQL injection prevention, XSS protection, CSRF protection, security headers, encryption, and security monitoring.

## Implementation Steps

1. **Input validation and sanitization**

   ```typescript
   // lib/security/input-validator.ts
   import { z } from 'zod';
   import DOMPurify from 'isomorphic-dompurify';
   import validator from 'validator';

   class InputValidator {
     private schemas = new Map<string, z.ZodSchema>();

     constructor() {
       this.registerSchemas();
     }

     private registerSchemas() {
       // User input schemas
       this.schemas.set('user.email', z.string().email().max(255));
       this.schemas.set(
         'user.password',
         z
           .string()
           .min(8)
           .max(128)
           .regex(
             /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/,
             'Password must contain uppercase, lowercase, number and special character'
           )
       );

       // Content generation schemas
       this.schemas.set('generation.keywords', z.array(z.string().min(1).max(50)).max(20));

       this.schemas.set(
         'generation.pageType',
         z.enum(['product', 'category', 'brand', 'inspire', 'engage'])
       );

       // API request schemas
       this.schemas.set(
         'api.pagination',
         z.object({
           page: z.number().int().positive().max(10000),
           limit: z.number().int().positive().max(100),
         })
       );

       // File upload schemas
       this.schemas.set(
         'file.upload',
         z.object({
           filename: z.string().regex(/^[a-zA-Z0-9-_\.]+$/),
           mimetype: z.enum(['image/jpeg', 'image/png', 'image/webp', 'text/csv']),
           size: z.number().max(10 * 1024 * 1024), // 10MB max
         })
       );
     }

     validate<T>(schemaKey: string, data: unknown): T {
       const schema = this.schemas.get(schemaKey);
       if (!schema) {
         throw new Error(`Schema ${schemaKey} not found`);
       }

       try {
         return schema.parse(data) as T;
       } catch (error) {
         if (error instanceof z.ZodError) {
           throw new ValidationError('Validation failed', error.errors);
         }
         throw error;
       }
     }

     sanitizeHTML(html: string): string {
       return DOMPurify.sanitize(html, {
         ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'li', 'ol'],
         ALLOWED_ATTR: ['href', 'target', 'rel'],
         ALLOW_DATA_ATTR: false,
       });
     }

     sanitizeSQL(input: string): string {
       // Remove SQL keywords and special characters
       const sqlKeywords =
         /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|WHERE|FROM|JOIN|ORDER|GROUP|HAVING|EXEC|EXECUTE|SCRIPT|JAVASCRIPT)\b)/gi;
       return input.replace(sqlKeywords, '').replace(/[;'"\\]/g, '');
     }

     sanitizeFilename(filename: string): string {
       // Remove path traversal attempts
       return filename
         .replace(/\.\./g, '')
         .replace(/[^a-zA-Z0-9-_.]/g, '')
         .substring(0, 255);
     }

     validateURL(url: string, options?: { allowedDomains?: string[] }): boolean {
       if (!validator.isURL(url, { protocols: ['https'] })) {
         return false;
       }

       if (options?.allowedDomains) {
         const urlObj = new URL(url);
         return options.allowedDomains.includes(urlObj.hostname);
       }

       return true;
     }

     preventNoSQLInjection(query: any): any {
       // Recursively check for MongoDB operators
       const dangerousOperators = ['$where', '$regex', '$options', '$expr'];

       const sanitize = (obj: any): any => {
         if (typeof obj !== 'object' || obj === null) {
           return obj;
         }

         const sanitized: any = Array.isArray(obj) ? [] : {};

         for (const key in obj) {
           if (dangerousOperators.includes(key)) {
             continue; // Skip dangerous operators
           }

           if (typeof key === 'string' && key.startsWith('$')) {
             // Log potential injection attempt
             console.warn(`Potential NoSQL injection attempt: ${key}`);
             continue;
           }

           sanitized[key] = sanitize(obj[key]);
         }

         return sanitized;
       };

       return sanitize(query);
     }
   }
   ```

2. **Rate limiting and DDoS protection**

   ```typescript
   // lib/security/rate-limiter.ts
   import Redis from 'ioredis';
   import { RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible';

   class RateLimitManager {
     private limiters = new Map<string, RateLimiterRedis>();
     private redis: Redis;

     constructor() {
       this.redis = new Redis(process.env.REDIS_URL!);
       this.setupLimiters();
     }

     private setupLimiters() {
       // API rate limiting
       this.limiters.set(
         'api',
         new RateLimiterRedis({
           storeClient: this.redis,
           keyPrefix: 'rl:api',
           points: 100, // requests
           duration: 60, // per minute
           blockDuration: 60 * 5, // block for 5 minutes
         })
       );

       // Authentication rate limiting
       this.limiters.set(
         'auth',
         new RateLimiterRedis({
           storeClient: this.redis,
           keyPrefix: 'rl:auth',
           points: 5,
           duration: 60 * 15, // 15 minutes
           blockDuration: 60 * 60, // block for 1 hour
         })
       );

       // Content generation rate limiting
       this.limiters.set(
         'generation',
         new RateLimiterRedis({
           storeClient: this.redis,
           keyPrefix: 'rl:gen',
           points: 20,
           duration: 60 * 60, // per hour
           blockDuration: 60 * 30,
         })
       );

       // IP-based rate limiting
       this.limiters.set(
         'ip',
         new RateLimiterRedis({
           storeClient: this.redis,
           keyPrefix: 'rl:ip',
           points: 1000,
           duration: 60 * 60,
           blockDuration: 60 * 60 * 24, // 24 hour ban
         })
       );

       // Consecutive failure limiting
       this.limiters.set(
         'consecutive',
         new RateLimiterRedis({
           storeClient: this.redis,
           keyPrefix: 'rl:consecutive',
           points: 10,
           duration: 60 * 60,
           blockDuration: 60 * 60 * 24,
         })
       );
     }

     async checkLimit(limiterKey: string, identifier: string, cost = 1): Promise<RateLimitResult> {
       const limiter = this.limiters.get(limiterKey);
       if (!limiter) {
         throw new Error(`Rate limiter ${limiterKey} not found`);
       }

       try {
         const result = await limiter.consume(identifier, cost);
         return {
           allowed: true,
           remaining: result.remainingPoints,
           resetAt: new Date(Date.now() + result.msBeforeNext),
         };
       } catch (error) {
         if (error instanceof RateLimiterRes) {
           return {
             allowed: false,
             remaining: error.remainingPoints,
             resetAt: new Date(Date.now() + error.msBeforeNext),
             retryAfter: error.msBeforeNext / 1000,
           };
         }
         throw error;
       }
     }

     async resetLimit(limiterKey: string, identifier: string) {
       const limiter = this.limiters.get(limiterKey);
       if (limiter) {
         await limiter.delete(identifier);
       }
     }

     // DDoS protection
     async detectDDoS(ip: string): Promise<boolean> {
       const key = `ddos:${ip}`;
       const window = 10; // 10 seconds
       const threshold = 100; // requests

       const count = await this.redis.incr(key);

       if (count === 1) {
         await this.redis.expire(key, window);
       }

       if (count > threshold) {
         // Potential DDoS detected
         await this.blockIP(ip, 'DDoS detected');
         return true;
       }

       return false;
     }

     private async blockIP(ip: string, reason: string) {
       await this.redis.setex(`blocked:${ip}`, 86400, reason); // 24 hour block

       // Add to firewall rules if configured
       if (process.env.CLOUDFLARE_API_KEY) {
         await this.addCloudflareBlock(ip);
       }

       // Log security event
       logger.security('IP blocked', { ip, reason });
     }
   }
   ```

3. **Security headers and CSP**

   ```typescript
   // middleware/security-headers.ts
   import helmet from 'helmet';
   import { NextRequest, NextResponse } from 'next/server';

   export function securityHeaders(req: NextRequest, res: NextResponse) {
     // Content Security Policy
     const csp = {
       'default-src': ["'self'"],
       'script-src': [
         "'self'",
         "'unsafe-inline'", // Remove in production
         'https://cdn.jsdelivr.net',
         'https://www.googletagmanager.com',
       ],
       'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
       'font-src': ["'self'", 'https://fonts.gstatic.com'],
       'img-src': ["'self'", 'data:', 'https:', 'blob:'],
       'connect-src': ["'self'", process.env.NEXT_PUBLIC_SUPABASE_URL, 'https://api.openai.com'],
       'frame-ancestors': ["'none'"],
       'base-uri': ["'self'"],
       'form-action': ["'self'"],
       'upgrade-insecure-requests': [],
     };

     const cspString = Object.entries(csp)
       .map(([key, values]) => `${key} ${values.join(' ')}`)
       .join('; ');

     // Apply security headers
     res.headers.set('Content-Security-Policy', cspString);
     res.headers.set('X-Content-Type-Options', 'nosniff');
     res.headers.set('X-Frame-Options', 'DENY');
     res.headers.set('X-XSS-Protection', '1; mode=block');
     res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
     res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

     // HSTS (only in production)
     if (process.env.NODE_ENV === 'production') {
       res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
     }

     return res;
   }

   // CORS configuration
   export function corsHeaders(req: NextRequest, res: NextResponse) {
     const origin = req.headers.get('origin');
     const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];

     if (origin && allowedOrigins.includes(origin)) {
       res.headers.set('Access-Control-Allow-Origin', origin);
       res.headers.set('Access-Control-Allow-Credentials', 'true');
       res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
       res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
       res.headers.set('Access-Control-Max-Age', '86400');
     }

     return res;
   }
   ```

4. **Encryption and secrets management**

   ```typescript
   // lib/security/encryption.ts
   import crypto from 'crypto';
   import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

   class EncryptionManager {
     private algorithm = 'aes-256-gcm';
     private secretManager: SecretManagerServiceClient;
     private keyCache = new Map<string, Buffer>();

     constructor() {
       this.secretManager = new SecretManagerServiceClient();
     }

     async encrypt(data: string, keyId: string): Promise<EncryptedData> {
       const key = await this.getEncryptionKey(keyId);
       const iv = crypto.randomBytes(16);
       const cipher = crypto.createCipheriv(this.algorithm, key, iv);

       let encrypted = cipher.update(data, 'utf8', 'hex');
       encrypted += cipher.final('hex');

       const authTag = cipher.getAuthTag();

       return {
         encrypted,
         iv: iv.toString('hex'),
         authTag: authTag.toString('hex'),
         keyId,
         algorithm: this.algorithm,
         timestamp: new Date(),
       };
     }

     async decrypt(encryptedData: EncryptedData): Promise<string> {
       const key = await this.getEncryptionKey(encryptedData.keyId);
       const decipher = crypto.createDecipheriv(
         this.algorithm,
         key,
         Buffer.from(encryptedData.iv, 'hex')
       );

       decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));

       let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
       decrypted += decipher.final('utf8');

       return decrypted;
     }

     async getEncryptionKey(keyId: string): Promise<Buffer> {
       // Check cache first
       if (this.keyCache.has(keyId)) {
         return this.keyCache.get(keyId)!;
       }

       // Fetch from secret manager
       const [secret] = await this.secretManager.accessSecretVersion({
         name: `projects/${process.env.GCP_PROJECT}/secrets/${keyId}/versions/latest`,
       });

       const key = Buffer.from(secret.payload?.data?.toString() || '', 'base64');

       // Cache for 1 hour
       this.keyCache.set(keyId, key);
       setTimeout(() => this.keyCache.delete(keyId), 3600000);

       return key;
     }

     // Encrypt sensitive fields in database
     async encryptSensitiveData(data: any): Promise<any> {
       const sensitiveFields = ['ssn', 'creditCard', 'apiKey', 'password'];
       const encrypted = { ...data };

       for (const field of sensitiveFields) {
         if (data[field]) {
           encrypted[field] = await this.encrypt(data[field], 'data-encryption-key');
         }
       }

       return encrypted;
     }

     // Hash passwords with salt
     async hashPassword(password: string): Promise<string> {
       const salt = crypto.randomBytes(32);
       const iterations = 100000;
       const keyLength = 64;

       return new Promise((resolve, reject) => {
         crypto.pbkdf2(password, salt, iterations, keyLength, 'sha256', (err, key) => {
           if (err) reject(err);
           resolve(`${salt.toString('hex')}:${key.toString('hex')}`);
         });
       });
     }

     async verifyPassword(password: string, hash: string): Promise<boolean> {
       const [salt, key] = hash.split(':');
       const iterations = 100000;
       const keyLength = 64;

       return new Promise((resolve, reject) => {
         crypto.pbkdf2(
           password,
           Buffer.from(salt, 'hex'),
           iterations,
           keyLength,
           'sha256',
           (err, derivedKey) => {
             if (err) reject(err);
             resolve(derivedKey.toString('hex') === key);
           }
         );
       });
     }
   }
   ```

5. **Security monitoring and audit logging**

   ```typescript
   // lib/security/security-monitor.ts
   class SecurityMonitor {
     private auditLogger: AuditLogger;
     private anomalyDetector: AnomalyDetector;
     private threatIntelligence: ThreatIntelligence;

     constructor() {
       this.auditLogger = new AuditLogger();
       this.anomalyDetector = new AnomalyDetector();
       this.threatIntelligence = new ThreatIntelligence();
     }

     async logSecurityEvent(event: SecurityEvent) {
       // Log to audit trail
       await this.auditLogger.log({
         timestamp: new Date(),
         eventType: event.type,
         severity: event.severity,
         userId: event.userId,
         ip: event.ip,
         userAgent: event.userAgent,
         details: event.details,
         outcome: event.outcome,
       });

       // Check for patterns
       await this.detectPatterns(event);

       // Alert if critical
       if (event.severity === 'critical') {
         await this.sendSecurityAlert(event);
       }
     }

     private async detectPatterns(event: SecurityEvent) {
       // Failed login attempts
       if (event.type === 'auth.failed') {
         const failedAttempts = await this.auditLogger.countEvents({
           type: 'auth.failed',
           userId: event.userId,
           since: new Date(Date.now() - 900000), // 15 minutes
         });

         if (failedAttempts >= 5) {
           await this.triggerAccountLockout(event.userId);
         }
       }

       // Privilege escalation attempts
       if (event.type === 'auth.privilege_escalation') {
         await this.flagSuspiciousActivity(event);
       }

       // Data exfiltration detection
       if (event.type === 'data.export') {
         const exportVolume = await this.calculateExportVolume(event.userId);
         if (exportVolume > 1000000) {
           // 1MB
           await this.flagDataExfiltration(event);
         }
       }
     }

     async performSecurityScan(): Promise<SecurityScanResult> {
       const results = await Promise.all([
         this.scanForVulnerabilities(),
         this.checkConfigurations(),
         this.auditPermissions(),
         this.scanDependencies(),
         this.checkEncryption(),
         this.reviewAccessLogs(),
       ]);

       return {
         timestamp: new Date(),
         vulnerabilities: results[0],
         misconfigurations: results[1],
         permissionIssues: results[2],
         dependencyVulnerabilities: results[3],
         encryptionIssues: results[4],
         suspiciousActivity: results[5],
       };
     }

     private async scanForVulnerabilities(): Promise<Vulnerability[]> {
       const vulnerabilities = [];

       // Check for SQL injection vulnerabilities
       const sqlInjectionRisk = await this.checkSQLInjection();
       if (sqlInjectionRisk.length > 0) {
         vulnerabilities.push(...sqlInjectionRisk);
       }

       // Check for XSS vulnerabilities
       const xssRisk = await this.checkXSS();
       if (xssRisk.length > 0) {
         vulnerabilities.push(...xssRisk);
       }

       // Check for insecure direct object references
       const idorRisk = await this.checkIDOR();
       if (idorRisk.length > 0) {
         vulnerabilities.push(...idorRisk);
       }

       return vulnerabilities;
     }

     // Real-time threat detection
     async detectThreat(request: Request): Promise<ThreatAssessment> {
       const ip = this.getClientIP(request);
       const userAgent = request.headers.get('user-agent') || '';

       // Check against threat intelligence
       const threatLevel = await this.threatIntelligence.checkIP(ip);

       // Check for suspicious patterns
       const patterns = await this.checkSuspiciousPatterns(request);

       // Check for known attack signatures
       const signatures = await this.checkAttackSignatures(request);

       return {
         ip,
         threatLevel,
         patterns,
         signatures,
         recommendation: this.getRecommendation(threatLevel, patterns, signatures),
       };
     }
   }
   ```

## Files to Create

- `lib/security/input-validator.ts` - Input validation
- `lib/security/rate-limiter.ts` - Rate limiting
- `lib/security/encryption.ts` - Encryption utilities
- `lib/security/security-monitor.ts` - Security monitoring
- `lib/security/audit-logger.ts` - Audit logging
- `middleware/security-headers.ts` - Security headers
- `middleware/auth-middleware.ts` - Authentication middleware
- `lib/security/threat-intelligence.ts` - Threat detection
- `tests/security/` - Security test suite

## Security Checklist

- [ ] Input validation on all endpoints
- [ ] SQL injection prevention
- [ ] XSS protection
- [ ] CSRF protection
- [ ] Rate limiting implemented
- [ ] Security headers configured
- [ ] Encryption at rest and in transit
- [ ] Secrets management system
- [ ] Audit logging enabled
- [ ] Security monitoring active
- [ ] Regular security scans
- [ ] Incident response plan

## Compliance Requirements

- [ ] GDPR compliance
- [ ] PCI DSS if handling payments
- [ ] SOC 2 Type II controls
- [ ] OWASP Top 10 addressed
- [ ] Data retention policies
- [ ] Privacy policy implemented
- [ ] Cookie consent management

## Testing Requirements

- [ ] Penetration testing
- [ ] OWASP ZAP scanning
- [ ] Dependency vulnerability scanning
- [ ] Security regression tests
- [ ] Authentication tests
- [ ] Authorization tests
- [ ] Encryption tests
- [ ] Rate limit tests

## Definition of Done

- [ ] Code complete and committed
- [ ] Security measures implemented
- [ ] Penetration test passed
- [ ] Security scan clean
- [ ] Audit logging functional
- [ ] Documentation complete
- [ ] Security review completed
- [ ] Team security training done
