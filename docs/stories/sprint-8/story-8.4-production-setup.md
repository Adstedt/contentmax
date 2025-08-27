# Story 8.4: Production Environment Setup

## User Story
As a DevOps engineer,
I want to properly configure and secure the production environment,
So that ContentMax can run reliably, securely, and efficiently in production.

## Size & Priority
- **Size**: M (6 hours)
- **Priority**: P0 - Critical
- **Sprint**: 8
- **Dependencies**: Testing complete

## Description
Configure a robust production environment with proper security, monitoring, backup strategies, and performance optimizations for the ContentMax platform using Vercel and Supabase.

## Implementation Steps

1. **Vercel production configuration**
   ```typescript
   // vercel.json
   {
     "framework": "nextjs",
     "buildCommand": "npm run build",
     "outputDirectory": ".next",
     "devCommand": "npm run dev",
     "installCommand": "npm install",
     "regions": ["iad1", "sfo1", "cdg1"],
     "functions": {
       "app/api/generate/route.ts": {
         "maxDuration": 60
       },
       "app/api/scrape/route.ts": {
         "maxDuration": 30
       },
       "app/api/bulk/route.ts": {
         "maxDuration": 300
       }
     },
     "headers": [
       {
         "source": "/api/(.*)",
         "headers": [
           {
             "key": "X-Content-Type-Options",
             "value": "nosniff"
           },
           {
             "key": "X-Frame-Options",
             "value": "DENY"
           },
           {
             "key": "X-XSS-Protection",
             "value": "1; mode=block"
           },
           {
             "key": "Referrer-Policy",
             "value": "strict-origin-when-cross-origin"
           }
         ]
       }
     ],
     "redirects": [
       {
         "source": "/home",
         "destination": "/",
         "permanent": true
       }
     ],
     "env": {
       "NODE_ENV": "production",
       "NEXT_PUBLIC_APP_URL": "https://contentmax.ai",
       "NEXT_PUBLIC_API_URL": "https://api.contentmax.ai"
     },
     "crons": [
       {
         "path": "/api/cron/cleanup",
         "schedule": "0 2 * * *"
       },
       {
         "path": "/api/cron/backup",
         "schedule": "0 */6 * * *"
       }
     ]
   }
   ```

2. **Environment variable management**
   ```typescript
   // lib/config/environment.ts
   import { z } from 'zod';

   const envSchema = z.object({
     // Application
     NODE_ENV: z.enum(['development', 'test', 'production']),
     NEXT_PUBLIC_APP_URL: z.string().url(),
     NEXT_PUBLIC_API_URL: z.string().url(),
     
     // Supabase
     NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
     NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string(),
     SUPABASE_SERVICE_ROLE_KEY: z.string(),
     SUPABASE_JWT_SECRET: z.string(),
     
     // OpenAI
     OPENAI_API_KEY: z.string(),
     OPENAI_ORG_ID: z.string().optional(),
     
     // Google
     GOOGLE_CLIENT_ID: z.string(),
     GOOGLE_CLIENT_SECRET: z.string(),
     GSC_PROPERTY_ID: z.string(),
     
     // Stripe
     STRIPE_SECRET_KEY: z.string(),
     STRIPE_WEBHOOK_SECRET: z.string(),
     NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string(),
     
     // Email
     RESEND_API_KEY: z.string(),
     EMAIL_FROM: z.string().email(),
     
     // Security
     ENCRYPTION_KEY: z.string().length(32),
     JWT_SECRET: z.string(),
     SESSION_SECRET: z.string(),
     
     // Monitoring
     SENTRY_DSN: z.string().optional(),
     DATADOG_API_KEY: z.string().optional(),
     NEW_RELIC_LICENSE_KEY: z.string().optional(),
     
     // Feature flags
     ENABLE_BETA_FEATURES: z.boolean().default(false),
     MAINTENANCE_MODE: z.boolean().default(false),
     
     // Rate limiting
     RATE_LIMIT_REQUESTS: z.number().default(100),
     RATE_LIMIT_WINDOW_MS: z.number().default(60000),
     
     // CDN
     CDN_URL: z.string().url().optional(),
     CLOUDFLARE_API_TOKEN: z.string().optional(),
   });

   export type Environment = z.infer<typeof envSchema>;

   class EnvironmentManager {
     private static instance: EnvironmentManager;
     private env: Environment;
     
     private constructor() {
       this.validateAndLoad();
     }
     
     static getInstance(): EnvironmentManager {
       if (!EnvironmentManager.instance) {
         EnvironmentManager.instance = new EnvironmentManager();
       }
       return EnvironmentManager.instance;
     }
     
     private validateAndLoad() {
       try {
         this.env = envSchema.parse(process.env);
       } catch (error) {
         console.error('Environment validation failed:', error);
         
         // In production, fail fast
         if (process.env.NODE_ENV === 'production') {
           throw new Error('Invalid environment configuration');
         }
       }
     }
     
     get(key: keyof Environment): any {
       return this.env[key];
     }
     
     getAll(): Environment {
       return this.env;
     }
     
     isProduction(): boolean {
       return this.env.NODE_ENV === 'production';
     }
     
     isDevelopment(): boolean {
       return this.env.NODE_ENV === 'development';
     }
     
     isTest(): boolean {
       return this.env.NODE_ENV === 'test';
     }
   }

   export const env = EnvironmentManager.getInstance();
   ```

3. **Security configuration**
   ```typescript
   // lib/security/security-config.ts
   import helmet from 'helmet';
   import rateLimit from 'express-rate-limit';
   import { createHash } from 'crypto';
   
   export class SecurityConfig {
     static getHelmetConfig() {
       return {
         contentSecurityPolicy: {
           directives: {
             defaultSrc: ["'self'"],
             scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.vercel-insights.com"],
             styleSrc: ["'self'", "'unsafe-inline'"],
             imgSrc: ["'self'", "data:", "https:", "blob:"],
             fontSrc: ["'self'", "data:"],
             connectSrc: [
               "'self'",
               process.env.NEXT_PUBLIC_SUPABASE_URL,
               "https://api.openai.com",
               "https://www.googleapis.com"
             ],
             frameSrc: ["'none'"],
             objectSrc: ["'none'"],
             upgradeInsecureRequests: []
           }
         },
         crossOriginEmbedderPolicy: true,
         crossOriginOpenerPolicy: true,
         crossOriginResourcePolicy: { policy: "cross-origin" },
         dnsPrefetchControl: true,
         frameguard: { action: 'deny' },
         hidePoweredBy: true,
         hsts: {
           maxAge: 31536000,
           includeSubDomains: true,
           preload: true
         },
         ieNoOpen: true,
         noSniff: true,
         originAgentCluster: true,
         permittedCrossDomainPolicies: false,
         referrerPolicy: { policy: "strict-origin-when-cross-origin" },
         xssFilter: true
       };
     }
     
     static getRateLimitConfig() {
       return {
         windowMs: env.get('RATE_LIMIT_WINDOW_MS'),
         max: env.get('RATE_LIMIT_REQUESTS'),
         standardHeaders: true,
         legacyHeaders: false,
         handler: (req, res) => {
           res.status(429).json({
             error: 'Too many requests',
             retryAfter: res.getHeader('Retry-After')
           });
         }
       };
     }
     
     static generateApiKey(): string {
       const randomBytes = require('crypto').randomBytes(32);
       return randomBytes.toString('hex');
     }
     
     static hashPassword(password: string): string {
       const salt = process.env.SESSION_SECRET;
       return createHash('sha256')
         .update(password + salt)
         .digest('hex');
     }
     
     static validateApiKey(key: string): boolean {
       // Implement API key validation logic
       return true;
     }
   }
   
   // middleware/security.ts
   import { NextRequest, NextResponse } from 'next/server';
   
   export async function securityMiddleware(request: NextRequest) {
     const response = NextResponse.next();
     
     // Security headers
     response.headers.set('X-Content-Type-Options', 'nosniff');
     response.headers.set('X-Frame-Options', 'DENY');
     response.headers.set('X-XSS-Protection', '1; mode=block');
     response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
     response.headers.set(
       'Strict-Transport-Security',
       'max-age=31536000; includeSubDomains; preload'
     );
     
     // CORS configuration for API routes
     if (request.nextUrl.pathname.startsWith('/api/')) {
       response.headers.set('Access-Control-Allow-Origin', env.get('NEXT_PUBLIC_APP_URL'));
       response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
       response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
       response.headers.set('Access-Control-Max-Age', '86400');
     }
     
     return response;
   }
   ```

4. **Database production setup**
   ```sql
   -- supabase/migrations/production-setup.sql
   
   -- Performance indexes
   CREATE INDEX CONCURRENTLY idx_content_user_created 
     ON content(user_id, created_at DESC);
   
   CREATE INDEX CONCURRENTLY idx_content_status 
     ON content(status) WHERE status != 'archived';
   
   CREATE INDEX CONCURRENTLY idx_taxonomy_parent 
     ON taxonomy_nodes(parent_id);
   
   CREATE INDEX CONCURRENTLY idx_templates_active 
     ON templates(is_active) WHERE is_active = true;
   
   -- Partitioning for large tables
   CREATE TABLE content_archive (
     LIKE content INCLUDING ALL
   ) PARTITION BY RANGE (created_at);
   
   CREATE TABLE content_archive_2024_q1 PARTITION OF content_archive
     FOR VALUES FROM ('2024-01-01') TO ('2024-04-01');
   
   CREATE TABLE content_archive_2024_q2 PARTITION OF content_archive
     FOR VALUES FROM ('2024-04-01') TO ('2024-07-01');
   
   -- Row Level Security policies
   ALTER TABLE content ENABLE ROW LEVEL SECURITY;
   
   CREATE POLICY "Users can view own content"
     ON content FOR SELECT
     USING (auth.uid() = user_id);
   
   CREATE POLICY "Users can insert own content"
     ON content FOR INSERT
     WITH CHECK (auth.uid() = user_id);
   
   CREATE POLICY "Users can update own content"
     ON content FOR UPDATE
     USING (auth.uid() = user_id)
     WITH CHECK (auth.uid() = user_id);
   
   -- Automated maintenance
   CREATE EXTENSION IF NOT EXISTS pg_cron;
   
   -- Daily vacuum and analyze
   SELECT cron.schedule(
     'daily-vacuum',
     '0 2 * * *',
     'VACUUM ANALYZE content, taxonomy_nodes, templates;'
   );
   
   -- Weekly reindex
   SELECT cron.schedule(
     'weekly-reindex',
     '0 3 * * 0',
     'REINDEX TABLE CONCURRENTLY content;'
   );
   
   -- Archive old content monthly
   SELECT cron.schedule(
     'monthly-archive',
     '0 4 1 * *',
     $$
     INSERT INTO content_archive 
     SELECT * FROM content 
     WHERE created_at < NOW() - INTERVAL '6 months'
     AND status = 'published';
     
     DELETE FROM content 
     WHERE created_at < NOW() - INTERVAL '6 months'
     AND status = 'published';
     $$
   );
   ```

5. **Monitoring and alerting setup**
   ```typescript
   // lib/monitoring/monitoring-setup.ts
   import * as Sentry from '@sentry/nextjs';
   import { StatsD } from 'node-statsd';
   
   export class MonitoringSetup {
     private static statsd: StatsD;
     
     static initializeSentry() {
       if (env.isProduction()) {
         Sentry.init({
           dsn: env.get('SENTRY_DSN'),
           environment: env.get('NODE_ENV'),
           tracesSampleRate: 0.1,
           profilesSampleRate: 0.1,
           integrations: [
             new Sentry.BrowserTracing(),
             new Sentry.Replay({
               maskAllText: false,
               blockAllMedia: false,
             }),
           ],
           beforeSend(event, hint) {
             // Filter out sensitive data
             if (event.request?.cookies) {
               delete event.request.cookies;
             }
             if (event.request?.headers) {
               delete event.request.headers.authorization;
             }
             return event;
           },
         });
       }
     }
     
     static initializeMetrics() {
       this.statsd = new StatsD({
         host: 'localhost',
         port: 8125,
         prefix: 'contentmax.',
         cacheDns: true,
       });
     }
     
     static trackMetric(name: string, value: number, tags?: string[]) {
       if (this.statsd) {
         this.statsd.gauge(name, value, tags);
       }
     }
     
     static trackTiming(name: string, duration: number, tags?: string[]) {
       if (this.statsd) {
         this.statsd.timing(name, duration, tags);
       }
     }
     
     static captureError(error: Error, context?: any) {
       console.error('Error captured:', error);
       
       if (env.isProduction()) {
         Sentry.captureException(error, {
           extra: context,
         });
       }
     }
     
     static createHealthCheck() {
       return async (req: Request): Promise<Response> => {
         const checks = {
           app: 'healthy',
           database: 'unknown',
           redis: 'unknown',
           openai: 'unknown',
         };
         
         try {
           // Check database
           const { data, error } = await supabase
             .from('health_check')
             .select('status')
             .single();
           checks.database = error ? 'unhealthy' : 'healthy';
           
           // Check OpenAI
           const openaiResponse = await fetch('https://api.openai.com/v1/models', {
             headers: {
               'Authorization': `Bearer ${env.get('OPENAI_API_KEY')}`,
             },
           });
           checks.openai = openaiResponse.ok ? 'healthy' : 'unhealthy';
           
         } catch (error) {
           this.captureError(error as Error);
         }
         
         const allHealthy = Object.values(checks).every(status => status === 'healthy');
         
         return new Response(JSON.stringify({
           status: allHealthy ? 'healthy' : 'degraded',
           checks,
           timestamp: new Date().toISOString(),
         }), {
           status: allHealthy ? 200 : 503,
           headers: {
             'Content-Type': 'application/json',
           },
         });
       };
     }
   }
   
   // lib/monitoring/performance-monitoring.ts
   export class PerformanceMonitor {
     private static marks: Map<string, number> = new Map();
     
     static mark(name: string) {
       this.marks.set(name, performance.now());
     }
     
     static measure(name: string, startMark: string, endMark?: string) {
       const start = this.marks.get(startMark);
       const end = endMark ? this.marks.get(endMark) : performance.now();
       
       if (start && end) {
         const duration = end - start;
         
         MonitoringSetup.trackTiming(`performance.${name}`, duration);
         
         if (duration > 1000) {
           console.warn(`Performance warning: ${name} took ${duration}ms`);
         }
         
         return duration;
       }
       
       return 0;
     }
     
     static async trackAsyncOperation<T>(
       name: string,
       operation: () => Promise<T>
     ): Promise<T> {
       const start = performance.now();
       
       try {
         const result = await operation();
         const duration = performance.now() - start;
         
         MonitoringSetup.trackTiming(`async.${name}`, duration);
         
         return result;
       } catch (error) {
         MonitoringSetup.captureError(error as Error, { operation: name });
         throw error;
       }
     }
   }
   ```

6. **Backup and disaster recovery**
   ```typescript
   // lib/backup/backup-manager.ts
   import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
   import { createReadStream } from 'fs';
   import { pipeline } from 'stream/promises';
   
   export class BackupManager {
     private s3Client: S3Client;
     private bucketName: string = 'contentmax-backups';
     
     constructor() {
       this.s3Client = new S3Client({
         region: 'us-east-1',
         credentials: {
           accessKeyId: env.get('AWS_ACCESS_KEY_ID'),
           secretAccessKey: env.get('AWS_SECRET_ACCESS_KEY'),
         },
       });
     }
     
     async performDatabaseBackup(): Promise<void> {
       const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
       const backupName = `db-backup-${timestamp}.sql`;
       
       try {
         // Export database using Supabase CLI
         const { exec } = require('child_process');
         const { promisify } = require('util');
         const execAsync = promisify(exec);
         
         await execAsync(
           `supabase db dump --project-ref ${env.get('SUPABASE_PROJECT_REF')} > /tmp/${backupName}`
         );
         
         // Upload to S3
         const fileStream = createReadStream(`/tmp/${backupName}`);
         
         await this.s3Client.send(
           new PutObjectCommand({
             Bucket: this.bucketName,
             Key: `database/${backupName}`,
             Body: fileStream,
             ServerSideEncryption: 'AES256',
             StorageClass: 'GLACIER_IR',
           })
         );
         
         // Clean up local file
         const { unlink } = require('fs/promises');
         await unlink(`/tmp/${backupName}`);
         
         console.log(`Database backup completed: ${backupName}`);
       } catch (error) {
         MonitoringSetup.captureError(error as Error, {
           operation: 'database_backup',
         });
         throw error;
       }
     }
     
     async performStorageBackup(): Promise<void> {
       // Backup Supabase Storage buckets
       const buckets = ['user-uploads', 'generated-content', 'templates'];
       
       for (const bucket of buckets) {
         await this.backupStorageBucket(bucket);
       }
     }
     
     private async backupStorageBucket(bucketName: string): Promise<void> {
       const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
       
       try {
         // List all files in bucket
         const { data: files } = await supabase.storage
           .from(bucketName)
           .list('', { limit: 1000 });
         
         if (!files) return;
         
         for (const file of files) {
           // Download file from Supabase
           const { data } = await supabase.storage
             .from(bucketName)
             .download(file.name);
           
           if (data) {
             // Upload to S3 backup
             await this.s3Client.send(
               new PutObjectCommand({
                 Bucket: this.bucketName,
                 Key: `storage/${bucketName}/${timestamp}/${file.name}`,
                 Body: data,
                 ServerSideEncryption: 'AES256',
               })
             );
           }
         }
         
         console.log(`Storage backup completed for bucket: ${bucketName}`);
       } catch (error) {
         MonitoringSetup.captureError(error as Error, {
           operation: 'storage_backup',
           bucket: bucketName,
         });
       }
     }
     
     async testRestore(backupName: string): Promise<boolean> {
       // Test restoration process in staging environment
       try {
         // Download backup from S3
         const backup = await this.downloadBackup(backupName);
         
         // Restore to staging database
         const success = await this.restoreToStaging(backup);
         
         // Verify data integrity
         const isValid = await this.verifyDataIntegrity();
         
         return success && isValid;
       } catch (error) {
         MonitoringSetup.captureError(error as Error, {
           operation: 'test_restore',
           backup: backupName,
         });
         return false;
       }
     }
   }
   
   // api/cron/backup/route.ts
   export async function GET() {
     const backupManager = new BackupManager();
     
     try {
       await backupManager.performDatabaseBackup();
       await backupManager.performStorageBackup();
       
       return Response.json({
         success: true,
         timestamp: new Date().toISOString(),
       });
     } catch (error) {
       return Response.json({
         success: false,
         error: error.message,
       }, { status: 500 });
     }
   }
   ```

7. **CDN and caching configuration**
   ```typescript
   // lib/cdn/cdn-config.ts
   export class CDNConfig {
     static getCloudflareConfig() {
       return {
         zone_id: env.get('CLOUDFLARE_ZONE_ID'),
         api_token: env.get('CLOUDFLARE_API_TOKEN'),
         cache_rules: [
           {
             match: '/static/*',
             cache_level: 'aggressive',
             edge_ttl: 2678400, // 31 days
             browser_ttl: 86400, // 1 day
           },
           {
             match: '/_next/static/*',
             cache_level: 'aggressive',
             edge_ttl: 31536000, // 1 year
             browser_ttl: 31536000,
           },
           {
             match: '/api/*',
             cache_level: 'bypass',
           },
           {
             match: '/images/*',
             cache_level: 'standard',
             edge_ttl: 604800, // 7 days
             browser_ttl: 86400,
             polish: 'lossless',
             webp: true,
           },
         ],
         security_rules: [
           {
             description: 'Block suspicious user agents',
             expression: '(http.user_agent contains "bot" and not http.user_agent contains "googlebot")',
             action: 'challenge',
           },
           {
             description: 'Rate limit API endpoints',
             expression: 'http.request.uri.path contains "/api/"',
             action: 'rate_limit',
             rate_limit: {
               requests_per_period: 100,
               period: 60,
             },
           },
         ],
         page_rules: [
           {
             target: 'contentmax.ai/*',
             actions: {
               always_use_https: true,
               automatic_https_rewrites: true,
               ssl: 'full_strict',
               security_level: 'high',
               browser_cache_ttl: 14400,
             },
           },
         ],
       };
     }
     
     static async purgeCache(urls?: string[]) {
       const response = await fetch(
         `https://api.cloudflare.com/client/v4/zones/${env.get('CLOUDFLARE_ZONE_ID')}/purge_cache`,
         {
           method: 'POST',
           headers: {
             'Authorization': `Bearer ${env.get('CLOUDFLARE_API_TOKEN')}`,
             'Content-Type': 'application/json',
           },
           body: JSON.stringify({
             files: urls || [],
             purge_everything: !urls,
           }),
         }
       );
       
       return response.json();
     }
   }
   ```

## Files to Create

- `vercel.json` - Vercel production configuration
- `lib/config/environment.ts` - Environment variable management
- `lib/security/security-config.ts` - Security configuration
- `middleware/security.ts` - Security middleware
- `supabase/migrations/production-setup.sql` - Database production setup
- `lib/monitoring/monitoring-setup.ts` - Monitoring configuration
- `lib/monitoring/performance-monitoring.ts` - Performance tracking
- `lib/backup/backup-manager.ts` - Backup system
- `api/cron/backup/route.ts` - Backup cron job
- `lib/cdn/cdn-config.ts` - CDN configuration
- `scripts/deploy-production.sh` - Deployment script
- `docs/production-runbook.md` - Production operations guide

## Production Checklist

### Pre-deployment
- [ ] All environment variables configured
- [ ] SSL certificates provisioned
- [ ] Domain DNS configured
- [ ] Database migrations tested
- [ ] Security audit completed
- [ ] Load testing performed
- [ ] Backup strategy tested
- [ ] Monitoring alerts configured

### Deployment
- [ ] Database backup created
- [ ] Blue-green deployment setup
- [ ] Health checks passing
- [ ] Smoke tests passing
- [ ] CDN cache purged
- [ ] SSL verification complete

### Post-deployment
- [ ] Application metrics normal
- [ ] Error rates acceptable
- [ ] Response times within SLA
- [ ] All integrations working
- [ ] Backup verification complete
- [ ] Team notified of deployment

## Acceptance Criteria

- [ ] Production environment configured
- [ ] Security measures implemented
- [ ] Monitoring and alerting active
- [ ] Backup system operational
- [ ] CDN properly configured
- [ ] Health checks passing
- [ ] Performance optimized
- [ ] Documentation complete

## Testing Requirements

- [ ] Security penetration testing
- [ ] Load testing (1000+ concurrent users)
- [ ] Backup restoration test
- [ ] Failover testing
- [ ] CDN cache testing
- [ ] SSL certificate validation
- [ ] Environment variable validation
- [ ] Monitoring alert testing

## Definition of Done

- [ ] Production environment live
- [ ] All security measures active
- [ ] Monitoring dashboards configured
- [ ] Backup automation running
- [ ] CDN serving static assets
- [ ] Health endpoints responding
- [ ] Performance metrics acceptable
- [ ] Runbook documentation complete