# Story 6.1: Automated Deployment Pipeline

## User Story

As a DevOps engineer,
I want an automated deployment pipeline to production,
So that releases are consistent, tested, and can be rolled back if needed.

## Size & Priority

- **Size**: L (8 hours)
- **Priority**: P0 - Critical
- **Sprint**: 6
- **Dependencies**: Task 2.1 (CI/CD setup)

## Description

Implement a complete automated deployment pipeline with staging environment, automated testing, blue-green deployment strategy, monitoring integration, and rollback capabilities.

## Implementation Steps

1. **Vercel deployment configuration**

   ```json
   // vercel.json
   {
     "framework": "nextjs",
     "buildCommand": "npm run build",
     "devCommand": "npm run dev",
     "installCommand": "npm install",
     "regions": ["iad1"],
     "functions": {
       "app/api/**/*": {
         "maxDuration": 30
       },
       "app/api/generate/**/*": {
         "maxDuration": 60
       }
     },
     "env": {
       "NEXT_PUBLIC_SUPABASE_URL": "@supabase-url",
       "NEXT_PUBLIC_SUPABASE_ANON_KEY": "@supabase-anon-key"
     },
     "build": {
       "env": {
         "SUPABASE_SERVICE_ROLE_KEY": "@supabase-service-key",
         "OPENAI_API_KEY": "@openai-api-key"
       }
     },
     "headers": [
       {
         "source": "/api/(.*)",
         "headers": [
           {
             "key": "Cache-Control",
             "value": "no-store, max-age=0"
           }
         ]
       },
       {
         "source": "/(.*)",
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
           }
         ]
       }
     ],
     "rewrites": [
       {
         "source": "/api/health",
         "destination": "/api/monitoring/health"
       }
     ]
   }
   ```

2. **GitHub Actions deployment workflow**

   ```yaml
   # .github/workflows/deploy.yml
   name: Deploy to Production

   on:
     push:
       branches: [main]
     workflow_dispatch:
       inputs:
         environment:
           description: 'Deployment environment'
           required: true
           default: 'production'
           type: choice
           options:
             - staging
             - production

   jobs:
     test:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3

         - name: Setup Node.js
           uses: actions/setup-node@v3
           with:
             node-version: '20'
             cache: 'npm'

         - name: Install dependencies
           run: npm ci

         - name: Run tests
           run: npm run test:ci
           env:
             DATABASE_URL: ${{ secrets.DATABASE_URL_TEST }}

         - name: Run E2E tests
           run: npm run test:e2e
           env:
             NEXT_PUBLIC_APP_URL: http://localhost:3000

         - name: Upload test coverage
           uses: codecov/codecov-action@v3
           with:
             token: ${{ secrets.CODECOV_TOKEN }}

     security-scan:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3

         - name: Run security audit
           run: npm audit --audit-level=moderate

         - name: Run Snyk security scan
           uses: snyk/actions/node@master
           env:
             SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}

         - name: SonarCloud Scan
           uses: SonarSource/sonarcloud-github-action@master
           env:
             GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
             SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}

     deploy-staging:
       needs: [test, security-scan]
       runs-on: ubuntu-latest
       if: github.event.inputs.environment != 'production'
       environment:
         name: staging
         url: https://staging.contentmax.app

       steps:
         - uses: actions/checkout@v3

         - name: Deploy to Vercel Staging
           uses: amondnet/vercel-action@v20
           with:
             vercel-token: ${{ secrets.VERCEL_TOKEN }}
             vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
             vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
             vercel-args: '--prod --env=staging'
             alias-domains: staging.contentmax.app

         - name: Run smoke tests
           run: |
             npm run test:smoke
           env:
             TEST_URL: https://staging.contentmax.app

         - name: Notify deployment
           uses: 8398a7/action-slack@v3
           with:
             status: ${{ job.status }}
             text: 'Staging deployment completed'
             webhook_url: ${{ secrets.SLACK_WEBHOOK }}

     deploy-production:
       needs: [test, security-scan]
       runs-on: ubuntu-latest
       if: github.ref == 'refs/heads/main' && github.event_name == 'push'
       environment:
         name: production
         url: https://contentmax.app

       steps:
         - uses: actions/checkout@v3

         - name: Create deployment
           uses: actions/github-script@v6
           id: deployment
           with:
             script: |
               const deployment = await github.rest.repos.createDeployment({
                 owner: context.repo.owner,
                 repo: context.repo.repo,
                 ref: context.sha,
                 environment: 'production',
                 required_contexts: [],
                 auto_merge: false
               });
               return deployment.data.id;

         - name: Deploy to Vercel Production
           uses: amondnet/vercel-action@v20
           id: vercel-deploy
           with:
             vercel-token: ${{ secrets.VERCEL_TOKEN }}
             vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
             vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
             vercel-args: '--prod'

         - name: Update deployment status
           uses: actions/github-script@v6
           with:
             script: |
               await github.rest.repos.createDeploymentStatus({
                 owner: context.repo.owner,
                 repo: context.repo.repo,
                 deployment_id: ${{ steps.deployment.outputs.result }},
                 state: 'success',
                 environment_url: '${{ steps.vercel-deploy.outputs.url }}',
                 description: 'Deployment completed successfully'
               });

         - name: Purge CDN cache
           run: |
             curl -X POST "https://api.cloudflare.com/client/v4/zones/${{ secrets.CF_ZONE_ID }}/purge_cache" \
               -H "Authorization: Bearer ${{ secrets.CF_API_TOKEN }}" \
               -H "Content-Type: application/json" \
               --data '{"purge_everything":true}'

         - name: Run production smoke tests
           run: npm run test:smoke
           env:
             TEST_URL: https://contentmax.app

         - name: Create Sentry release
           uses: getsentry/action-release@v1
           env:
             SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
             SENTRY_ORG: ${{ secrets.SENTRY_ORG }}
             SENTRY_PROJECT: ${{ secrets.SENTRY_PROJECT }}
           with:
             environment: production
             version: ${{ github.sha }}
   ```

3. **Blue-green deployment strategy**

   ```typescript
   // scripts/blue-green-deploy.ts
   import { exec } from 'child_process';
   import { promisify } from 'util';

   const execAsync = promisify(exec);

   interface DeploymentConfig {
     projectId: string;
     token: string;
     environment: 'staging' | 'production';
   }

   class BlueGreenDeployment {
     private config: DeploymentConfig;
     private vercelClient: VercelClient;

     constructor(config: DeploymentConfig) {
       this.config = config;
       this.vercelClient = new VercelClient(config.token);
     }

     async deploy(): Promise<DeploymentResult> {
       console.log('Starting blue-green deployment...');

       try {
         // 1. Deploy to green environment
         const greenDeployment = await this.deployToGreen();
         console.log(`Green deployment created: ${greenDeployment.url}`);

         // 2. Run health checks
         await this.runHealthChecks(greenDeployment.url);
         console.log('Health checks passed');

         // 3. Run smoke tests
         await this.runSmokeTests(greenDeployment.url);
         console.log('Smoke tests passed');

         // 4. Gradual traffic shift
         await this.shiftTraffic(greenDeployment);
         console.log('Traffic shift initiated');

         // 5. Monitor for errors
         const monitoring = await this.monitorDeployment(greenDeployment, 300000); // 5 minutes

         if (monitoring.errorRate > 0.01) {
           console.error('High error rate detected, rolling back...');
           await this.rollback();
           throw new Error('Deployment rolled back due to high error rate');
         }

         // 6. Complete deployment
         await this.promoteToProduction(greenDeployment);
         console.log('Deployment completed successfully');

         return {
           success: true,
           deployment: greenDeployment,
           metrics: monitoring,
         };
       } catch (error) {
         console.error('Deployment failed:', error);
         await this.rollback();
         throw error;
       }
     }

     private async deployToGreen(): Promise<Deployment> {
       const deployment = await this.vercelClient.createDeployment({
         name: `green-${Date.now()}`,
         target: 'production',
         meta: {
           type: 'blue-green',
           stage: 'green',
         },
       });

       // Wait for deployment to be ready
       await this.waitForDeployment(deployment.id);

       return deployment;
     }

     private async runHealthChecks(url: string): Promise<void> {
       const checks = [
         this.checkEndpoint(`${url}/api/health`),
         this.checkEndpoint(`${url}/api/health/db`),
         this.checkEndpoint(`${url}/api/health/services`),
       ];

       const results = await Promise.all(checks);

       if (results.some((r) => !r.healthy)) {
         throw new Error('Health checks failed');
       }
     }

     private async checkEndpoint(url: string): Promise<HealthCheckResult> {
       try {
         const response = await fetch(url);
         const data = await response.json();

         return {
           healthy: response.status === 200 && data.status === 'healthy',
           endpoint: url,
           responseTime: data.responseTime,
         };
       } catch (error) {
         return {
           healthy: false,
           endpoint: url,
           error: error.message,
         };
       }
     }

     private async runSmokeTests(url: string): Promise<void> {
       const { stdout, stderr } = await execAsync(`npm run test:smoke -- --url=${url}`);

       if (stderr) {
         throw new Error(`Smoke tests failed: ${stderr}`);
       }
     }

     private async shiftTraffic(deployment: Deployment): Promise<void> {
       // Gradual traffic shift: 10% -> 25% -> 50% -> 100%
       const shifts = [10, 25, 50, 100];

       for (const percentage of shifts) {
         await this.vercelClient.updateTrafficSplit({
           deploymentId: deployment.id,
           percentage,
         });

         // Wait and monitor
         await this.wait(60000); // 1 minute between shifts

         const metrics = await this.getMetrics(deployment.id);
         if (metrics.errorRate > 0.02) {
           throw new Error(`High error rate at ${percentage}% traffic`);
         }
       }
     }

     private async monitorDeployment(
       deployment: Deployment,
       duration: number
     ): Promise<DeploymentMetrics> {
       const startTime = Date.now();
       const metrics: DeploymentMetrics = {
         errorRate: 0,
         responseTime: [],
         requests: 0,
         errors: [],
       };

       while (Date.now() - startTime < duration) {
         const currentMetrics = await this.getMetrics(deployment.id);

         metrics.requests += currentMetrics.requests;
         metrics.responseTime.push(currentMetrics.avgResponseTime);

         if (currentMetrics.errors > 0) {
           metrics.errors.push(...currentMetrics.errorDetails);
         }

         await this.wait(10000); // Check every 10 seconds
       }

       metrics.errorRate = metrics.errors.length / metrics.requests;
       return metrics;
     }

     private async rollback(): Promise<void> {
       console.log('Initiating rollback...');

       // Get previous stable deployment
       const previousDeployment = await this.vercelClient.getPreviousDeployment();

       // Redirect all traffic back
       await this.vercelClient.updateTrafficSplit({
         deploymentId: previousDeployment.id,
         percentage: 100,
       });

       // Mark current as failed
       await this.vercelClient.markDeploymentFailed(this.currentDeploymentId);

       console.log('Rollback completed');
     }
   }
   ```

4. **Monitoring and alerting integration**

   ```typescript
   // lib/monitoring/deployment-monitor.ts
   import * as Sentry from '@sentry/nextjs';

   class DeploymentMonitor {
     private metrics: MetricsCollector;
     private alerts: AlertManager;

     constructor() {
       this.metrics = new MetricsCollector();
       this.alerts = new AlertManager();
     }

     async startMonitoring(deploymentId: string) {
       // Set up Sentry
       Sentry.init({
         dsn: process.env.SENTRY_DSN,
         environment: process.env.NODE_ENV,
         release: deploymentId,
         tracesSampleRate: 0.1,
         beforeSend: (event, hint) => {
           // Filter out non-critical errors
           if (event.level === 'warning') return null;
           return event;
         },
       });

       // Start collecting metrics
       this.startMetricsCollection(deploymentId);

       // Set up alert rules
       this.setupAlertRules(deploymentId);
     }

     private startMetricsCollection(deploymentId: string) {
       // Collect performance metrics
       setInterval(async () => {
         const metrics = await this.collectMetrics();

         // Send to monitoring service
         await this.sendToDatadog(metrics);
         await this.sendToNewRelic(metrics);

         // Check thresholds
         this.checkThresholds(metrics);
       }, 30000); // Every 30 seconds
     }

     private async collectMetrics(): Promise<SystemMetrics> {
       return {
         cpu: await this.getCPUUsage(),
         memory: await this.getMemoryUsage(),
         responseTime: await this.getAverageResponseTime(),
         errorRate: await this.getErrorRate(),
         throughput: await this.getThroughput(),
         activeConnections: await this.getActiveConnections(),
       };
     }

     private setupAlertRules(deploymentId: string) {
       this.alerts.addRule({
         name: 'High Error Rate',
         condition: (metrics) => metrics.errorRate > 0.01,
         action: async () => {
           await this.notifyTeam('High error rate detected', 'critical');
           await this.triggerRollback(deploymentId);
         },
       });

       this.alerts.addRule({
         name: 'High Response Time',
         condition: (metrics) => metrics.responseTime > 3000,
         action: async () => {
           await this.notifyTeam('High response time detected', 'warning');
         },
       });

       this.alerts.addRule({
         name: 'Memory Leak',
         condition: (metrics) => metrics.memory.percentage > 90,
         action: async () => {
           await this.notifyTeam('Potential memory leak', 'warning');
           await this.restartInstances();
         },
       });
     }

     private async notifyTeam(message: string, severity: 'info' | 'warning' | 'critical') {
       // Slack notification
       await this.sendSlackNotification({
         channel: '#deployments',
         text: message,
         severity,
       });

       // PagerDuty for critical issues
       if (severity === 'critical') {
         await this.triggerPagerDuty(message);
       }

       // Email notification
       await this.sendEmailNotification({
         to: 'dev-team@contentmax.app',
         subject: `Deployment Alert: ${message}`,
         severity,
       });
     }
   }
   ```

5. **Database migration automation**

   ```typescript
   // scripts/migrate-database.ts
   import { createClient } from '@supabase/supabase-js';
   import { readdir, readFile } from 'fs/promises';
   import { join } from 'path';

   class DatabaseMigration {
     private supabase: SupabaseClient;
     private migrationsPath = './supabase/migrations';

     constructor() {
       this.supabase = createClient(
         process.env.SUPABASE_URL!,
         process.env.SUPABASE_SERVICE_ROLE_KEY!
       );
     }

     async migrate(environment: 'staging' | 'production') {
       console.log(`Running migrations for ${environment}...`);

       try {
         // 1. Create backup
         const backupId = await this.createBackup();
         console.log(`Backup created: ${backupId}`);

         // 2. Get pending migrations
         const pending = await this.getPendingMigrations();

         if (pending.length === 0) {
           console.log('No pending migrations');
           return;
         }

         console.log(`Found ${pending.length} pending migrations`);

         // 3. Run migrations
         for (const migration of pending) {
           await this.runMigration(migration);
         }

         // 4. Verify migrations
         await this.verifyMigrations();

         console.log('Migrations completed successfully');
       } catch (error) {
         console.error('Migration failed:', error);
         await this.rollbackMigrations();
         throw error;
       }
     }

     private async getPendingMigrations(): Promise<Migration[]> {
       // Get all migration files
       const files = await readdir(this.migrationsPath);
       const migrationFiles = files.filter((f) => f.endsWith('.sql')).sort();

       // Get applied migrations from database
       const { data: applied } = await this.supabase.from('schema_migrations').select('filename');

       const appliedSet = new Set(applied?.map((a) => a.filename) || []);

       // Find pending migrations
       const pending = migrationFiles.filter((f) => !appliedSet.has(f));

       return Promise.all(
         pending.map(async (filename) => ({
           filename,
           sql: await readFile(join(this.migrationsPath, filename), 'utf-8'),
         }))
       );
     }

     private async runMigration(migration: Migration) {
       console.log(`Running migration: ${migration.filename}`);

       const transaction = await this.supabase.rpc('begin_transaction');

       try {
         // Run migration SQL
         const { error } = await this.supabase.rpc('execute_sql', {
           sql: migration.sql,
         });

         if (error) throw error;

         // Record migration
         await this.supabase.from('schema_migrations').insert({
           filename: migration.filename,
           applied_at: new Date().toISOString(),
         });

         await this.supabase.rpc('commit_transaction');
         console.log(`Migration completed: ${migration.filename}`);
       } catch (error) {
         await this.supabase.rpc('rollback_transaction');
         throw error;
       }
     }

     private async createBackup(): Promise<string> {
       const { data } = await this.supabase.rpc('create_backup', {
         name: `pre-migration-${Date.now()}`,
       });

       return data.id;
     }

     private async rollbackMigrations() {
       console.log('Rolling back migrations...');
       const { data } = await this.supabase.rpc('restore_latest_backup');
       console.log('Rollback completed');
     }
   }

   // Run migration on deployment
   if (require.main === module) {
     const environment = process.env.ENVIRONMENT as 'staging' | 'production';
     const migration = new DatabaseMigration();

     migration
       .migrate(environment)
       .then(() => process.exit(0))
       .catch(() => process.exit(1));
   }
   ```

## Files to Create

- `.github/workflows/deploy.yml` - Main deployment workflow
- `.github/workflows/rollback.yml` - Rollback workflow
- `vercel.json` - Vercel configuration
- `scripts/blue-green-deploy.ts` - Blue-green deployment script
- `scripts/migrate-database.ts` - Database migration script
- `scripts/health-check.ts` - Health check script
- `lib/monitoring/deployment-monitor.ts` - Monitoring integration
- `lib/deployment/rollback-manager.ts` - Rollback logic
- `tests/smoke/` - Smoke test suite

## Acceptance Criteria

- [ ] Automated deployment on main branch push
- [ ] Staging environment deployment
- [ ] Blue-green deployment strategy
- [ ] Automated rollback on failures
- [ ] Database migration automation
- [ ] Health checks before promotion
- [ ] Monitoring and alerting setup
- [ ] Zero-downtime deployments

## Security Requirements

- [ ] Secrets managed through GitHub Secrets
- [ ] Environment-specific configurations
- [ ] Security scanning in pipeline
- [ ] Dependency vulnerability checks
- [ ] SSL/TLS enforcement
- [ ] API key rotation support

## Testing Requirements

- [ ] Unit tests pass before deployment
- [ ] Integration tests in staging
- [ ] Smoke tests after deployment
- [ ] Load testing for production
- [ ] Rollback testing
- [ ] Disaster recovery testing

## Definition of Done

- [ ] Code complete and committed
- [ ] CI/CD pipeline configured
- [ ] Deployments automated
- [ ] Monitoring integrated
- [ ] Rollback tested
- [ ] Documentation complete
- [ ] Security review completed
- [ ] Team trained on procedures
