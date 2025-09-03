# TASK-019: Documentation Package

## Overview

**Priority**: P2 - Important  
**Estimate**: 5 hours  
**Owner**: Technical Writer / Full Stack Developer  
**Dependencies**: All features complete  
**Status**: Not Started

## Problem Statement

We need comprehensive documentation for developers, users, and administrators. This includes API documentation, user guides, deployment instructions, and architecture documentation to ensure the platform is maintainable and usable.

## Technical Requirements

### 1. API Documentation with OpenAPI

#### File: `docs/api/openapi.yaml`

```yaml
openapi: 3.1.0
info:
  title: ContentMax API
  description: Revenue optimization platform API for content taxonomy analysis
  version: 1.0.0
  contact:
    name: ContentMax Support
    email: support@contentmax.io
    url: https://contentmax.io/support
  license:
    name: MIT
    url: https://opensource.org/licenses/MIT

servers:
  - url: https://api.contentmax.io
    description: Production server
  - url: https://staging-api.contentmax.io
    description: Staging server
  - url: http://localhost:3000
    description: Development server

tags:
  - name: Authentication
    description: User authentication endpoints
  - name: Projects
    description: Project management
  - name: Nodes
    description: Taxonomy node operations
  - name: Opportunities
    description: Opportunity scoring and insights
  - name: Metrics
    description: Performance metrics
  - name: Jobs
    description: Background job management

paths:
  /api/auth/login:
    post:
      tags: [Authentication]
      summary: User login
      description: Authenticate user and receive access token
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [email, password]
              properties:
                email:
                  type: string
                  format: email
                  example: user@example.com
                password:
                  type: string
                  format: password
                  minLength: 8
      responses:
        '200':
          description: Successfully authenticated
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AuthResponse'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '429':
          $ref: '#/components/responses/RateLimited'

  /api/projects:
    get:
      tags: [Projects]
      summary: List projects
      description: Get all projects for the authenticated user
      security:
        - bearerAuth: []
      parameters:
        - $ref: '#/components/parameters/PageLimit'
        - $ref: '#/components/parameters/PageOffset'
      responses:
        '200':
          description: List of projects
          content:
            application/json:
              schema:
                type: object
                properties:
                  projects:
                    type: array
                    items:
                      $ref: '#/components/schemas/Project'
                  pagination:
                    $ref: '#/components/schemas/Pagination'
        '401':
          $ref: '#/components/responses/Unauthorized'

  /api/projects/{projectId}/nodes:
    get:
      tags: [Nodes]
      summary: Get project nodes
      description: Retrieve all taxonomy nodes for a project
      security:
        - bearerAuth: []
      parameters:
        - $ref: '#/components/parameters/ProjectId'
        - name: depth
          in: query
          schema:
            type: integer
            minimum: 0
            maximum: 10
          description: Filter nodes by depth level
      responses:
        '200':
          description: List of nodes
          content:
            application/json:
              schema:
                type: object
                properties:
                  nodes:
                    type: array
                    items:
                      $ref: '#/components/schemas/TaxonomyNode'
                  total:
                    type: integer
        '404':
          $ref: '#/components/responses/NotFound'

  /api/insights/opportunities:
    get:
      tags: [Opportunities]
      summary: Get opportunities
      description: Retrieve scored opportunities with filtering and sorting
      security:
        - bearerAuth: []
      parameters:
        - $ref: '#/components/parameters/ProjectId'
        - name: minScore
          in: query
          schema:
            type: integer
            minimum: 0
            maximum: 100
          description: Minimum opportunity score
        - name: sortBy
          in: query
          schema:
            type: string
            enum: [score, revenue, volume, position]
          description: Sort field
        - name: sortOrder
          in: query
          schema:
            type: string
            enum: [asc, desc]
            default: desc
      responses:
        '200':
          description: List of opportunities
          content:
            application/json:
              schema:
                type: object
                properties:
                  opportunities:
                    type: array
                    items:
                      $ref: '#/components/schemas/Opportunity'
                  stats:
                    $ref: '#/components/schemas/OpportunityStats'

  /api/jobs/{jobId}:
    get:
      tags: [Jobs]
      summary: Get job status
      description: Check the status of a background processing job
      security:
        - bearerAuth: []
      parameters:
        - $ref: '#/components/parameters/JobId'
      responses:
        '200':
          description: Job status
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Job'
        '404':
          $ref: '#/components/responses/NotFound'

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  parameters:
    ProjectId:
      name: projectId
      in: path
      required: true
      schema:
        type: string
        format: uuid
      description: Project UUID

    JobId:
      name: jobId
      in: path
      required: true
      schema:
        type: string
        format: uuid
      description: Job UUID

    PageLimit:
      name: limit
      in: query
      schema:
        type: integer
        minimum: 1
        maximum: 100
        default: 20
      description: Number of items per page

    PageOffset:
      name: offset
      in: query
      schema:
        type: integer
        minimum: 0
        default: 0
      description: Number of items to skip

  schemas:
    AuthResponse:
      type: object
      properties:
        accessToken:
          type: string
        refreshToken:
          type: string
        user:
          $ref: '#/components/schemas/User'
        expiresIn:
          type: integer
          description: Token expiry in seconds

    User:
      type: object
      properties:
        id:
          type: string
          format: uuid
        email:
          type: string
          format: email
        name:
          type: string
        role:
          type: string
          enum: [admin, user]
        createdAt:
          type: string
          format: date-time

    Project:
      type: object
      properties:
        id:
          type: string
          format: uuid
        name:
          type: string
        domain:
          type: string
          format: hostname
        nodeCount:
          type: integer
        lastSync:
          type: string
          format: date-time
        status:
          type: string
          enum: [active, paused, archived]

    TaxonomyNode:
      type: object
      properties:
        id:
          type: string
          format: uuid
        url:
          type: string
          format: uri
        title:
          type: string
        depth:
          type: integer
        parentId:
          type: string
          format: uuid
          nullable: true
        metrics:
          $ref: '#/components/schemas/NodeMetrics'

    NodeMetrics:
      type: object
      properties:
        impressions:
          type: integer
        clicks:
          type: integer
        ctr:
          type: number
          format: float
        position:
          type: number
          format: float
        revenue:
          type: number
          format: float

    Opportunity:
      type: object
      properties:
        id:
          type: string
          format: uuid
        nodeId:
          type: string
          format: uuid
        score:
          type: integer
          minimum: 0
          maximum: 100
        factors:
          type: object
          properties:
            searchVolume:
              type: number
            ctrGap:
              type: number
            positionPotential:
              type: number
            competition:
              type: number
            revenueImpact:
              type: number
        projections:
          type: object
          properties:
            targetPosition:
              type: integer
            projectedTraffic:
              type: integer
            projectedRevenue:
              type: number
        recommendations:
          type: array
          items:
            $ref: '#/components/schemas/Recommendation'

    Recommendation:
      type: object
      properties:
        type:
          type: string
          enum: [ctr, position, content, technical]
        priority:
          type: string
          enum: [critical, high, medium, low]
        action:
          type: string
        impact:
          type: string
        effort:
          type: string
          enum: [low, medium, high]

    Job:
      type: object
      properties:
        id:
          type: string
          format: uuid
        type:
          type: string
          enum: [scoring, revenue, full_analysis]
        status:
          type: string
          enum: [pending, processing, completed, failed]
        progress:
          type: integer
          minimum: 0
          maximum: 100
        totalItems:
          type: integer
        processedItems:
          type: integer
        errors:
          type: array
          items:
            type: object
            properties:
              nodeId:
                type: string
              error:
                type: string
              timestamp:
                type: string
                format: date-time

    OpportunityStats:
      type: object
      properties:
        totalOpportunities:
          type: integer
        averageScore:
          type: number
        totalPotentialRevenue:
          type: number
        topScoreRange:
          type: object
          properties:
            min:
              type: number
            max:
              type: number

    Pagination:
      type: object
      properties:
        total:
          type: integer
        limit:
          type: integer
        offset:
          type: integer
        hasMore:
          type: boolean

    Error:
      type: object
      properties:
        error:
          type: object
          properties:
            message:
              type: string
            code:
              type: string
            statusCode:
              type: integer
            timestamp:
              type: string
              format: date-time
            requestId:
              type: string
              format: uuid

  responses:
    Unauthorized:
      description: Authentication required
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'

    NotFound:
      description: Resource not found
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'

    RateLimited:
      description: Too many requests
      headers:
        X-RateLimit-Limit:
          schema:
            type: integer
          description: Request limit per hour
        X-RateLimit-Remaining:
          schema:
            type: integer
          description: Remaining requests
        X-RateLimit-Reset:
          schema:
            type: integer
          description: Reset timestamp
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
```

### 2. User Guide

#### File: `docs/USER_GUIDE.md`

```markdown
# ContentMax User Guide

## Table of Contents

1. [Getting Started](#getting-started)
2. [Dashboard Overview](#dashboard-overview)
3. [Managing Projects](#managing-projects)
4. [Understanding Opportunities](#understanding-opportunities)
5. [Visualization Features](#visualization-features)
6. [Recommendations](#recommendations)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

## Getting Started

### System Requirements

- Modern web browser (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)
- Minimum screen resolution: 1280x720
- Stable internet connection

### First Login

1. Navigate to [https://contentmax.io](https://contentmax.io)
2. Click "Sign In" in the top right
3. Enter your credentials provided by your administrator
4. Complete two-factor authentication if enabled

### Initial Setup

After logging in for the first time:

1. **Create Your First Project**
   - Click "New Project" button
   - Enter your website domain
   - Choose data source (Sitemap, Shopify, or Manual)
   - Click "Create Project"

2. **Connect Data Sources**
   - Navigate to Project Settings
   - Connect Google Search Console
   - Connect Google Analytics 4
   - Authorize access to your properties

3. **Import Taxonomy**
   - Go to Data Import section
   - Upload sitemap XML or CSV
   - Review imported structure
   - Click "Start Import"

## Dashboard Overview

The dashboard provides a high-level view of your content performance:

### Key Metrics

- **Total Opportunities**: Number of pages with optimization potential
- **Average Score**: Overall health score (0-100)
- **Potential Revenue**: Estimated revenue increase from optimizations
- **Top Performers**: Your best-performing pages

### Quick Actions

- View top opportunities
- Run new analysis
- Export reports
- Access settings

## Managing Projects

### Creating Projects

1. Click "New Project" from dashboard
2. Fill in project details:
   - Project Name
   - Domain URL
   - Industry/Category
   - Target Audience
3. Select data sources
4. Configure import settings
5. Click "Create Project"

### Project Settings

Access project settings to:

- Update project information
- Manage team members
- Configure data sources
- Set up automated syncing
- Delete project

### Data Synchronization

ContentMax automatically syncs data daily. Manual sync:

1. Go to project dashboard
2. Click "Sync Now" button
3. Select data sources to update
4. Monitor progress in activity log

## Understanding Opportunities

### Opportunity Scoring

Each page receives a score (0-100) based on:

- **Search Volume (25%)**: Traffic potential
- **CTR Gap (30%)**: Difference from expected CTR
- **Position Potential (20%)**: Room for ranking improvement
- **Competition (10%)**: Keyword difficulty
- **Revenue Impact (15%)**: Monetization potential

### Score Interpretation

- **80-100**: High Priority - Quick wins with significant impact
- **60-79**: Medium Priority - Good opportunities worth pursuing
- **40-59**: Low Priority - Consider if resources allow
- **0-39**: Monitor - May not be worth immediate action

### Filtering Opportunities

Use filters to find specific opportunities:

- Minimum score threshold
- Position range (e.g., positions 4-10)
- Minimum search volume
- Page depth level
- Parent category

## Visualization Features

### Taxonomy Tree View

The interactive visualization shows your site structure:

#### Navigation

- **Zoom**: Scroll or pinch to zoom
- **Pan**: Click and drag to move
- **Select**: Click node to view details
- **Expand/Collapse**: Double-click to toggle children

#### Visual Indicators

- **Node Size**: Represents traffic/importance
- **Color Coding**:
  - 🟢 Green: High opportunity (score 70+)
  - 🟡 Yellow: Medium opportunity (score 40-69)
  - 🔴 Red: Low opportunity (score <40)
  - ⚫ Gray: No data available

#### Controls

- **Filter by Score**: Show only high-value opportunities
- **Filter by Depth**: Focus on specific hierarchy levels
- **Search**: Find specific pages quickly
- **Export**: Download visualization as image

### Performance Metrics

#### Available Metrics

- Impressions
- Clicks
- CTR (Click-through rate)
- Average Position
- Sessions
- Revenue
- Conversion Rate

#### Time Periods

- Last 7 days
- Last 30 days
- Last 90 days
- Custom date range

## Recommendations

### Understanding Recommendations

Each opportunity includes specific recommendations:

#### Recommendation Types

1. **Meta Optimization**: Title and description improvements
2. **Content Expansion**: Add depth and coverage
3. **Technical SEO**: Fix technical issues
4. **Internal Linking**: Improve site structure
5. **Schema Markup**: Add structured data

#### Priority Levels

- 🔴 **Critical**: Address immediately
- 🟠 **High**: Schedule within 2 weeks
- 🟡 **Medium**: Plan for next month
- 🟢 **Low**: Consider for future

### Implementing Recommendations

#### Step-by-Step Process

1. Review recommendation details
2. Understand the impact estimate
3. Check effort required
4. Follow provided action steps
5. Use provided resources/tools
6. Track implementation status

#### Tracking Progress

- Mark recommendations as "In Progress"
- Update status when completed
- Monitor metrics for improvement
- Document results

## Best Practices

### Data Quality

- Ensure GSC and GA4 are properly configured
- Verify tracking codes on all pages
- Regular data audits
- Fix tracking gaps promptly

### Optimization Workflow

1. **Weekly Reviews**: Check new opportunities
2. **Prioritization**: Focus on high-score, low-effort items
3. **Batch Updates**: Group similar optimizations
4. **Testing**: A/B test major changes
5. **Documentation**: Track what works

### Team Collaboration

- Share projects with team members
- Assign opportunities to specialists
- Use comments for communication
- Regular team reviews

## Troubleshooting

### Common Issues

#### No Data Showing

- Verify data source connections
- Check date range selection
- Ensure proper permissions
- Wait 24-48 hours after setup

#### Import Failures

- Check file format (XML, CSV)
- Verify file size (<10MB)
- Ensure valid URLs
- Remove special characters

#### Sync Errors

- Re-authenticate data sources
- Check API quotas
- Verify domain ownership
- Contact support if persistent

### Getting Help

#### Self-Service Resources

- Knowledge Base: [docs.contentmax.io](https://docs.contentmax.io)
- Video Tutorials: [youtube.com/contentmax](https://youtube.com/contentmax)
- Community Forum: [community.contentmax.io](https://community.contentmax.io)

#### Support Channels

- Email: support@contentmax.io
- Live Chat: Available 9 AM - 5 PM EST
- Priority Support: For Pro/Enterprise plans

### FAQs

**Q: How often does data sync?**
A: Automatically daily at 2 AM EST. Manual sync available anytime.

**Q: Can I export data?**
A: Yes, export to CSV, Excel, or PDF from any table view.

**Q: What's the maximum number of nodes?**
A: Free: 1,000 | Pro: 10,000 | Enterprise: Unlimited

**Q: How accurate are revenue projections?**
A: Based on industry benchmarks with 70-80% typical accuracy.

**Q: Can I white-label the platform?**
A: Available for Enterprise plans. Contact sales.
```

### 3. Developer Documentation

#### File: `docs/DEVELOPER_GUIDE.md`

```markdown
# ContentMax Developer Guide

## Architecture Overview

### Technology Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: PostgreSQL (Supabase)
- **Visualization**: D3.js v7
- **Styling**: Tailwind CSS, shadcn/ui
- **State**: React Query, Zustand
- **Testing**: Jest, Playwright
- **Deployment**: Vercel

### Project Structure
```

contentmax/
├── app/ # Next.js 14 app directory
│ ├── api/ # API routes
│ ├── (auth)/ # Auth pages
│ └── (dashboard)/ # Dashboard pages
├── components/ # React components
│ ├── ui/ # Base UI components
│ ├── taxonomy/ # Taxonomy visualization
│ └── charts/ # Data visualizations
├── lib/ # Core libraries
│ ├── api/ # API clients
│ ├── scoring/ # Opportunity scoring
│ └── utils/ # Utilities
├── hooks/ # Custom React hooks
├── prisma/ # Database schema
└── public/ # Static assets

````

## Development Setup

### Prerequisites
- Node.js 20.x or higher
- pnpm 8.x or higher
- PostgreSQL 15.x
- Git

### Local Development

1. **Clone Repository**
```bash
git clone https://github.com/contentmax/contentmax.git
cd contentmax
````

2. **Install Dependencies**

```bash
pnpm install
```

3. **Environment Setup**

```bash
cp .env.example .env.local
# Edit .env.local with your credentials
```

4. **Database Setup**

```bash
# Start PostgreSQL locally or use Supabase
pnpm db:migrate
pnpm db:seed
```

5. **Start Development Server**

```bash
pnpm dev
# Open http://localhost:3000
```

## API Integration

### Authentication

All API requests require authentication:

```typescript
const response = await fetch('/api/projects', {
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  },
});
```

### Rate Limiting

- 100 requests per minute per user
- 429 status code when exceeded
- Retry-After header indicates wait time

### Error Handling

```typescript
try {
  const response = await fetch('/api/opportunities');

  if (!response.ok) {
    const error = await response.json();
    throw new APIError(error.message, response.status);
  }

  const data = await response.json();
  return data;
} catch (error) {
  // Handle error appropriately
  console.error('API Error:', error);
}
```

## Key Components

### OpportunityScorer

Core scoring algorithm implementation:

```typescript
import { OpportunityScorer } from '@/lib/scoring/opportunity-scorer';

const scorer = new OpportunityScorer();
const score = await scorer.calculateScore(node);
```

### TaxonomyVisualization

D3.js force-directed graph:

```typescript
import { TaxonomyVisualization } from '@/components/taxonomy';

<TaxonomyVisualization
  nodes={nodes}
  onNodeClick={handleNodeClick}
  filters={filters}
/>
```

### Data Fetching with React Query

```typescript
import { useProjectNodes } from '@/lib/react-query/queries';

function MyComponent() {
  const { data, isLoading, error } = useProjectNodes(projectId);

  if (isLoading) return <Loading />;
  if (error) return <Error error={error} />;

  return <NodeList nodes={data} />;
}
```

## Testing

### Unit Tests

```bash
pnpm test:unit
# Or with coverage
pnpm test:coverage
```

### Integration Tests

```bash
pnpm test:integration
```

### E2E Tests

```bash
pnpm test:e2e
# Or specific test
pnpm test:e2e -- --grep "login"
```

### Writing Tests

```typescript
// Unit test example
describe('OpportunityScorer', () => {
  it('should calculate score correctly', () => {
    const scorer = new OpportunityScorer();
    const result = scorer.calculateScore(mockNode);
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});

// E2E test example
test('user can view opportunities', async ({ page }) => {
  await page.goto('/opportunities');
  await expect(page.locator('h1')).toContainText('Opportunities');
  await expect(page.locator('[data-testid="opportunity-list"]')).toBeVisible();
});
```

## Deployment

### Environment Variables

Required environment variables:

```env
# Database
DATABASE_URL=postgresql://...

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Google APIs
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Analytics
NEXT_PUBLIC_GA4_PROPERTY_ID=...
NEXT_PUBLIC_POSTHOG_KEY=...

# Monitoring
NEXT_PUBLIC_SENTRY_DSN=...
```

### Vercel Deployment

```bash
# Install Vercel CLI
pnpm i -g vercel

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

### Database Migrations

```bash
# Create migration
pnpm db:migrate:dev

# Deploy migration
pnpm db:migrate:prod

# Rollback
pnpm db:migrate:rollback
```

## Performance Optimization

### Code Splitting

Components are lazy-loaded:

```typescript
const HeavyComponent = dynamic(
  () => import('@/components/HeavyComponent'),
  {
    loading: () => <Skeleton />,
    ssr: false
  }
);
```

### Image Optimization

```typescript
import Image from 'next/image';

<Image
  src="/hero.jpg"
  alt="Hero"
  width={1200}
  height={600}
  priority
  placeholder="blur"
/>
```

### Caching Strategy

- Static assets: 1 year cache
- API responses: 5 minutes default
- User data: No cache
- Use React Query for client-side caching

## Security

### Input Validation

All inputs validated with Zod:

```typescript
const schema = z.object({
  email: z.string().email(),
  score: z.number().min(0).max(100),
});

const validated = schema.parse(input);
```

### SQL Injection Prevention

Use Prisma ORM or parameterized queries:

```typescript
// Safe
const user = await prisma.user.findUnique({
  where: { email: userEmail },
});

// Never do this
const user = await db.query(`SELECT * FROM users WHERE email = '${userEmail}'`);
```

### XSS Prevention

- React automatically escapes content
- Use DOMPurify for user-generated HTML
- CSP headers configured

## Troubleshooting

### Common Issues

#### Build Failures

```bash
# Clear cache
rm -rf .next node_modules
pnpm install
pnpm build
```

#### Database Connection

```bash
# Test connection
pnpm db:studio

# Reset database
pnpm db:reset
```

#### Type Errors

```bash
# Regenerate types
pnpm prisma generate
pnpm type-check
```

## Contributing

### Pull Request Process

1. Fork repository
2. Create feature branch
3. Make changes
4. Run tests
5. Submit PR

### Code Style

- ESLint configuration enforced
- Prettier for formatting
- Conventional commits

### Review Process

- Automated CI checks
- Code review required
- Performance impact assessed

## Support

- GitHub Issues: [github.com/contentmax/issues](https://github.com/contentmax/issues)
- Discord: [discord.gg/contentmax](https://discord.gg/contentmax)
- Email: dev@contentmax.io

````

### 4. Deployment Guide

#### File: `docs/DEPLOYMENT_GUIDE.md`

```markdown
# ContentMax Deployment Guide

## Prerequisites

### Required Services
- Vercel account (or similar hosting)
- Supabase project (or PostgreSQL database)
- Google Cloud Console access
- Domain with DNS control
- SSL certificate (auto-provided by Vercel)

### Required Secrets
Gather these before deployment:
- Database connection string
- Supabase project URL and keys
- Google OAuth credentials
- GA4 property ID
- Sentry DSN (optional)
- PostHog API key (optional)

## Deployment Steps

### 1. Database Setup

#### Supabase Setup
1. Create new Supabase project
2. Note connection string from Settings > Database
3. Enable Row Level Security (RLS)
4. Run migrations:

```bash
# Set DATABASE_URL environment variable
export DATABASE_URL="postgresql://..."

# Run migrations
pnpm db:migrate:prod

# Verify
pnpm db:migrate:status
````

#### Custom PostgreSQL

1. Create database:

```sql
CREATE DATABASE contentmax;
CREATE USER contentmax_user WITH ENCRYPTED PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE contentmax TO contentmax_user;
```

2. Run migrations (same as above)

### 2. Environment Configuration

Create production environment file:

```env
# Application
NEXT_PUBLIC_APP_URL=https://contentmax.io
NEXT_PUBLIC_ENV=production

# Database
DATABASE_URL=postgresql://...

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# Authentication
NEXTAUTH_SECRET=generate-with-openssl-rand-base64-32
NEXTAUTH_URL=https://contentmax.io

# Google APIs
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx

# Analytics
NEXT_PUBLIC_GA4_PROPERTY_ID=G-XXXXXXXXXX
NEXT_PUBLIC_POSTHOG_KEY=xxx

# Monitoring
NEXT_PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
SENTRY_AUTH_TOKEN=xxx
```

### 3. Vercel Deployment

#### Via CLI

```bash
# Install Vercel CLI
pnpm i -g vercel

# Login
vercel login

# Deploy
vercel --prod

# Set environment variables
vercel env add DATABASE_URL production
# Repeat for all variables
```

#### Via GitHub Integration

1. Connect GitHub repository to Vercel
2. Configure build settings:
   - Framework Preset: Next.js
   - Build Command: `pnpm build`
   - Output Directory: `.next`
3. Add environment variables in Vercel dashboard
4. Deploy

### 4. Domain Configuration

#### DNS Settings

Add these records to your domain:

```
Type  Name    Value
A     @       76.76.21.21
CNAME www     cname.vercel-dns.com
```

#### Vercel Domain Setup

1. Go to Project Settings > Domains
2. Add domain: `contentmax.io`
3. Add www redirect: `www.contentmax.io`
4. SSL certificate auto-provisions

### 5. Post-Deployment

#### Verify Deployment

```bash
# Health check
curl https://contentmax.io/api/health

# Run smoke tests
pnpm test:smoke --url=https://contentmax.io
```

#### Set Up Monitoring

1. Verify Sentry is receiving events
2. Check PostHog is tracking
3. Set up uptime monitoring (e.g., Pingdom)
4. Configure alerts

#### Database Backups

1. Enable Supabase daily backups
2. Or set up custom backup:

```bash
# Backup script
#!/bin/bash
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql
aws s3 cp backup-*.sql s3://contentmax-backups/
```

### 6. Scaling Considerations

#### Performance

- Enable Vercel Edge Functions for API routes
- Use Vercel KV for caching
- Enable ISR for static pages
- Configure CDN caching rules

#### Database

- Enable connection pooling
- Add read replicas for scaling
- Implement query optimization
- Monitor slow queries

#### Monitoring

- Set up APM (Application Performance Monitoring)
- Configure error budgets
- Implement SLOs/SLAs
- Create runbooks

## Rollback Procedures

### Application Rollback

```bash
# Via Vercel CLI
vercel rollback

# Or via dashboard
# Go to Deployments > Select previous > Promote to Production
```

### Database Rollback

```bash
# Rollback last migration
pnpm db:migrate:rollback

# Restore from backup
psql $DATABASE_URL < backup-20240315.sql
```

## Troubleshooting

### Common Issues

#### Build Failures

- Check Node version (20.x required)
- Verify all environment variables set
- Check build logs in Vercel

#### Database Connection

- Verify DATABASE_URL format
- Check SSL requirements
- Confirm network access

#### Performance Issues

- Enable Vercel Analytics
- Check function execution time
- Review database query performance

## Maintenance

### Regular Tasks

- Weekly: Review error logs
- Monthly: Update dependencies
- Quarterly: Security audit
- Yearly: License review

### Updates

```bash
# Update dependencies
pnpm update

# Test locally
pnpm test

# Deploy to staging first
vercel --target staging

# Then production
vercel --prod
```

## Support

For deployment assistance:

- Documentation: [docs.contentmax.io](https://docs.contentmax.io)
- Support: deploy@contentmax.io
- Emergency: +1-XXX-XXX-XXXX (Enterprise only)

````

## Acceptance Criteria

- [ ] Complete OpenAPI specification for all endpoints
- [ ] User guide covers all features
- [ ] Developer guide includes setup and architecture
- [ ] Deployment guide with step-by-step instructions
- [ ] API documentation auto-generated from OpenAPI
- [ ] In-app help system implemented
- [ ] Video tutorials created
- [ ] Code comments comprehensive
- [ ] README files updated
- [ ] License file included

## Implementation Steps

1. **Hour 1**: OpenAPI specification
2. **Hour 2**: User guide documentation
3. **Hour 3**: Developer guide
4. **Hour 4**: Deployment guide
5. **Hour 5**: In-app help and final review

## Testing

```bash
# Validate OpenAPI spec
swagger-cli validate docs/api/openapi.yaml

# Generate API docs
redoc-cli bundle docs/api/openapi.yaml -o docs/api.html

# Check markdown links
markdown-link-check docs/*.md

# Spell check
cspell "docs/**/*.md"
````

## Notes

- Keep documentation version-synced with code
- Use screenshots and diagrams where helpful
- Maintain changelog for user-facing changes
- Consider documentation translation for international users
