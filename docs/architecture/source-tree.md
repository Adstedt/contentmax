# ContentMax Source Tree Structure

## Overview
This document defines the project structure and organization for ContentMax, following Next.js 15 App Router conventions and best practices.

## Root Directory Structure
```
contentmax/
├── .github/                  # GitHub specific files
│   └── workflows/           # CI/CD workflows
├── .husky/                  # Git hooks
├── .next/                   # Next.js build output (gitignored)
├── app/                     # Next.js App Router
├── components/              # React components
├── hooks/                   # Custom React hooks
├── lib/                     # Core business logic & utilities
├── prisma/                  # Database schema & migrations (if using Prisma)
├── public/                  # Static assets
├── supabase/               # Supabase specific files
├── tests/                  # Test files
├── types/                  # TypeScript type definitions
├── .env.local              # Local environment variables (gitignored)
├── .env.example            # Example environment variables
├── .eslintrc.json          # ESLint configuration
├── .gitignore              # Git ignore rules
├── .prettierrc             # Prettier configuration
├── components.json         # Shadcn/ui configuration
├── middleware.ts           # Next.js middleware
├── next.config.js          # Next.js configuration
├── package.json            # Dependencies and scripts
├── pnpm-lock.yaml         # Lock file
├── README.md              # Project documentation
├── tailwind.config.ts     # Tailwind configuration
└── tsconfig.json          # TypeScript configuration
```

## Detailed Structure

### `/app` - Next.js App Router
```
app/
├── (auth)/                    # Auth group layout
│   ├── login/
│   │   └── page.tsx          # Login page
│   ├── signup/
│   │   └── page.tsx          # Signup page
│   └── layout.tsx            # Auth layout
├── (dashboard)/              # Dashboard group layout
│   ├── dashboard/
│   │   └── page.tsx          # Dashboard home
│   ├── content/
│   │   ├── page.tsx          # Content list
│   │   └── [id]/
│   │       └── page.tsx      # Content detail
│   ├── generate/
│   │   └── page.tsx          # Content generation
│   ├── taxonomy/
│   │   └── page.tsx          # Taxonomy visualization
│   ├── templates/
│   │   ├── page.tsx          # Template list
│   │   └── [id]/
│   │       └── page.tsx      # Template editor
│   ├── settings/
│   │   └── page.tsx          # User settings
│   └── layout.tsx            # Dashboard layout
├── api/                      # API routes
│   ├── auth/
│   │   └── [...supabase]/
│   │       └── route.ts      # Supabase auth handler
│   ├── content/
│   │   ├── route.ts          # GET, POST content
│   │   └── [id]/
│   │       └── route.ts      # GET, PUT, DELETE content
│   ├── generate/
│   │   ├── route.ts          # Generate content
│   │   └── stream/
│   │       └── route.ts      # Streaming generation
│   ├── scrape/
│   │   └── route.ts          # Web scraping
│   ├── taxonomy/
│   │   └── route.ts          # Taxonomy operations
│   └── webhooks/
│       ├── stripe/
│       │   └── route.ts      # Stripe webhooks
│       └── supabase/
│           └── route.ts      # Supabase webhooks
├── layout.tsx                # Root layout
├── page.tsx                  # Landing page
├── loading.tsx               # Loading UI
├── error.tsx                 # Error UI
├── not-found.tsx            # 404 page
└── globals.css              # Global styles
```

### `/components` - React Components
```
components/
├── ui/                       # Shadcn/ui components
│   ├── button.tsx
│   ├── card.tsx
│   ├── dialog.tsx
│   ├── form.tsx
│   ├── input.tsx
│   ├── select.tsx
│   ├── toast.tsx
│   └── ...
├── auth/                     # Authentication components
│   ├── login-form.tsx
│   ├── signup-form.tsx
│   ├── oauth-buttons.tsx
│   └── user-nav.tsx
├── content/                  # Content components
│   ├── content-card.tsx
│   ├── content-list.tsx
│   ├── content-editor.tsx
│   └── content-preview.tsx
├── dashboard/                # Dashboard components
│   ├── metric-card.tsx
│   ├── recent-activity.tsx
│   ├── stats-overview.tsx
│   └── chart-container.tsx
├── generation/              # Generation components
│   ├── template-selector.tsx
│   ├── generation-form.tsx
│   ├── generation-progress.tsx
│   └── bulk-generator.tsx
├── layout/                  # Layout components
│   ├── header.tsx
│   ├── sidebar.tsx
│   ├── footer.tsx
│   └── mobile-nav.tsx
├── scraper/                 # Scraping components
│   ├── url-input.tsx
│   ├── scrape-results.tsx
│   └── scraper-monitor.tsx
├── taxonomy/                # Taxonomy components
│   ├── taxonomy-graph.tsx
│   ├── node-details.tsx
│   ├── graph-controls.tsx
│   └── minimap.tsx
├── templates/               # Template components
│   ├── template-card.tsx
│   ├── template-editor.tsx
│   ├── template-preview.tsx
│   └── variable-manager.tsx
└── shared/                  # Shared components
    ├── loading-spinner.tsx
    ├── error-boundary.tsx
    ├── empty-state.tsx
    └── confirmation-dialog.tsx
```

### `/lib` - Core Logic & Utilities
```
lib/
├── api/                     # API client utilities
│   ├── client.ts           # API client wrapper
│   ├── error-handler.ts    # API error handling
│   └── types.ts            # API types
├── auth/                    # Authentication logic
│   ├── auth-helpers.ts
│   ├── permissions.ts
│   └── session.ts
├── content/                 # Content logic
│   ├── content-service.ts
│   ├── content-validator.ts
│   └── content-transformer.ts
├── generation/              # Generation logic
│   ├── generation-pipeline.ts
│   ├── prompt-builder.ts
│   ├── template-compiler.ts
│   └── batch-processor.ts
├── integrations/            # Third-party integrations
│   ├── openai/
│   │   ├── client.ts
│   │   ├── retry-policy.ts
│   │   └── stream-handler.ts
│   ├── stripe/
│   │   ├── client.ts
│   │   └── subscription.ts
│   └── resend/
│       └── email-service.ts
├── scraper/                 # Scraping logic
│   ├── scraper.ts
│   ├── content-extractor.ts
│   └── rate-limiter.ts
├── supabase/               # Supabase utilities
│   ├── client.ts           # Browser client
│   ├── server.ts           # Server client
│   ├── admin.ts            # Admin client
│   └── middleware.ts       # Auth middleware
├── taxonomy/               # Taxonomy logic
│   ├── taxonomy-service.ts
│   ├── graph-builder.ts
│   └── clustering.ts
├── utils/                  # General utilities
│   ├── cn.ts              # className utility
│   ├── format.ts          # Formatting helpers
│   ├── validation.ts      # Validation schemas
│   └── constants.ts       # App constants
└── visualization/          # D3 visualization
    ├── force-simulation.ts
    ├── renderer.ts
    └── interactions.ts
```

### `/hooks` - Custom React Hooks
```
hooks/
├── use-auth.ts            # Authentication hook
├── use-content.ts         # Content management
├── use-debounce.ts       # Debounce utility
├── use-intersection.ts   # Intersection observer
├── use-local-storage.ts  # Local storage sync
├── use-media-query.ts    # Responsive design
├── use-pagination.ts     # Pagination logic
├── use-search.ts         # Search functionality
├── use-toast.ts          # Toast notifications
└── use-websocket.ts      # WebSocket connection
```

### `/types` - TypeScript Definitions
```
types/
├── api.ts                # API types
├── auth.ts               # Auth types
├── content.ts            # Content types
├── database.ts           # Database types (generated)
├── generation.ts         # Generation types
├── global.d.ts           # Global type declarations
├── supabase.ts           # Supabase types
├── taxonomy.ts           # Taxonomy types
└── ui.ts                 # UI component types
```

### `/supabase` - Supabase Configuration
```
supabase/
├── migrations/           # Database migrations
│   ├── 001_initial.sql
│   ├── 002_content.sql
│   └── 003_taxonomy.sql
├── functions/           # Edge functions
│   ├── generate/
│   │   └── index.ts
│   └── process/
│       └── index.ts
├── seed.sql            # Seed data
└── config.toml         # Supabase config
```

### `/tests` - Test Files
```
tests/
├── unit/               # Unit tests
│   ├── lib/
│   └── utils/
├── integration/        # Integration tests
│   ├── api/
│   └── services/
├── e2e/               # End-to-end tests
│   ├── auth.spec.ts
│   ├── content.spec.ts
│   └── generation.spec.ts
├── fixtures/          # Test fixtures
└── utils/            # Test utilities
```

### `/public` - Static Assets
```
public/
├── images/
│   ├── logo.svg
│   ├── hero.jpg
│   └── icons/
├── fonts/           # Custom fonts (if any)
└── manifest.json    # PWA manifest
```

## File Naming Conventions

### Components
- React components: `PascalCase.tsx` (e.g., `UserProfile.tsx`)
- Component folders: `kebab-case/` (e.g., `user-profile/`)

### Files
- TypeScript files: `kebab-case.ts` (e.g., `api-client.ts`)
- Test files: `*.test.ts` or `*.spec.ts`
- Config files: `kebab-case.config.ts`

### API Routes
- Route handlers: `route.ts`
- Dynamic routes: `[param]/route.ts`
- Catch-all routes: `[...param]/route.ts`

## Import Path Aliases

Configure in `tsconfig.json`:
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@/components/*": ["./components/*"],
      "@/lib/*": ["./lib/*"],
      "@/hooks/*": ["./hooks/*"],
      "@/types/*": ["./types/*"],
      "@/utils/*": ["./lib/utils/*"],
      "@/styles/*": ["./app/*"]
    }
  }
}
```

## Module Organization Rules

### 1. Barrel Exports
Create `index.ts` files for clean imports:
```typescript
// components/content/index.ts
export * from './content-card';
export * from './content-list';
export * from './content-editor';
```

### 2. Feature Grouping
Group related functionality together:
```
lib/content/
├── service.ts         # Main service
├── validator.ts       # Validation logic
├── transformer.ts     # Data transformation
├── types.ts          # Local types
└── index.ts          # Barrel export
```

### 3. Separation of Concerns
- **Components**: UI only, no business logic
- **Hooks**: Reusable React logic
- **Lib**: Business logic, API calls, utilities
- **Types**: TypeScript definitions

### 4. Server vs Client Code
```
lib/
├── client/          # Client-only code
├── server/          # Server-only code
└── shared/          # Shared utilities
```

## Best Practices

### 1. Component Structure
Each component folder should contain:
```
ComponentName/
├── ComponentName.tsx      # Main component
├── ComponentName.test.tsx # Tests
├── ComponentName.module.css # Styles (if not using Tailwind)
└── index.ts              # Barrel export
```

### 2. API Route Structure
Each API endpoint should have:
```
api/resource/
├── route.ts              # Handler
├── validation.ts         # Input validation
└── types.ts             # Request/Response types
```

### 3. Keep Related Code Together
Feature-based organization over technical organization when it makes sense.

### 4. Avoid Deep Nesting
Maximum 3-4 levels of folder nesting to maintain simplicity.

### 5. Clear Dependencies
- No circular dependencies
- Clear import paths
- Explicit exports

## Migration Notes

When adding new features:
1. Determine if it's a component, hook, or lib
2. Create in appropriate directory
3. Add barrel exports if needed
4. Update this document if structure changes

## CI/CD Considerations

Critical paths for CI/CD:
- `/app` - Pages and API routes
- `/components` - UI components
- `/lib` - Business logic
- `/tests` - Test coverage
- `/public` - Static assets

Build output:
- `.next/` - Build artifacts
- `out/` - Static export (if used)

## Security Considerations

Sensitive file locations:
- `.env.local` - Never commit
- `/lib/server/` - Server-only code
- `/api/` - Secure API endpoints
- `/middleware.ts` - Auth checks

Public exposure:
- `/public/` - Publicly accessible
- `/app/` - Some code sent to client
- Client components marked with 'use client'