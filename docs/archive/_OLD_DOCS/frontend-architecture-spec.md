# Frontend Architecture Specification

## ContentMax Technical Implementation Guide

### Version 1.0

### Date: January 26, 2024

### Author: Frontend Architecture Team

---

## 1. Executive Summary

This document provides the complete frontend architecture specification for ContentMax, an AI-powered content generation and management platform for e-commerce. It defines the technical stack, component architecture, state management, API contracts, and implementation guidelines for building a scalable, performant application capable of handling 10,000+ taxonomy nodes and generating content at scale.

### Key Technical Decisions

- **Framework**: Next.js 15 with App Router and React Server Components
- **Language**: TypeScript 5.3+ with strict mode
- **Styling**: Tailwind CSS 3.4 with custom design system
- **State**: Zustand for client state, Tanstack Query for server state
- **Database**: Supabase (PostgreSQL + Realtime + Auth + Storage)
- **Visualization**: D3.js with WebGL acceleration via Pixi.js
- **Animation**: Framer Motion for complex interactions
- **Testing**: Vitest + Playwright + Mock Service Worker

---

## 2. Project Structure

```
contentmax/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Auth group routes
│   │   ├── login/
│   │   ├── register/
│   │   └── onboarding/
│   ├── (dashboard)/              # Main app group
│   │   ├── layout.tsx           # Dashboard layout with sidebar
│   │   ├── page.tsx             # Dashboard home
│   │   ├── taxonomy/            # Taxonomy visualization
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── generate/            # Content generation
│   │   │   ├── page.tsx
│   │   │   ├── wizard/page.tsx
│   │   │   └── bulk/page.tsx
│   │   ├── review/              # Speed review interface
│   │   │   └── page.tsx
│   │   ├── workflow/            # Kanban board
│   │   │   └── page.tsx
│   │   ├── content/             # Content management
│   │   │   ├── inspire/
│   │   │   └── engage/
│   │   └── settings/
│   ├── api/                     # API routes
│   │   ├── content/
│   │   ├── generation/
│   │   └── webhooks/
│   └── layout.tsx               # Root layout
├── components/                   # Shared components
│   ├── ui/                      # Base UI components
│   │   ├── button/
│   │   ├── card/
│   │   ├── modal/
│   │   └── toast/
│   ├── taxonomy/                # Taxonomy components
│   │   ├── ForceGraph/
│   │   ├── LinkMode/
│   │   ├── NodeDetail/
│   │   └── SearchPanel/
│   ├── generation/              # Generation components
│   │   ├── WizardSteps/
│   │   ├── TemplateSelector/
│   │   └── ComponentBuilder/
│   ├── review/                  # Review components
│   │   ├── SwipeCard/
│   │   ├── CardStack/
│   │   └── ReviewStats/
│   ├── workflow/                # Workflow components
│   │   ├── KanbanBoard/
│   │   ├── ContentCard/
│   │   └── ColumnHeader/
│   └── shared/                  # Shared components
│       ├── Navigation/
│       ├── SearchBar/
│       └── UserMenu/
├── lib/                         # Utility libraries
│   ├── supabase/               # Supabase client
│   ├── ai/                    # AI/OpenAI integration
│   ├── analytics/              # Analytics tracking
│   └── utils/                  # Helper functions
├── stores/                     # Zustand stores
│   ├── taxonomy.store.ts
│   ├── generation.store.ts
│   ├── review.store.ts
│   └── workflow.store.ts
├── hooks/                      # Custom hooks
│   ├── useSupabase.ts
│   ├── useRealtime.ts
│   ├── useInfiniteScroll.ts
│   └── useKeyboardShortcuts.ts
├── types/                      # TypeScript types
│   ├── database.types.ts      # Supabase generated types
│   ├── content.types.ts
│   └── api.types.ts
├── styles/                     # Global styles
│   └── globals.css
├── public/                     # Static assets
│   ├── images/
│   └── fonts/
└── tests/                      # Test files
    ├── unit/
    ├── integration/
    └── e2e/
```

---

## 3. Technology Stack

### 3.1 Core Technologies

```typescript
// package.json key dependencies
{
  "dependencies": {
    // Framework
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",

    // Supabase
    "@supabase/supabase-js": "^2.45.0",
    "@supabase/auth-helpers-nextjs": "^0.10.0",
    "@supabase/ssr": "^0.5.0",

    // State Management
    "zustand": "^5.0.0",
    "@tanstack/react-query": "^5.0.0",

    // Visualization
    "d3": "^7.9.0",
    "pixi.js": "^8.0.0",
    "react-force-graph": "^1.44.0",

    // UI Components
    "@headlessui/react": "^2.0.0",
    "@radix-ui/react-*": "latest",
    "framer-motion": "^11.0.0",
    "@dnd-kit/sortable": "^8.0.0",

    // Forms & Validation
    "react-hook-form": "^7.52.0",
    "zod": "^3.23.0",

    // Utilities
    "date-fns": "^3.0.0",
    "lodash": "^4.17.21",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.0.0"
  },
  "devDependencies": {
    // TypeScript
    "typescript": "^5.3.0",
    "@types/react": "^18.3.0",
    "@types/node": "^20.0.0",

    // Testing
    "vitest": "^2.0.0",
    "@playwright/test": "^1.40.0",
    "msw": "^2.0.0",
    "@testing-library/react": "^15.0.0",

    // Linting & Formatting
    "eslint": "^8.56.0",
    "prettier": "^3.2.0",
    "husky": "^9.0.0",

    // Styling
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0"
  }
}
```

### 3.2 Configuration Files

```typescript
// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    reactCompiler: true,
    ppr: true, // Partial Prerendering
    dynamicIO: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  },
};

export default nextConfig;
```

---

## 4. Component Architecture

### 4.1 Component Hierarchy

```
App
├── AuthProvider
│   └── SupabaseProvider
│       └── QueryClientProvider
│           └── ThemeProvider
│               └── Layout
│                   ├── Navigation
│                   │   ├── Logo
│                   │   ├── NavMenu
│                   │   └── UserMenu
│                   ├── Sidebar (desktop)
│                   │   ├── SearchBar
│                   │   ├── Filters
│                   │   └── QuickActions
│                   ├── Main Content Area
│                   │   └── [Page Components]
│                   └── MobileNav (mobile)
│                       └── TabBar
```

### 4.2 Core Component Specifications

#### ForceGraph Component

```typescript
// components/taxonomy/ForceGraph/ForceGraph.tsx
interface ForceGraphProps {
  nodes: TaxonomyNode[];
  edges: Edge[];
  onNodeClick: (node: TaxonomyNode) => void;
  onLinkCreate?: (source: string, target: string) => void;
  mode: 'default' | 'link' | 'heatmap' | 'coverage';
  filters: FilterState;
}

interface TaxonomyNode {
  id: string;
  label: string;
  url: string;
  type: 'category' | 'brand' | 'product';
  status: 'optimized' | 'outdated' | 'missing' | 'no_products';
  metrics: {
    skuCount: number;
    traffic: number;
    revenue: number;
    searchVolume: number;
  };
  position: { x: number; y: number };
  parentId?: string;
  depth: number;
}

// Performance targets
const PERFORMANCE_CONFIG = {
  maxNodes: 10000,
  renderThreshold: {
    low: { zoom: 0.25, nodes: 50 },
    medium: { zoom: 0.5, nodes: 200 },
    high: { zoom: 0.75, nodes: 1000 },
    full: { zoom: 1, nodes: 2500 },
  },
  physics: {
    chargeStrength: -300,
    linkDistance: 100,
    alphaDecay: 0.02,
  },
};
```

#### SpeedReview Component

```typescript
// components/review/SpeedReview/SpeedReview.tsx
interface SpeedReviewProps {
  queue: ReviewItem[];
  onDecision: (id: string, decision: Decision) => void;
  stats: ReviewStats;
}

interface ReviewItem {
  id: string;
  type: 'category' | 'brand' | 'inspire' | 'engage';
  title: string;
  url: string;
  content: {
    excerpt: string;
    fullHtml: string;
    components: ContentComponent[];
  };
  seo: {
    score: number;
    issues: SEOIssue[];
    targetKeyword: string;
    searchVolume: number;
    difficulty: number;
    potentialRevenue: number;
  };
  status: 'draft' | 'pending_review' | 'approved';
}

type Decision = 'approve' | 'reject' | 'edit' | 'skip';

// Swipe thresholds
const SWIPE_CONFIG = {
  threshold: 50, // pixels
  velocity: 0.5,
  rotation: 15, // degrees
  animationDuration: 300, // ms
};
```

---

## 5. State Management

### 5.1 Store Architecture

```typescript
// stores/taxonomy.store.ts
interface TaxonomyStore {
  // State
  nodes: Map<string, TaxonomyNode>;
  edges: Edge[];
  selectedNodes: Set<string>;
  viewMode: ViewMode;
  filters: FilterState;
  viewport: Viewport;

  // Actions
  loadTaxonomy: () => Promise<void>;
  selectNode: (id: string, multi?: boolean) => void;
  createLink: (source: string, target: string, context: LinkContext) => Promise<void>;
  updateNodeStatus: (id: string, status: NodeStatus) => void;
  setViewMode: (mode: ViewMode) => void;
  applyFilters: (filters: Partial<FilterState>) => void;

  // Computed
  visibleNodes: () => TaxonomyNode[];
  getNodesByStatus: (status: NodeStatus) => TaxonomyNode[];
  getCoverageMetrics: () => CoverageMetrics;
}

// stores/generation.store.ts
interface GenerationStore {
  // State
  queue: GenerationItem[];
  activeGeneration: GenerationItem | null;
  templates: Template[];
  settings: GenerationSettings;

  // Actions
  queueGeneration: (items: GenerationRequest[]) => void;
  startGeneration: () => Promise<void>;
  cancelGeneration: (id: string) => void;
  updateSettings: (settings: Partial<GenerationSettings>) => void;

  // Real-time
  subscribeToUpdates: () => () => void;
}
```

### 5.2 Real-time Synchronization

```typescript
// hooks/useRealtime.ts
export function useRealtime() {
  const supabase = useSupabase();

  useEffect(() => {
    const channel = supabase
      .channel('content-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'content',
        },
        (payload) => {
          // Update local state
          handleRealtimeUpdate(payload);
        }
      )
      .on('presence', { event: 'sync' }, () => {
        // Handle collaborative features
        const state = channel.presenceState();
        updateCollaborators(state);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
}
```

---

## 6. API Contracts

### 6.1 REST API Endpoints

```typescript
// Content Management
GET    /api/content                     // List content with filters
GET    /api/content/:id                 // Get single content item
POST   /api/content                     // Create content
PATCH  /api/content/:id                 // Update content
DELETE /api/content/:id                 // Delete content
POST   /api/content/bulk                // Bulk operations

// Taxonomy
GET    /api/taxonomy                    // Get full taxonomy tree
GET    /api/taxonomy/nodes              // Get nodes with pagination
GET    /api/taxonomy/edges              // Get relationships
POST   /api/taxonomy/link               // Create internal link
GET    /api/taxonomy/coverage           // Get coverage metrics

// Generation
POST   /api/generation/queue            // Queue content generation
GET    /api/generation/status/:id       // Get generation status
POST   /api/generation/cancel/:id       // Cancel generation
GET    /api/generation/templates        // List available templates
POST   /api/generation/estimate         // Cost estimation

// Review
GET    /api/review/queue                // Get review queue
POST   /api/review/decision             // Submit review decision
GET    /api/review/stats                // Get review statistics

// Analytics
GET    /api/analytics/dashboard         // Dashboard metrics
GET    /api/analytics/seo               // SEO performance
GET    /api/analytics/content-journey   // User journey data
```

### 6.2 Supabase Schema

```sql
-- Core Tables
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  domain TEXT UNIQUE NOT NULL,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id),
  type TEXT CHECK (type IN ('category', 'brand', 'inspire', 'engage')),
  status TEXT CHECK (status IN ('draft', 'pending_review', 'approved', 'published')),
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  meta_description TEXT,
  content_html TEXT,
  content_components JSONB,
  seo_metrics JSONB,
  language TEXT DEFAULT 'en',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  INDEX idx_content_org_status (org_id, status),
  INDEX idx_content_url (org_id, url)
);

CREATE TABLE taxonomy_nodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id),
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  type TEXT NOT NULL,
  parent_id UUID REFERENCES taxonomy_nodes(id),
  depth INTEGER DEFAULT 0,
  metrics JSONB DEFAULT '{}',
  position JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, url)
);

CREATE TABLE internal_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id),
  source_id UUID REFERENCES taxonomy_nodes(id),
  target_id UUID REFERENCES taxonomy_nodes(id),
  link_type TEXT,
  anchor_text TEXT,
  context TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE generation_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id),
  content_id UUID REFERENCES content(id),
  status TEXT DEFAULT 'queued',
  priority INTEGER DEFAULT 0,
  settings JSONB,
  error TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org's content"
  ON content FOR SELECT
  USING (org_id IN (
    SELECT org_id FROM organization_users
    WHERE user_id = auth.uid()
  ));
```

---

## 7. Routing & Navigation

### 7.1 Route Structure

```typescript
// app/routes.ts
export const routes = {
  auth: {
    login: '/login',
    register: '/register',
    forgot: '/forgot-password',
    onboarding: '/onboarding',
  },
  dashboard: {
    home: '/',
    taxonomy: '/taxonomy',
    taxonomyDetail: (id: string) => `/taxonomy/${id}`,
    generate: '/generate',
    generateWizard: '/generate/wizard',
    generateBulk: '/generate/bulk',
    review: '/review',
    workflow: '/workflow',
    contentInspire: '/content/inspire',
    contentEngage: '/content/engage',
    settings: '/settings',
  },
  api: {
    content: '/api/content',
    generation: '/api/generation',
    taxonomy: '/api/taxonomy',
  },
} as const;
```

### 7.2 Navigation Component

```typescript
// components/shared/Navigation/Navigation.tsx
export function Navigation() {
  const pathname = usePathname()
  const { user } = useUser()

  const navItems = [
    {
      label: 'Dashboard',
      href: routes.dashboard.home,
      icon: HomeIcon,
      badge: null
    },
    {
      label: 'Taxonomy',
      href: routes.dashboard.taxonomy,
      icon: NetworkIcon,
      badge: null
    },
    {
      label: 'Generate',
      href: routes.dashboard.generate,
      icon: SparklesIcon,
      badge: { count: 5, type: 'info' }
    },
    {
      label: 'Review',
      href: routes.dashboard.review,
      icon: ClipboardIcon,
      badge: { count: 23, type: 'warning' }
    },
    {
      label: 'Workflow',
      href: routes.dashboard.workflow,
      icon: KanbanIcon,
      badge: null
    }
  ]

  return (
    <nav className="flex items-center space-x-6">
      {navItems.map(item => (
        <NavLink
          key={item.href}
          {...item}
          isActive={pathname === item.href}
        />
      ))}
    </nav>
  )
}
```

---

## 8. Performance Optimization

### 8.1 Code Splitting Strategy

```typescript
// Lazy load heavy components
const ForceGraph = dynamic(
  () => import('@/components/taxonomy/ForceGraph'),
  {
    loading: () => <ForceGraphSkeleton />,
    ssr: false
  }
)

const ContentEditor = dynamic(
  () => import('@/components/editor/ContentEditor'),
  {
    loading: () => <EditorSkeleton />
  }
)

// Route-based splitting handled by Next.js App Router automatically
```

### 8.2 Data Fetching Patterns

```typescript
// Server Components for initial data
export default async function TaxonomyPage() {
  const taxonomy = await getTaxonomy() // Server-side fetch

  return (
    <TaxonomyProvider initialData={taxonomy}>
      <TaxonomyVisualization />
    </TaxonomyProvider>
  )
}

// Client-side updates with React Query
export function useTaxonomyNodes() {
  return useQuery({
    queryKey: ['taxonomy', 'nodes'],
    queryFn: fetchTaxonomyNodes,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,   // 10 minutes
  })
}

// Infinite scrolling for large lists
export function useInfiniteContent() {
  return useInfiniteQuery({
    queryKey: ['content'],
    queryFn: ({ pageParam }) => fetchContent({ page: pageParam }),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: 0,
  })
}
```

### 8.3 Rendering Optimization

```typescript
// Virtual scrolling for large lists
import { FixedSizeList } from 'react-window'

export function ContentList({ items }: { items: Content[] }) {
  const Row = memo(({ index, style }) => (
    <div style={style}>
      <ContentCard content={items[index]} />
    </div>
  ))

  return (
    <FixedSizeList
      height={600}
      itemCount={items.length}
      itemSize={120}
      width="100%"
    >
      {Row}
    </FixedSizeList>
  )
}

// Debounced search
export function useDebounce<T>(value: T, delay = 300): T {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}
```

---

## 9. Design System

### 9.1 Theme Configuration

```typescript
// tailwind.config.ts
export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          500: '#3b82f6',
          900: '#1e3a8a',
        },
        success: {
          50: '#f0fdf4',
          500: '#22c55e',
          900: '#14532d',
        },
        warning: {
          50: '#fefce8',
          500: '#eab308',
          900: '#713f12',
        },
        danger: {
          50: '#fef2f2',
          500: '#ef4444',
          900: '#7f1d1d',
        },
      },
      animation: {
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'pulse-soft': 'pulseSoft 2s infinite',
      },
      fontFamily: {
        sans: ['Inter var', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
    require('tailwindcss-animate'),
  ],
};
```

### 9.2 Component Library

```typescript
// components/ui/Button/Button.tsx
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, icon, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-md font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          'disabled:pointer-events-none disabled:opacity-50',
          buttonVariants[variant],
          buttonSizes[size],
          props.className
        )}
        disabled={loading || props.disabled}
        {...props}
      >
        {loading ? <Spinner className="mr-2" /> : icon}
        {children}
      </button>
    )
  }
)
```

---

## 10. Testing Strategy

### 10.1 Unit Testing

```typescript
// tests/unit/components/Button.test.tsx
import { render, screen } from '@testing-library/react'
import { Button } from '@/components/ui/Button'

describe('Button', () => {
  it('renders with correct text', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button')).toHaveTextContent('Click me')
  })

  it('handles click events', async () => {
    const handleClick = vi.fn()
    render(<Button onClick={handleClick}>Click</Button>)
    await userEvent.click(screen.getByRole('button'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })
})
```

### 10.2 E2E Testing

```typescript
// tests/e2e/content-generation.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Content Generation Flow', () => {
  test('should generate content through wizard', async ({ page }) => {
    await page.goto('/generate/wizard');

    // Step 1: Select pages
    await page.click('[data-testid="category-winter-boots"]');
    await page.click('[data-testid="next-step"]');

    // Step 2: Choose template
    await page.click('[data-testid="template-hero-features"]');
    await page.click('[data-testid="next-step"]');

    // Step 3: Configure
    await page.selectOption('[data-testid="language-select"]', 'en');
    await page.selectOption('[data-testid="tone-select"]', 'professional');

    // Step 4: Generate
    await page.click('[data-testid="generate-button"]');

    // Verify success
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
  });
});
```

---

## 11. Security & Authentication

### 11.1 Authentication Flow

```typescript
// lib/supabase/auth.ts
export const authConfig = {
  providers: ['email', 'google', 'github'],
  redirectTo: '/dashboard',
  authCallbackUrl: '/auth/callback',
  passwordPolicy: {
    minLength: 8,
    requireUppercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
  },
};

// middleware.ts
export async function middleware(request: NextRequest) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthRoute = authRoutes.includes(request.nextUrl.pathname);

  if (!user && !isAuthRoute) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}
```

### 11.2 Security Headers

```typescript
// next.config.ts security headers
const securityHeaders = [
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block',
  },
  {
    key: 'Content-Security-Policy',
    value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' *.supabase.co",
  },
];
```

---

## 12. Deployment & DevOps

### 12.1 Environment Configuration

```bash
# .env.local
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxx
SUPABASE_SERVICE_KEY=xxxxx
OPENAI_API_KEY=xxxxx
RESEND_API_KEY=xxxxx

# .env.production
NEXT_PUBLIC_APP_URL=https://contentmax.ai
# ... production values
```

### 12.2 CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
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
          node-version: '20'
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm run test:unit
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

---

## 13. Performance Monitoring

### 13.1 Metrics Collection

```typescript
// lib/analytics/performance.ts
export const performanceMetrics = {
  // Core Web Vitals
  trackWebVitals: () => {
    if (typeof window !== 'undefined') {
      import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
        getCLS(sendToAnalytics);
        getFID(sendToAnalytics);
        getFCP(sendToAnalytics);
        getLCP(sendToAnalytics);
        getTTFB(sendToAnalytics);
      });
    }
  },

  // Custom metrics
  trackTaxonomyLoad: (nodeCount: number, loadTime: number) => {
    analytics.track('taxonomy_load', {
      node_count: nodeCount,
      load_time_ms: loadTime,
      performance_score: calculatePerformanceScore(nodeCount, loadTime),
    });
  },

  trackGenerationTime: (contentType: string, duration: number) => {
    analytics.track('content_generation', {
      content_type: contentType,
      duration_ms: duration,
      success: true,
    });
  },
};
```

### 13.2 Error Tracking

```typescript
// lib/monitoring/sentry.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  beforeSend(event) {
    // Filter out sensitive data
    if (event.request?.cookies) {
      delete event.request.cookies;
    }
    return event;
  },
});
```

---

## 14. Mobile Responsiveness

### 14.1 Breakpoint System

```scss
// Tailwind breakpoints
$breakpoints: (
  'sm': 640px,
  // Mobile landscape
  'md': 768px,
  // Tablet
  'lg': 1024px,
  // Desktop
  'xl': 1280px,
  // Large desktop
  '2xl': 1536px, // Extra large
);
```

### 14.2 Mobile-First Components

```typescript
// Responsive navigation
export function Navigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <>
      {/* Desktop Navigation */}
      <nav className="hidden lg:flex items-center space-x-6">
        {/* ... */}
      </nav>

      {/* Mobile Navigation */}
      <div className="lg:hidden">
        <button onClick={() => setMobileMenuOpen(true)}>
          <MenuIcon />
        </button>

        <MobileMenu
          open={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
        />
      </div>
    </>
  )
}
```

---

## 15. Accessibility Standards

### 15.1 WCAG 2.1 AA Compliance

```typescript
// Accessibility utilities
export const a11y = {
  // Skip to main content
  skipLink: (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4"
    >
      Skip to main content
    </a>
  ),

  // Screen reader only text
  srOnly: 'absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0',

  // Focus trap for modals
  trapFocus: (element: HTMLElement) => {
    const focusableElements = element.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const firstElement = focusableElements[0] as HTMLElement
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

    element.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault()
          lastElement.focus()
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault()
          firstElement.focus()
        }
      }
    })
  }
}
```

### 15.2 ARIA Implementation

```typescript
// Proper ARIA labels
<div
  role="application"
  aria-label="Content taxonomy visualization"
  aria-describedby="taxonomy-help"
>
  <div role="tree" aria-multiselectable="true">
    <div
      role="treeitem"
      aria-expanded={expanded}
      aria-selected={selected}
      aria-level={depth}
      tabIndex={0}
    >
      {node.label}
    </div>
  </div>
</div>
```

---

## 16. Browser Support

### Minimum Requirements

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Mobile Safari 14+
- Chrome Mobile 90+

### Progressive Enhancement

```typescript
// Feature detection
export const features = {
  webgl: () => {
    try {
      const canvas = document.createElement('canvas');
      return !!(
        window.WebGLRenderingContext &&
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
      );
    } catch (e) {
      return false;
    }
  },

  serviceWorker: 'serviceWorker' in navigator,

  intersectionObserver: 'IntersectionObserver' in window,
};

// Polyfills loaded conditionally
if (!features.intersectionObserver) {
  import('intersection-observer');
}
```

---

## 17. Development Workflow

### 17.1 Git Flow

```bash
main
├── develop
│   ├── feature/taxonomy-visualization
│   ├── feature/speed-review
│   └── feature/content-generation
├── release/v1.0.0
└── hotfix/critical-bug-fix
```

### 17.2 Code Review Checklist

- [ ] TypeScript types properly defined
- [ ] Components have proper error boundaries
- [ ] Accessibility requirements met (ARIA, keyboard nav)
- [ ] Mobile responsive design verified
- [ ] Performance metrics within targets
- [ ] Unit tests cover critical paths
- [ ] Documentation updated
- [ ] No console.logs or debugger statements
- [ ] Security best practices followed
- [ ] Proper error handling implemented

---

## 18. Launch Readiness

### Pre-Launch Checklist

- [ ] All critical user flows tested end-to-end
- [ ] Performance metrics meet targets (<2s load for 10k nodes)
- [ ] SEO meta tags and sitemap configured
- [ ] Analytics and error tracking integrated
- [ ] Security audit completed
- [ ] Load testing completed (1000 concurrent users)
- [ ] Backup and disaster recovery tested
- [ ] Documentation complete for all features
- [ ] Legal compliance verified (GDPR, CCPA)
- [ ] Customer support workflows established

### Post-Launch Monitoring

- Real-time error tracking via Sentry
- Performance monitoring with Vercel Analytics
- User behavior tracking with PostHog
- Database performance via Supabase Dashboard
- API usage monitoring
- Weekly performance reviews

---

## Appendix A: Quick Start Guide

```bash
# Clone and setup
git clone https://github.com/contentmax/contentmax
cd contentmax
npm install

# Environment setup
cp .env.example .env.local
# Add your Supabase and OpenAI keys

# Database setup
npx supabase db push
npx supabase db seed

# Development
npm run dev

# Testing
npm run test:unit
npm run test:e2e

# Production build
npm run build
npm run start
```

---

## Appendix B: Troubleshooting

### Common Issues

1. **WebGL not working**: Fallback to Canvas rendering
2. **Slow taxonomy load**: Check viewport culling and LOD
3. **Memory leaks**: Verify cleanup in useEffect hooks
4. **Auth issues**: Check Supabase RLS policies
5. **Generation timeout**: Implement queue system with retries

---

This specification provides the complete technical blueprint for building ContentMax's frontend. Each section can be used as a reference during development, ensuring consistency and quality across the entire application.
