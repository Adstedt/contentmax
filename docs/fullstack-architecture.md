# ContentMax Fullstack Architecture Document

## Introduction

This document outlines the complete fullstack architecture for ContentMax, including backend systems, frontend implementation, and their integration. It serves as the single source of truth for AI-driven development, ensuring consistency across the entire technology stack.

This unified approach combines what would traditionally be separate backend and frontend architecture documents, streamlining the development process for modern fullstack applications where these concerns are increasingly intertwined.

### Starter Template or Existing Project
N/A - Greenfield project with custom architecture optimized for content generation at scale

### Change Log
| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2024-01-26 | 1.0 | Initial fullstack architecture | Winston (Architect) |
| 2024-01-26 | 1.1 | Optimized for 3,000 node visualization | Winston |
| 2024-01-26 | 1.2 | Added resilience patterns and fixes | Winston |

---

## High Level Architecture

### Technical Summary
ContentMax employs a modern Jamstack architecture with Next.js 15 serving both static content and dynamic APIs through serverless functions. The frontend uses React 19 with D3.js for visualization, while the backend leverages Supabase for database, authentication, realtime subscriptions, and storage. Key integration points include OpenAI for content generation, Google Search Console for SEO data, and a sophisticated content scraping system. The entire platform is deployed on Vercel with global CDN distribution, achieving sub-2 second load times while managing 3,000+ taxonomy nodes efficiently.

### Platform and Infrastructure Choice
**Platform:** Vercel + Supabase  
**Key Services:** Vercel (hosting, edge functions), Supabase (PostgreSQL, Auth, Realtime, Storage), OpenAI API, Google Search Console API  
**Deployment Host and Regions:** Vercel Global CDN with automatic region selection, Supabase US-East-1 (primary)

### Repository Structure
**Structure:** Monorepo with shared packages  
**Monorepo Tool:** npm workspaces (built into npm 10+)  
**Package Organization:** apps/web (frontend), apps/api (backend edge functions), packages/shared (types, utils), packages/ui (component library)

### High Level Architecture Diagram

```mermaid
graph TB
    subgraph "Client Layer"
        Browser[Web Browser]
        Mobile[Mobile Browser]
    end
    
    subgraph "CDN/Edge"
        Vercel[Vercel CDN]
        EdgeFunc[Edge Functions]
    end
    
    subgraph "Application Layer"
        NextJS[Next.js 15 App]
        API[API Routes/tRPC]
    end
    
    subgraph "Backend Services"
        Supabase[Supabase Platform]
        Auth[Supabase Auth]
        DB[(PostgreSQL)]
        Realtime[Realtime Subscriptions]
        Storage[Supabase Storage]
    end
    
    subgraph "External Services"
        OpenAI[OpenAI API]
        GSC[Google Search Console]
        Scraper[Content Scraper]
    end
    
    Browser --> Vercel
    Mobile --> Vercel
    Vercel --> NextJS
    NextJS --> API
    API --> Supabase
    API --> EdgeFunc
    EdgeFunc --> OpenAI
    EdgeFunc --> GSC
    EdgeFunc --> Scraper
    Supabase --> Auth
    Supabase --> DB
    Supabase --> Realtime
    Supabase --> Storage
```

### Architectural Patterns
- **Jamstack Architecture:** Static generation with serverless APIs - *Rationale:* Optimal performance and scalability for content-heavy applications
- **Component-Based UI:** Atomic design with React components and TypeScript - *Rationale:* Maintainability and type safety across large codebases
- **Repository Pattern:** Abstract data access logic with Supabase - *Rationale:* Enables testing and future database migration flexibility
- **BFF Pattern:** Backend for Frontend via Next.js API routes - *Rationale:* Optimized data fetching and security boundary
- **Event-Driven Updates:** Realtime subscriptions for collaborative features - *Rationale:* Instant UI updates without polling
- **Circuit Breaker Pattern:** Protect external API calls - *Rationale:* Prevent cascading failures from OpenAI/Google APIs
- **Progressive Enhancement:** Core functionality without JavaScript - *Rationale:* Accessibility and SEO optimization

---

## Tech Stack

### Technology Stack Table

| Category | Technology | Version | Purpose | Rationale |
|----------|------------|---------|---------|-----------|
| Frontend Language | TypeScript | 5.3.3 | Type-safe frontend development | Catches errors at compile time, improves IDE support |
| Frontend Framework | Next.js | 15.0.0 | React framework with SSR/SSG | SEO optimization, performance, developer experience |
| UI Component Library | Radix UI | 1.1.2 | Accessible component primitives | WCAG compliance, customizable, headless |
| State Management | Zustand | 5.0.1 | Client state management | Simple, performant, TypeScript-friendly |
| Backend Language | TypeScript | 5.3.3 | Type-safe backend development | Code sharing with frontend, type safety |
| Backend Framework | Next.js API Routes | 15.0.0 | Serverless API endpoints | Integrated with frontend, automatic deployments |
| API Style | tRPC | 10.45.0 | Type-safe API calls | End-to-end type safety, no code generation |
| Database | PostgreSQL (Supabase) | 15 | Primary data store | ACID compliance, complex queries, proven reliability |
| Cache | Supabase Cache | Built-in | Query result caching | Integrated with database, automatic invalidation |
| File Storage | Supabase Storage | 2.45.4 | Content and asset storage | S3-compatible, integrated auth, CDN |
| Authentication | Supabase Auth | 2.45.4 | User authentication | Built-in providers, Row Level Security |
| Frontend Testing | Vitest | 2.1.5 | Unit and integration tests | Fast, ESM support, Jest compatible |
| Backend Testing | Vitest | 2.1.5 | API and service tests | Same as frontend for consistency |
| E2E Testing | Playwright | 1.49.0 | End-to-end testing | Cross-browser, reliable, fast |
| Build Tool | Vite | 5.0.0 | Development server and bundler | Fast HMR, optimized builds |
| Bundler | Vite/Rollup | 5.0.0 | Production bundling | Tree-shaking, code splitting |
| IaC Tool | Terraform | 1.6.0 | Infrastructure as Code | Declarative, version controlled |
| CI/CD | GitHub Actions | N/A | Continuous integration/deployment | Integrated with GitHub, free for public repos |
| Monitoring | Vercel Analytics | Built-in | Performance and usage monitoring | Zero-config, real user metrics |
| Logging | Supabase Logs | Built-in | Application logging | Integrated, searchable, retained |
| CSS Framework | Tailwind CSS | 3.4.15 | Utility-first CSS | Rapid development, consistent design |
| Visualization | D3.js | 7.9.0 | Taxonomy visualization | Flexible, performant for 3,000 nodes |
| Content Generation | OpenAI API | 4.73.0 | AI content generation | Best-in-class LLM, proven reliability |
| Data Fetching | TanStack Query | 5.59.20 | Server state management | Caching, synchronization, optimistic updates |
| Forms | React Hook Form | 7.54.0 | Form management | Performance, validation, minimal re-renders |
| Validation | Zod | 3.23.8 | Schema validation | TypeScript integration, runtime validation |

---

## Data Models

### User Model
**Purpose:** Represents authenticated users and their organization membership

**Key Attributes:**
- id: UUID - Unique user identifier from Supabase Auth
- email: string - User email address
- name: string - Display name
- org_id: UUID - Associated organization
- role: enum - User role (admin, editor, viewer)
- created_at: timestamp - Account creation date

**TypeScript Interface:**
```typescript
interface User {
  id: string;
  email: string;
  name: string;
  orgId: string;
  role: 'admin' | 'editor' | 'viewer';
  createdAt: Date;
  updatedAt: Date;
}
```

**Relationships:**
- Belongs to one Organization
- Has many ContentItems (as creator)
- Has many ReviewDecisions

### Organization Model
**Purpose:** Multi-tenant organization container

**Key Attributes:**
- id: UUID - Unique organization identifier
- name: string - Organization name
- domain: string - Primary domain
- subscription_tier: enum - Pricing tier
- settings: JSONB - Organization preferences

**TypeScript Interface:**
```typescript
interface Organization {
  id: string;
  name: string;
  domain: string;
  subscriptionTier: 'free' | 'pro' | 'enterprise';
  settings: {
    defaultLanguage: string;
    autoPublish: boolean;
    contentTypes: string[];
  };
  createdAt: Date;
}
```

**Relationships:**
- Has many Users
- Has many TaxonomyNodes
- Has many ContentItems

### TaxonomyNode Model
**Purpose:** Represents a node in the site taxonomy visualization

**Key Attributes:**
- id: UUID - Unique node identifier
- org_id: UUID - Organization owner
- label: string - Display name
- url: string - Page URL
- type: enum - Node type (category, brand, product)
- sku_count: integer - Number of products
- position: JSONB - Cached x,y coordinates
- status: enum - Content status

**TypeScript Interface:**
```typescript
interface TaxonomyNode {
  id: string;
  orgId: string;
  label: string;
  url: string;
  type: 'category' | 'brand' | 'product';
  parentId?: string;
  depth: number;
  skuCount: number;
  position: { x: number; y: number };
  status: 'optimized' | 'outdated' | 'missing' | 'no_products';
  metrics: {
    traffic: number;
    revenue: number;
    searchVolume: number;
  };
  createdAt: Date;
  updatedAt: Date;
}
```

**Relationships:**
- Belongs to Organization
- Has parent TaxonomyNode (hierarchical)
- Has many child TaxonomyNodes
- Has one Content (if generated)
- Has many InternalLinks (as source or target)

### Content Model
**Purpose:** Stores generated and reviewed content

**Key Attributes:**
- id: UUID - Unique content identifier
- node_id: UUID - Associated taxonomy node
- type: enum - Content type
- status: enum - Workflow status
- content_html: text - Generated HTML
- content_components: JSONB - Component structure
- language: string - Content language
- ai_confidence: float - Generation confidence score

**TypeScript Interface:**
```typescript
interface Content {
  id: string;
  nodeId: string;
  orgId: string;
  type: 'category' | 'brand' | 'inspire' | 'engage';
  status: 'draft' | 'pending_review' | 'approved' | 'published';
  title: string;
  metaDescription: string;
  contentHtml: string;
  contentComponents: ContentComponent[];
  language: string;
  aiConfidence: number;
  seoMetrics: {
    score: number;
    issues: string[];
    targetKeyword: string;
  };
  generatedBy: string;
  reviewedBy?: string;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface ContentComponent {
  type: 'hero' | 'intro' | 'features' | 'faq' | 'products';
  content: string;
  props: Record<string, any>;
}
```

**Relationships:**
- Belongs to Organization
- Belongs to TaxonomyNode
- Created by User
- Has many ReviewDecisions

### GenerationQueue Model
**Purpose:** Manages bulk content generation pipeline

**Key Attributes:**
- id: UUID - Queue item identifier
- content_ids: UUID[] - Content items to generate
- priority: integer - Processing priority
- status: enum - Queue status
- settings: JSONB - Generation configuration

**TypeScript Interface:**
```typescript
interface GenerationQueueItem {
  id: string;
  orgId: string;
  contentIds: string[];
  priority: number;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  settings: {
    template: string;
    language: string;
    tone: string;
    components: string[];
  };
  progress: {
    total: number;
    completed: number;
    failed: number;
  };
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
}
```

**Relationships:**
- Belongs to Organization
- Has many Content items

---

## API Specification

### tRPC Router Definitions

```typescript
// packages/shared/src/trpc/routers/index.ts
import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../trpc';

// Taxonomy Router
export const taxonomyRouter = router({
  getNodes: protectedProcedure
    .input(z.object({
      orgId: z.string().uuid(),
      type: z.enum(['category', 'brand', 'all']).optional()
    }))
    .query(async ({ ctx, input }) => {
      return ctx.db.taxonomyNode.findMany({
        where: { 
          orgId: input.orgId,
          ...(input.type && input.type !== 'all' && { type: input.type })
        },
        include: { metrics: true }
      });
    }),

  createLink: protectedProcedure
    .input(z.object({
      sourceId: z.string().uuid(),
      targetId: z.string().uuid(),
      linkType: z.enum(['parent', 'related', 'cross_sell']),
      reason: z.string().min(50)
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.internalLink.create({
        data: {
          ...input,
          createdBy: ctx.user.id
        }
      });
    }),

  bulkSelect: protectedProcedure
    .input(z.object({
      nodeIds: z.array(z.string().uuid()),
      operation: z.enum(['generate', 'review', 'publish', 'delete'])
    }))
    .mutation(async ({ ctx, input }) => {
      // Handle bulk operations
      return processBulkOperation(input);
    })
});

// Content Router
export const contentRouter = router({
  generate: protectedProcedure
    .input(z.object({
      nodeId: z.string().uuid(),
      template: z.string(),
      language: z.string(),
      components: z.array(z.string())
    }))
    .mutation(async ({ ctx, input }) => {
      // Queue for generation
      return ctx.services.generation.queue(input);
    }),

  review: protectedProcedure
    .input(z.object({
      contentId: z.string().uuid(),
      decision: z.enum(['approve', 'reject', 'edit']),
      feedback: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.content.update({
        where: { id: input.contentId },
        data: {
          status: input.decision === 'approve' ? 'approved' : 'draft',
          reviewedBy: ctx.user.id,
          reviewedAt: new Date()
        }
      });
    }),

  getReviewQueue: protectedProcedure
    .input(z.object({
      limit: z.number().default(50),
      type: z.enum(['category', 'brand', 'all']).optional()
    }))
    .query(async ({ ctx, input }) => {
      return ctx.db.content.findMany({
        where: {
          orgId: ctx.user.orgId,
          status: 'pending_review',
          ...(input.type && input.type !== 'all' && { type: input.type })
        },
        limit: input.limit,
        orderBy: { aiConfidence: 'desc' }
      });
    })
});

// Analytics Router  
export const analyticsRouter = router({
  getCoverage: protectedProcedure
    .query(async ({ ctx }) => {
      const stats = await ctx.db.$queryRaw`
        SELECT 
          COUNT(*) FILTER (WHERE status = 'optimized') as optimized,
          COUNT(*) FILTER (WHERE status = 'outdated') as outdated,
          COUNT(*) FILTER (WHERE status = 'missing') as missing,
          COUNT(*) as total
        FROM taxonomy_nodes
        WHERE org_id = ${ctx.user.orgId}
      `;
      return stats;
    }),

  getVelocity: protectedProcedure
    .input(z.object({
      period: z.enum(['day', 'week', 'month']).default('week')
    }))
    .query(async ({ ctx, input }) => {
      // Return content generation velocity metrics
      return getVelocityMetrics(ctx.user.orgId, input.period);
    })
});

// Main App Router
export const appRouter = router({
  taxonomy: taxonomyRouter,
  content: contentRouter,
  analytics: analyticsRouter
});

export type AppRouter = typeof appRouter;
```

---

## Components

### ForceGraphVisualization
**Responsibility:** Render interactive taxonomy visualization with D3.js and Canvas for 3,000 nodes

**Key Interfaces:**
- Props: nodes, edges, mode, onNodeClick, onLinkCreate
- Events: nodeSelected, linkCreated, viewportChanged

**Dependencies:** D3.js, Canvas API, Zustand store

**Technology Stack:** React 19, D3.js 7.9, Canvas 2D, TypeScript

### ContentGenerationWizard
**Responsibility:** Multi-step wizard for configuring and initiating bulk content generation

**Key Interfaces:**
- Props: selectedNodes, templates, onGenerate
- State: currentStep, configuration, validation

**Dependencies:** React Hook Form, Zod validation, tRPC mutations

**Technology Stack:** React 19, React Hook Form, Radix UI, Zod

### SpeedReviewInterface
**Responsibility:** Tinder-style card interface for rapid content approval/rejection

**Key Interfaces:**
- Props: reviewQueue, onDecision
- Events: swipeLeft, swipeRight, swipeUp, keyboard shortcuts

**Dependencies:** Framer Motion, TanStack Query

**Technology Stack:** React 19, Framer Motion, Touch gestures

### KanbanWorkflowBoard
**Responsibility:** Drag-and-drop content pipeline management

**Key Interfaces:**
- Props: columns, cards, onMove
- Events: cardMoved, bulkMove, statusChanged

**Dependencies:** @dnd-kit, Supabase Realtime

**Technology Stack:** React 19, @dnd-kit, WebSocket subscriptions

### SupabaseService
**Responsibility:** Centralized data access and real-time subscriptions

**Key Interfaces:**
- Methods: query, mutate, subscribe, unsubscribe
- Auth: getUser, signIn, signOut

**Dependencies:** Supabase Client, Row Level Security

**Technology Stack:** TypeScript, Supabase JS SDK

### GenerationService
**Responsibility:** Manage content generation queue and OpenAI integration

**Key Interfaces:**
- Methods: queueGeneration, processQueue, getStatus
- Events: generationStarted, generationCompleted, generationFailed

**Dependencies:** OpenAI API, Circuit Breaker, Retry Policy

**Technology Stack:** Edge Functions, OpenAI SDK, p-retry

### ScrapingService
**Responsibility:** Respectful web scraping with rate limiting and robots.txt compliance

**Key Interfaces:**
- Methods: scrapeUrl, scrapeBatch, checkRobotsTxt
- Configuration: maxConcurrency, requestDelay, userAgent

**Dependencies:** Playwright, Cheerio, p-queue

**Technology Stack:** Playwright, Cheerio, Rate limiting

---

## External APIs

### OpenAI API
- **Purpose:** Generate SEO-optimized content using GPT-4
- **Documentation:** https://platform.openai.com/docs
- **Base URL(s):** https://api.openai.com/v1
- **Authentication:** Bearer token (API key)
- **Rate Limits:** 10,000 TPM (tokens per minute), 500 RPM (requests per minute)

**Key Endpoints Used:**
- `POST /chat/completions` - Generate content using GPT-4-turbo

**Integration Notes:** Implement tiered model selection (GPT-3.5 for bulk, GPT-4 for premium), circuit breaker pattern for resilience

### Google Search Console API
- **Purpose:** Fetch SEO performance data and search analytics
- **Documentation:** https://developers.google.com/webmaster-tools/search-console-api-original
- **Base URL(s):** https://www.googleapis.com/webmasters/v3
- **Authentication:** OAuth 2.0
- **Rate Limits:** 1,200 QPM (queries per minute)

**Key Endpoints Used:**
- `POST /sites/{siteUrl}/searchAnalytics/query` - Get search performance data
- `GET /sites/{siteUrl}/sitemaps` - List sitemaps for content discovery

**Integration Notes:** Cache results for 24 hours, implement exponential backoff for rate limits

---

## Core Workflows

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant A as API
    participant S as Supabase
    participant O as OpenAI
    participant Q as Queue

    U->>F: Select nodes for bulk generation
    F->>A: tRPC: content.generate(nodes[])
    A->>S: Create generation queue items
    A->>Q: Trigger Edge Function
    Q->>O: Generate content (parallel)
    O-->>Q: Return generated content
    Q->>S: Save content with 'pending_review'
    S-->>F: Realtime update
    F->>U: Show progress
    
    U->>F: Open speed review
    F->>A: tRPC: content.getReviewQueue()
    A->>S: Fetch pending content
    S-->>F: Return queue
    U->>F: Swipe to approve
    F->>A: tRPC: content.review(approve)
    A->>S: Update status to 'approved'
    F->>U: Next card
```

---

## Database Schema

```sql
-- Organizations (multi-tenant)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  domain TEXT UNIQUE NOT NULL,
  subscription_tier TEXT DEFAULT 'free',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Taxonomy nodes (limited to 3,000 per org)
CREATE TABLE taxonomy_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  type TEXT CHECK (type IN ('category', 'brand', 'product')),
  parent_id UUID REFERENCES taxonomy_nodes(id),
  depth INTEGER DEFAULT 0,
  sku_count INTEGER DEFAULT 0,
  position_x FLOAT,
  position_y FLOAT,
  status TEXT DEFAULT 'missing',
  traffic INTEGER DEFAULT 0,
  revenue DECIMAL(10,2) DEFAULT 0,
  search_volume INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, url)
);

-- Create index for visualization queries
CREATE INDEX idx_taxonomy_visualization ON taxonomy_nodes(org_id, type, status);
CREATE INDEX idx_taxonomy_position ON taxonomy_nodes(org_id, position_x, position_y);

-- Content table
CREATE TABLE content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  node_id UUID REFERENCES taxonomy_nodes(id),
  type TEXT CHECK (type IN ('category', 'brand', 'inspire', 'engage')),
  status TEXT CHECK (status IN ('draft', 'pending_review', 'approved', 'published')),
  title TEXT NOT NULL,
  meta_description TEXT,
  content_html TEXT,
  content_components JSONB,
  language TEXT DEFAULT 'en',
  ai_confidence FLOAT,
  seo_metrics JSONB,
  generated_by UUID REFERENCES auth.users(id),
  reviewed_by UUID REFERENCES auth.users(id),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Internal links for Link Mode
CREATE TABLE internal_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES taxonomy_nodes(id),
  target_id UUID NOT NULL REFERENCES taxonomy_nodes(id),
  link_type TEXT CHECK (link_type IN ('parent', 'related', 'cross_sell')),
  anchor_text TEXT,
  reason TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(source_id, target_id)
);

-- Generation queue for bulk operations
CREATE TABLE generation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  content_ids UUID[] NOT NULL,
  priority INTEGER DEFAULT 0,
  status TEXT DEFAULT 'queued',
  settings JSONB,
  progress JSONB DEFAULT '{"total": 0, "completed": 0, "failed": 0}',
  error TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Materialized view for coverage analytics
CREATE MATERIALIZED VIEW coverage_stats AS
SELECT 
  org_id,
  COUNT(*) as total_nodes,
  COUNT(*) FILTER (WHERE status = 'optimized') as optimized,
  COUNT(*) FILTER (WHERE status = 'outdated') as outdated,
  COUNT(*) FILTER (WHERE status = 'missing') as missing,
  COUNT(*) FILTER (WHERE sku_count = 0) as no_products,
  ROUND(COUNT(*) FILTER (WHERE status = 'optimized')::numeric / COUNT(*)::numeric * 100, 2) as coverage_percent
FROM taxonomy_nodes
GROUP BY org_id;

-- Refresh materialized view every 5 minutes
SELECT cron.schedule('refresh-coverage', '*/5 * * * *', 'REFRESH MATERIALIZED VIEW CONCURRENTLY coverage_stats');

-- Enable Row Level Security
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxonomy_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE content ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their organization's data"
  ON taxonomy_nodes FOR ALL
  USING (org_id IN (
    SELECT org_id FROM organization_users 
    WHERE user_id = auth.uid()
  ));
```

---

## Frontend Architecture

### Component Architecture

#### Component Organization
```
components/
├── ui/                    # Base UI components (Radix UI)
│   ├── Button/
│   ├── Card/
│   ├── Dialog/
│   └── Toast/
├── taxonomy/              # Taxonomy-specific components
│   ├── ForceGraph/
│   │   ├── ForceGraph.tsx
│   │   ├── useForceSimulation.ts
│   │   ├── useCanvasRenderer.ts
│   │   └── types.ts
│   ├── LinkMode/
│   ├── NodeDetail/
│   └── SearchPanel/
├── generation/            # Content generation components
│   ├── WizardSteps/
│   ├── TemplateSelector/
│   └── ComponentBuilder/
├── review/                # Review interface components
│   ├── SwipeCard/
│   ├── CardStack/
│   └── ReviewStats/
└── shared/                # Shared components
    ├── Layout/
    ├── Navigation/
    └── ErrorBoundary/
```

#### Component Template
```typescript
// components/taxonomy/ForceGraph/ForceGraph.tsx
import { useEffect, useRef, memo } from 'react';
import { useForceSimulation } from './useForceSimulation';
import { useCanvasRenderer } from './useCanvasRenderer';
import type { ForceGraphProps } from './types';

export const ForceGraph = memo<ForceGraphProps>(({
  nodes,
  edges,
  mode = 'default',
  onNodeClick,
  onLinkCreate
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simulation = useForceSimulation(nodes, edges);
  const renderer = useCanvasRenderer(canvasRef, simulation);

  useEffect(() => {
    renderer.start();
    return () => renderer.stop();
  }, [renderer]);

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      />
      {mode === 'link' && <LinkModeOverlay />}
    </div>
  );
});

ForceGraph.displayName = 'ForceGraph';
```

### State Management Architecture

#### State Structure
```typescript
// stores/taxonomy.store.ts
interface TaxonomyStore {
  // State
  nodes: Map<string, TaxonomyNode>;
  edges: Edge[];
  selectedNodes: Set<string>;
  viewMode: 'default' | 'link' | 'heatmap' | 'coverage';
  filters: {
    status: string[];
    type: string[];
    minSkuCount: number;
  };
  
  // Actions
  loadNodes: () => Promise<void>;
  selectNode: (id: string, multi?: boolean) => void;
  createLink: (source: string, target: string, reason: string) => Promise<void>;
  setViewMode: (mode: ViewMode) => void;
  applyFilters: (filters: Partial<FilterState>) => void;
  
  // Computed
  get visibleNodes(): TaxonomyNode[];
  get coverageStats(): CoverageStats;
}
```

#### State Management Patterns
- Use Zustand for client-side state
- Use TanStack Query for server state
- Implement optimistic updates for UI responsiveness
- Subscribe to Supabase realtime for collaborative features
- Use Immer for immutable state updates

### Routing Architecture

#### Route Organization
```
app/
├── (auth)/
│   ├── login/
│   ├── register/
│   └── forgot-password/
├── (dashboard)/
│   ├── layout.tsx         # Dashboard layout with sidebar
│   ├── page.tsx           # Dashboard home
│   ├── taxonomy/
│   │   ├── page.tsx       # Taxonomy visualization
│   │   └── [id]/page.tsx  # Node detail view
│   ├── generate/
│   │   ├── page.tsx       # Generation dashboard
│   │   ├── wizard/page.tsx # Step-by-step wizard
│   │   └── bulk/page.tsx  # Bulk operations
│   ├── review/
│   │   └── page.tsx       # Speed review interface
│   └── workflow/
│       └── page.tsx       # Kanban board
└── api/
    └── trpc/
        └── [trpc]/route.ts # tRPC endpoint
```

#### Protected Route Pattern
```typescript
// app/(dashboard)/layout.tsx
export default async function DashboardLayout({
  children
}: {
  children: React.ReactNode
}) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="flex h-screen">
      <Sidebar user={user} />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
```

### Frontend Services Layer

#### API Client Setup
```typescript
// lib/trpc/client.ts
import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@/server/routers';

export const trpc = createTRPCReact<AppRouter>();

// lib/trpc/provider.tsx
export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: '/api/trpc',
          headers() {
            return {
              authorization: getAuthToken(),
            };
          },
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
```

#### Service Example
```typescript
// services/content.service.ts
export const contentService = {
  async generateContent(nodes: string[], config: GenerationConfig) {
    return trpc.content.generate.mutate({
      nodeIds: nodes,
      ...config
    });
  },

  async reviewContent(contentId: string, decision: ReviewDecision) {
    return trpc.content.review.mutate({
      contentId,
      decision
    });
  },

  useReviewQueue() {
    return trpc.content.getReviewQueue.useQuery();
  }
};
```

---

## Backend Architecture

### Service Architecture

#### Edge Function Organization
```
apps/api/
├── src/
│   ├── functions/
│   │   ├── generate-content.ts
│   │   ├── process-queue.ts
│   │   ├── scrape-content.ts
│   │   └── sync-search-console.ts
│   ├── lib/
│   │   ├── openai.ts
│   │   ├── supabase.ts
│   │   └── rate-limiter.ts
│   ├── middleware/
│   │   ├── auth.ts
│   │   ├── cors.ts
│   │   └── error-handler.ts
│   └── utils/
│       ├── circuit-breaker.ts
│       └── retry-policy.ts
```

#### Function Template
```typescript
// functions/generate-content.ts
import { createClient } from '@supabase/supabase-js';
import { OpenAI } from 'openai';
import { withRetry } from '@/utils/retry-policy';
import { CircuitBreaker } from '@/utils/circuit-breaker';

const openaiBreaker = new CircuitBreaker('openai', {
  failureThreshold: 3,
  resetTimeout: 30000
});

export default async function handler(req: Request) {
  try {
    const { nodeId, template, language } = await req.json();
    
    // Fetch node data
    const supabase = createClient();
    const { data: node } = await supabase
      .from('taxonomy_nodes')
      .select('*')
      .eq('id', nodeId)
      .single();
    
    // Generate content with circuit breaker
    const content = await openaiBreaker.execute(() =>
      withRetry(() => generateWithOpenAI(node, template, language), 'openai')
    );
    
    // Save to database
    const { data, error } = await supabase
      .from('content')
      .insert({
        node_id: nodeId,
        content_html: content.html,
        content_components: content.components,
        language,
        ai_confidence: content.confidence,
        status: 'pending_review'
      });
    
    return new Response(JSON.stringify({ success: true, data }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    return handleError(error);
  }
}
```

### Database Architecture

#### Data Access Layer
```typescript
// lib/repositories/content.repository.ts
export class ContentRepository {
  constructor(private supabase: SupabaseClient) {}

  async findById(id: string): Promise<Content | null> {
    const { data, error } = await this.supabase
      .from('content')
      .select('*, node:taxonomy_nodes(*)')
      .eq('id', id)
      .single();
      
    if (error) throw error;
    return data;
  }

  async findPendingReview(orgId: string, limit = 50): Promise<Content[]> {
    const { data, error } = await this.supabase
      .from('content')
      .select('*')
      .eq('org_id', orgId)
      .eq('status', 'pending_review')
      .order('ai_confidence', { ascending: false })
      .limit(limit);
      
    if (error) throw error;
    return data;
  }

  async updateStatus(id: string, status: ContentStatus, reviewerId?: string) {
    const updates: any = { status, updated_at: new Date() };
    if (reviewerId) {
      updates.reviewed_by = reviewerId;
      updates.reviewed_at = new Date();
    }
    
    const { error } = await this.supabase
      .from('content')
      .update(updates)
      .eq('id', id);
      
    if (error) throw error;
  }
}
```

### Authentication and Authorization

#### Auth Flow
```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant S as Supabase Auth
    participant A as API

    U->>F: Login with email/password
    F->>S: supabase.auth.signIn()
    S-->>F: JWT + Refresh token
    F->>F: Store in secure cookie
    
    U->>F: Access protected route
    F->>A: Request with JWT
    A->>S: Verify JWT
    S-->>A: User data + org_id
    A->>A: Check RLS policies
    A-->>F: Authorized response
```

#### Middleware/Guards
```typescript
// middleware/auth.ts
export async function requireAuth(req: Request): Promise<User> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  
  if (!token) {
    throw new AuthenticationError('No token provided');
  }
  
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    throw new AuthenticationError('Invalid token');
  }
  
  // Get organization membership
  const { data: membership } = await supabase
    .from('organization_users')
    .select('org_id, role')
    .eq('user_id', user.id)
    .single();
  
  if (!membership) {
    throw new AuthorizationError('No organization membership');
  }
  
  return {
    ...user,
    orgId: membership.org_id,
    role: membership.role
  };
}
```

---

## Unified Project Structure

```
contentmax/
├── .github/                    # CI/CD workflows
│   └── workflows/
│       ├── ci.yaml
│       └── deploy.yaml
├── apps/                       # Application packages
│   ├── web/                    # Frontend application
│   │   ├── app/                # Next.js app router
│   │   ├── components/         # React components
│   │   ├── hooks/              # Custom hooks
│   │   ├── lib/                # Utilities
│   │   ├── services/           # API services
│   │   ├── stores/             # Zustand stores
│   │   ├── styles/             # Global styles
│   │   └── package.json
│   └── api/                    # Edge functions
│       ├── functions/          # Vercel functions
│       ├── lib/                # Shared libraries
│       ├── middleware/         # API middleware
│       └── package.json
├── packages/                   # Shared packages
│   ├── shared/                 # Shared types/utils
│   │   ├── src/
│   │   │   ├── types/          # TypeScript types
│   │   │   ├── schemas/        # Zod schemas
│   │   │   └── utils/          # Shared utilities
│   │   └── package.json
│   ├── ui/                     # Shared UI components
│   │   ├── src/
│   │   └── package.json
│   └── config/                 # Shared configuration
│       ├── eslint/
│       ├── typescript/
│       └── tailwind/
├── supabase/                   # Supabase configuration
│   ├── migrations/             # Database migrations
│   ├── functions/              # Supabase Edge Functions
│   └── seed.sql                # Seed data
├── docs/                       # Documentation
│   ├── prd.md
│   ├── frontend-architecture-spec.md
│   ├── fullstack-architecture.md
│   └── ux-specs/
├── .env.example                # Environment template
├── package.json                # Root package.json
├── turbo.json                  # Turborepo config
└── README.md
```

---

## Development Workflow

### Local Development Setup

#### Prerequisites
```bash
# Node.js 20.11.0
nvm install 20.11.0
nvm use 20.11.0

# Supabase CLI
npm install -g supabase

# Vercel CLI
npm install -g vercel
```

#### Initial Setup
```bash
# Clone repository
git clone https://github.com/org/contentmax
cd contentmax

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Start Supabase locally
supabase start

# Run database migrations
supabase db push

# Seed database
supabase db seed
```

#### Development Commands
```bash
# Start all services
npm run dev

# Start frontend only
npm run dev:web

# Start backend only
npm run dev:api

# Run tests
npm run test
npm run test:e2e
```

### Environment Configuration

#### Required Environment Variables
```bash
# Frontend (.env.local)
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Backend (.env)
SUPABASE_SERVICE_KEY=your-service-key
OPENAI_API_KEY=sk-...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Shared
DATABASE_URL=postgresql://postgres:postgres@localhost:54321/postgres
```

---

## Deployment Architecture

### Deployment Strategy

**Frontend Deployment:**
- **Platform:** Vercel
- **Build Command:** `npm run build:web`
- **Output Directory:** `apps/web/.next`
- **CDN/Edge:** Vercel Edge Network with automatic caching

**Backend Deployment:**
- **Platform:** Vercel Edge Functions
- **Build Command:** `npm run build:api`
- **Deployment Method:** Automatic via GitHub integration

### CI/CD Pipeline
```yaml
# .github/workflows/deploy.yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20.11.0'
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm run test
      - run: npx playwright install
      - run: npm run test:e2e

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: vercel/action@v1
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
```

### Environments

| Environment | Frontend URL | Backend URL | Purpose |
|------------|--------------|-------------|---------|
| Development | http://localhost:3000 | http://localhost:3000/api | Local development |
| Staging | https://staging.contentmax.ai | https://staging.contentmax.ai/api | Pre-production testing |
| Production | https://contentmax.ai | https://contentmax.ai/api | Live environment |

---

## Security and Performance

### Security Requirements

**Frontend Security:**
- CSP Headers: `default-src 'self'; script-src 'self' 'unsafe-eval' *.supabase.co`
- XSS Prevention: React's automatic escaping + input sanitization
- Secure Storage: HTTPOnly cookies for auth tokens

**Backend Security:**
- Input Validation: Zod schemas on all endpoints
- Rate Limiting: 100 req/min per IP, 1000 req/min per user
- CORS Policy: Restricted to app domains only

**Authentication Security:**
- Token Storage: Secure HTTPOnly cookies with SameSite
- Session Management: 7-day refresh tokens, 1-hour access tokens
- Password Policy: Min 8 chars, uppercase, lowercase, number, special char

### Performance Optimization

**Frontend Performance:**
- Bundle Size Target: <200KB gzipped for initial load
- Loading Strategy: Code splitting, lazy loading, progressive enhancement
- Caching Strategy: SWR for data fetching, service worker for assets

**Backend Performance:**
- Response Time Target: p50 <100ms, p95 <500ms, p99 <1000ms
- Database Optimization: Indexes, materialized views, connection pooling
- Caching Strategy: Supabase query caching, Edge caching for static responses

---

## Testing Strategy

### Testing Pyramid
```
      E2E Tests
     /        \
    Integration Tests
   /            \
  Frontend Unit  Backend Unit
```

### Test Organization

#### Frontend Tests
```
tests/
├── unit/
│   ├── components/
│   ├── hooks/
│   └── utils/
├── integration/
│   ├── stores/
│   └── services/
└── e2e/
    ├── auth.spec.ts
    ├── taxonomy.spec.ts
    └── generation.spec.ts
```

#### Backend Tests
```
tests/
├── unit/
│   ├── services/
│   └── utils/
├── integration/
│   ├── api/
│   └── database/
└── fixtures/
```

### Test Examples

#### Frontend Component Test
```typescript
// tests/unit/components/ForceGraph.test.tsx
import { render, screen } from '@testing-library/react';
import { ForceGraph } from '@/components/taxonomy/ForceGraph';

describe('ForceGraph', () => {
  it('renders canvas element', () => {
    render(<ForceGraph nodes={[]} edges={[]} />);
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('handles node selection', async () => {
    const onNodeClick = vi.fn();
    const { user } = render(
      <ForceGraph 
        nodes={mockNodes} 
        edges={[]} 
        onNodeClick={onNodeClick}
      />
    );
    
    await user.click(screen.getByTestId('node-1'));
    expect(onNodeClick).toHaveBeenCalledWith(mockNodes[0]);
  });
});
```

#### Backend API Test
```typescript
// tests/integration/api/content.test.ts
import { createMockRequest } from '@/tests/utils';
import handler from '@/functions/generate-content';

describe('Content Generation API', () => {
  it('generates content successfully', async () => {
    const req = createMockRequest({
      method: 'POST',
      body: {
        nodeId: 'test-node-id',
        template: 'category',
        language: 'en'
      }
    });

    const res = await handler(req);
    const data = await res.json();
    
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.content_html).toBeDefined();
  });
});
```

#### E2E Test
```typescript
// tests/e2e/generation.spec.ts
import { test, expect } from '@playwright/test';

test('bulk content generation flow', async ({ page }) => {
  // Login
  await page.goto('/login');
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="password"]', 'password');
  await page.click('button[type="submit"]');

  // Navigate to taxonomy
  await page.goto('/taxonomy');
  await page.waitForSelector('canvas');

  // Select multiple nodes
  await page.keyboard.down('Shift');
  await page.click('[data-node-id="1"]');
  await page.click('[data-node-id="2"]');
  await page.keyboard.up('Shift');

  // Open generation wizard
  await page.click('button:has-text("Generate Content")');
  
  // Configure and generate
  await page.selectOption('[name="template"]', 'category');
  await page.selectOption('[name="language"]', 'en');
  await page.click('button:has-text("Generate")');

  // Verify success
  await expect(page.locator('[data-testid="success-toast"]')).toBeVisible();
});
```

---

## Coding Standards

### Critical Fullstack Rules
- **Type Sharing:** Always define types in packages/shared and import from there
- **API Calls:** Never make direct HTTP calls - use the tRPC service layer
- **Environment Variables:** Access only through config objects, never process.env directly
- **Error Handling:** All API routes must use the standard error handler
- **State Updates:** Never mutate state directly - use proper state management patterns
- **Component Imports:** Use absolute imports with @ alias
- **Async Operations:** Always handle loading and error states
- **Database Access:** Only through repository pattern, never direct Supabase calls in components

### Naming Conventions

| Element | Frontend | Backend | Example |
|---------|----------|---------|---------|
| Components | PascalCase | - | `UserProfile.tsx` |
| Hooks | camelCase with 'use' | - | `useAuth.ts` |
| API Routes | - | kebab-case | `/api/user-profile` |
| Database Tables | - | snake_case | `user_profiles` |
| Type Interfaces | PascalCase | PascalCase | `UserProfile` |
| Enums | PascalCase | PascalCase | `ContentStatus` |
| Constants | UPPER_SNAKE_CASE | UPPER_SNAKE_CASE | `MAX_NODES` |

---

## Error Handling Strategy

### Error Flow
```mermaid
sequenceDiagram
    participant C as Component
    participant S as Service
    participant A as API
    participant E as Error Handler
    participant U as User

    C->>S: Call service method
    S->>A: tRPC request
    A-->>E: Error occurs
    E->>E: Log error
    E->>E: Classify error
    E-->>S: Return typed error
    S-->>C: Handle error
    C->>U: Show error UI
```

### Error Response Format
```typescript
interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
    timestamp: string;
    requestId: string;
  };
}
```

### Frontend Error Handling
```typescript
// hooks/useErrorHandler.ts
export function useErrorHandler() {
  return useCallback((error: unknown) => {
    if (error instanceof TRPCError) {
      toast.error(error.message);
    } else if (error instanceof NetworkError) {
      toast.error('Connection lost. Please try again.');
    } else {
      toast.error('An unexpected error occurred');
      console.error(error);
    }
  }, []);
}
```

### Backend Error Handling
```typescript
// middleware/error-handler.ts
export function errorHandler(error: unknown): Response {
  const errorId = generateErrorId();
  
  if (error instanceof ValidationError) {
    return new Response(JSON.stringify({
      error: {
        code: 'VALIDATION_ERROR',
        message: error.message,
        details: error.details,
        timestamp: new Date().toISOString(),
        requestId: errorId
      }
    }), { status: 400 });
  }
  
  // Log unexpected errors
  console.error(`[${errorId}]`, error);
  
  return new Response(JSON.stringify({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      timestamp: new Date().toISOString(),
      requestId: errorId
    }
  }), { status: 500 });
}
```

---

## Monitoring and Observability

### Monitoring Stack
- **Frontend Monitoring:** Vercel Analytics + Web Vitals
- **Backend Monitoring:** Vercel Functions Monitoring
- **Error Tracking:** Sentry for production errors
- **Performance Monitoring:** Custom metrics with performance.measure()

### Key Metrics

**Frontend Metrics:**
- Core Web Vitals (LCP, FID, CLS)
- JavaScript errors rate
- API response times (p50, p95, p99)
- User interactions (clicks, swipes, keyboard)

**Backend Metrics:**
- Request rate per endpoint
- Error rate by type
- Response time percentiles
- Database query performance
- External API latency (OpenAI, Google)
- Queue depth and processing time

---

## Architecture Decision Log

1. **Next.js 15 over Remix/SvelteKit** - Better ecosystem, Vercel integration, React Server Components
2. **Supabase over custom backend** - Faster development, built-in auth/realtime/storage
3. **tRPC over GraphQL** - Type safety without codegen, simpler setup
4. **D3.js + Canvas over WebGL** - Sufficient for 3,000 nodes, better browser support
5. **Zustand over Redux** - Simpler API, less boilerplate, adequate for our needs
6. **Vercel over AWS** - Better DX, automatic deployments, integrated analytics
7. **Monorepo with npm workspaces** - Simple setup, no additional tooling required

---

## Next Steps

This architecture is ready for implementation. The key priorities are:

1. Set up the monorepo structure with npm workspaces
2. Initialize Supabase project and run migrations
3. Build the D3.js + Canvas taxonomy visualization prototype
4. Implement tRPC routers for type-safe API
5. Create the speed review interface with Framer Motion
6. Set up CI/CD pipeline with GitHub Actions
7. Implement circuit breakers and retry policies
8. Add comprehensive error handling
9. Set up monitoring and analytics

The architecture is optimized for rapid development while maintaining production-grade quality and scalability for the 3,000 node visualization target.