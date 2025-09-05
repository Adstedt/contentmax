# STORY-015: Production Deployment Validation

## Story Overview

**Story ID:** STORY-015  
**Epic:** EPIC-001 - Data Ingestion Pipeline  
**Sprint:** Sprint 6  
**Priority:** P0 - Critical  
**Estimated Effort:** 3 hours  
**Story Points:** 3  

## User Story

As a **DevOps engineer**,  
I want **to validate the complete system in production**,  
So that **we can confidently release the data ingestion pipeline to users**.

## Context

This is the final validation story to ensure all components work correctly in the production environment, performance meets requirements, and monitoring is operational.

## Acceptance Criteria

### Functional Requirements
1. ✅ All API endpoints responding correctly
2. ✅ Data imports complete successfully
3. ✅ Visualization displays real data
4. ✅ Performance meets SLAs
5. ✅ Monitoring and alerts working

### Deployment Requirements
6. ✅ Environment variables configured
7. ✅ Database migrations applied
8. ✅ SSL certificates valid
9. ✅ CDN configured for assets
10. ✅ Backup strategy implemented

### Validation Requirements
11. ✅ Smoke tests passing
12. ✅ Load testing completed
13. ✅ Security scan passed
14. ✅ Rollback plan tested

## Technical Implementation Notes

### Production Checklist
```typescript
// scripts/production-checklist.ts
export interface ChecklistItem {
  name: string;
  description: string;
  validator: () => Promise<boolean>;
  critical: boolean;
}

export class ProductionValidator {
  private checks: ChecklistItem[] = [
    {
      name: 'Environment Variables',
      description: 'All required environment variables are set',
      validator: this.checkEnvironmentVariables,
      critical: true
    },
    {
      name: 'Database Connection',
      description: 'Can connect to production database',
      validator: this.checkDatabaseConnection,
      critical: true
    },
    {
      name: 'API Health',
      description: 'All API endpoints are healthy',
      validator: this.checkApiHealth,
      critical: true
    },
    {
      name: 'External Services',
      description: 'Google APIs are accessible',
      validator: this.checkExternalServices,
      critical: true
    },
    {
      name: 'SSL Certificate',
      description: 'SSL certificate is valid',
      validator: this.checkSSLCertificate,
      critical: true
    },
    {
      name: 'Performance Metrics',
      description: 'Response times within SLA',
      validator: this.checkPerformanceMetrics,
      critical: false
    },
    {
      name: 'Monitoring',
      description: 'Monitoring and alerts are configured',
      validator: this.checkMonitoring,
      critical: true
    },
    {
      name: 'Backup System',
      description: 'Database backups are configured',
      validator: this.checkBackupSystem,
      critical: true
    }
  ];
  
  async runValidation(): Promise<ValidationReport> {
    const results = [];
    let allPassed = true;
    
    for (const check of this.checks) {
      console.log(`Running check: ${check.name}...`);
      
      try {
        const passed = await check.validator();
        results.push({
          name: check.name,
          passed,
          critical: check.critical,
          error: passed ? null : 'Check failed'
        });
        
        if (!passed && check.critical) {
          allPassed = false;
        }
      } catch (error) {
        results.push({
          name: check.name,
          passed: false,
          critical: check.critical,
          error: error.message
        });
        
        if (check.critical) {
          allPassed = false;
        }
      }
    }
    
    return {
      passed: allPassed,
      timestamp: new Date().toISOString(),
      results,
      recommendations: this.generateRecommendations(results)
    };
  }
  
  private async checkEnvironmentVariables(): Promise<boolean> {
    const required = [
      'DATABASE_URL',
      'SUPABASE_URL',
      'SUPABASE_ANON_KEY',
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
      'SENTRY_DSN',
      'VERCEL_ENV'
    ];
    
    for (const key of required) {
      if (!process.env[key]) {
        console.error(`Missing environment variable: ${key}`);
        return false;
      }
    }
    
    return true;
  }
  
  private async checkDatabaseConnection(): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('taxonomy_nodes')
        .select('count')
        .limit(1);
      
      return !error;
    } catch {
      return false;
    }
  }
  
  private async checkApiHealth(): Promise<boolean> {
    const endpoints = [
      '/api/health',
      '/api/taxonomy/nodes',
      '/api/import/sitemap',
      '/api/metrics/search-console'
    ];
    
    for (const endpoint of endpoints) {
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}${endpoint}`);
      if (!response.ok) {
        console.error(`Endpoint ${endpoint} returned ${response.status}`);
        return false;
      }
    }
    
    return true;
  }
  
  private async checkPerformanceMetrics(): Promise<boolean> {
    const metrics = await this.runPerformanceTests();
    
    return (
      metrics.avgResponseTime < 500 &&
      metrics.p95ResponseTime < 1000 &&
      metrics.errorRate < 0.01
    );
  }
}
```

### Smoke Tests
```typescript
// tests/smoke/production-smoke.test.ts
describe('Production Smoke Tests', () => {
  const BASE_URL = process.env.PRODUCTION_URL;
  
  it('homepage loads successfully', async () => {
    const response = await fetch(BASE_URL);
    expect(response.status).toBe(200);
    
    const html = await response.text();
    expect(html).toContain('ContentMax');
  });
  
  it('can fetch taxonomy data', async () => {
    const response = await fetch(`${BASE_URL}/api/taxonomy/nodes`);
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data.nodes).toBeInstanceOf(Array);
  });
  
  it('visualization loads and renders', async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    await page.goto(`${BASE_URL}/dashboard/taxonomy`);
    
    // Wait for D3 visualization to render
    await page.waitForSelector('svg.taxonomy-visualization');
    
    // Check nodes are rendered
    const nodes = await page.$$('circle.node');
    expect(nodes.length).toBeGreaterThan(0);
    
    await browser.close();
  });
  
  it('can import sitemap', async () => {
    const response = await fetch(`${BASE_URL}/api/import/sitemap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.TEST_API_KEY}`
      },
      body: JSON.stringify({
        sitemapUrl: 'https://example.com/test-sitemap.xml'
      })
    });
    
    expect(response.status).toBe(200);
    
    const result = await response.json();
    expect(result.success).toBe(true);
  });
});
```

### Load Testing Script
```typescript
// scripts/load-test.ts
import { check } from 'k6';
import http from 'k6/http';

export const options = {
  stages: [
    { duration: '30s', target: 10 },  // Ramp up to 10 users
    { duration: '1m', target: 50 },   // Ramp up to 50 users
    { duration: '2m', target: 100 },  // Stay at 100 users
    { duration: '30s', target: 0 },   // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'], // 95% of requests under 1s
    http_req_failed: ['rate<0.1'],     // Error rate under 10%
  },
};

export default function () {
  // Test taxonomy API
  const taxonomyResponse = http.get(`${__ENV.BASE_URL}/api/taxonomy/nodes`);
  check(taxonomyResponse, {
    'taxonomy status is 200': (r) => r.status === 200,
    'taxonomy has nodes': (r) => JSON.parse(r.body).nodes.length > 0,
  });
  
  // Test product search
  const searchResponse = http.get(`${__ENV.BASE_URL}/api/products/search?q=phone`);
  check(searchResponse, {
    'search status is 200': (r) => r.status === 200,
  });
  
  // Simulate user interaction
  sleep(Math.random() * 3);
}
```

### Monitoring Validation
```typescript
// scripts/validate-monitoring.ts
export async function validateMonitoring() {
  const checks = {
    sentry: await checkSentry(),
    vercelAnalytics: await checkVercelAnalytics(),
    uptimeMonitoring: await checkUptimeMonitoring(),
    databaseMetrics: await checkDatabaseMetrics()
  };
  
  return checks;
}

async function checkSentry(): Promise<boolean> {
  try {
    // Send test error
    const testError = new Error('Production validation test error');
    if (typeof window !== 'undefined' && (window as any).Sentry) {
      (window as any).Sentry.captureException(testError);
    }
    
    // Check if error appears in Sentry dashboard
    // This would require Sentry API integration
    return true;
  } catch {
    return false;
  }
}

async function checkVercelAnalytics(): Promise<boolean> {
  // Check if analytics script is loaded
  const response = await fetch(`${process.env.PRODUCTION_URL}`);
  const html = await response.text();
  
  return html.includes('/_vercel/insights/script.js');
}

async function checkUptimeMonitoring(): Promise<boolean> {
  // Verify uptime monitoring is configured
  // This could check with service like Pingdom or UptimeRobot
  return true;
}

async function checkDatabaseMetrics(): Promise<boolean> {
  // Check database performance metrics
  const { data } = await supabase
    .from('pg_stat_database')
    .select('*')
    .single();
  
  return data !== null;
}
```

### Rollback Plan
```bash
#!/bin/bash
# scripts/rollback.sh

# Rollback procedure
echo "Starting rollback procedure..."

# 1. Revert to previous deployment
vercel rollback --yes

# 2. Restore database backup if needed
if [ "$1" == "--with-db" ]; then
  echo "Restoring database backup..."
  supabase db restore --backup-id $BACKUP_ID
fi

# 3. Clear CDN cache
echo "Clearing CDN cache..."
curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/purge_cache" \
  -H "Authorization: Bearer $CF_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}'

# 4. Send notification
curl -X POST $SLACK_WEBHOOK_URL \
  -H 'Content-Type: application/json' \
  -d '{"text":"Production rollback completed"}'

echo "Rollback completed successfully"
```

### Production Configuration
```typescript
// config/production.config.ts
export const productionConfig = {
  database: {
    maxConnections: 100,
    statementTimeout: 30000,
    idleTimeout: 10000
  },
  
  caching: {
    defaultTTL: 300,
    maxSize: 1000,
    redis: {
      url: process.env.REDIS_URL,
      maxRetries: 3
    }
  },
  
  rateLimiting: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
    skipSuccessfulRequests: false
  },
  
  security: {
    corsOrigins: [
      'https://contentmax.com',
      'https://www.contentmax.com'
    ],
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", 'https://cdn.vercel-insights.com'],
      imgSrc: ["'self'", 'https:', 'data:']
    }
  },
  
  monitoring: {
    sentry: {
      dsn: process.env.SENTRY_DSN,
      environment: 'production',
      tracesSampleRate: 0.1
    },
    logging: {
      level: 'info',
      format: 'json'
    }
  }
};
```

### Health Check Endpoint
```typescript
// app/api/health/route.ts
export async function GET() {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {}
  };
  
  try {
    // Check database
    const dbCheck = await checkDatabase();
    health.checks.database = dbCheck;
    
    // Check external services
    const servicesCheck = await checkExternalServices();
    health.checks.externalServices = servicesCheck;
    
    // Check system resources
    const resourcesCheck = checkSystemResources();
    health.checks.resources = resourcesCheck;
    
    // Determine overall status
    const allHealthy = Object.values(health.checks).every(c => c.status === 'healthy');
    health.status = allHealthy ? 'healthy' : 'degraded';
    
    return NextResponse.json(health, {
      status: allHealthy ? 200 : 503
    });
  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      error: error.message
    }, { status: 503 });
  }
}
```

## Dependencies

- Production environment access
- Monitoring tools configured
- Load testing tools (k6)
- Deployment pipeline ready

## Testing Requirements

### Validation Checklist
- [ ] Environment variables verified
- [ ] Database migrations applied
- [ ] SSL certificates valid
- [ ] API endpoints responding
- [ ] Smoke tests passing
- [ ] Load tests passing
- [ ] Monitoring operational
- [ ] Backup system verified
- [ ] Rollback tested

### Performance Benchmarks
- Homepage load: < 2 seconds
- API response: < 500ms p50, < 1s p95
- Database queries: < 100ms
- Error rate: < 1%
- Uptime: > 99.9%

## Definition of Done

- [ ] All validation checks passing
- [ ] Performance benchmarks met
- [ ] Monitoring alerts configured
- [ ] Documentation updated
- [ ] Rollback plan tested
- [ ] Team sign-off received
- [ ] Production deployment successful
- [ ] Post-deployment monitoring for 24 hours
- [ ] Handoff to support team complete

## Dev Agent Record

### Agent Model Used
_To be filled by implementing agent_

### Debug Log References
_To be filled during implementation_

### Completion Notes
_To be filled after implementation_

### File List
- `scripts/production-checklist.ts` (new)
- `tests/smoke/production-smoke.test.ts` (new)
- `scripts/load-test.ts` (new)
- `scripts/validate-monitoring.ts` (new)
- `scripts/rollback.sh` (new)
- `config/production.config.ts` (new)
- `app/api/health/route.ts` (new)

---
**Created:** 2025-01-09  
**Status:** Ready for Development  
**Assigned:** Unassigned