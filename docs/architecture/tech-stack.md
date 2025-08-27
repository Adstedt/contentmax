# ContentMax Technology Stack

## Overview

This document defines the complete technology stack for ContentMax, including frameworks, libraries, services, and tools used throughout the application.

## Core Technologies

### Frontend Framework

**Next.js 15** (App Router)

- **Version**: 15.x with App Router
- **Why**: Server-side rendering, API routes, optimized performance, excellent DX
- **Key Features Used**:
  - App Router for file-based routing
  - Server Components for improved performance
  - API Routes for backend endpoints
  - Image optimization
  - Built-in TypeScript support

### Language & Type Safety

**TypeScript 5.x**

- **Version**: 5.3+
- **Config**: Strict mode enabled
- **Why**: Type safety, better IDE support, reduced runtime errors
- **Key Configurations**:
  ```json
  {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "esModuleInterop": true
  }
  ```

## UI & Styling

### CSS Framework

**Tailwind CSS 3.x**

- **Version**: 3.4+
- **Why**: Utility-first, excellent DX, small bundle size
- **Plugins**:
  - @tailwindcss/forms
  - @tailwindcss/typography
  - @tailwindcss/container-queries

### Component Library

**Shadcn/UI**

- **Why**: Copy-paste components, full control, TypeScript support
- **Components Used**:
  - Button, Card, Dialog, Select
  - Form components with react-hook-form
  - Toast notifications
  - Data tables

### Icons

**Lucide React**

- **Why**: Consistent icon set, tree-shakeable, TypeScript support
- **Usage**: UI icons throughout the application

## State Management & Data Fetching

### Server State

**TanStack Query (React Query) v5**

- **Version**: 5.x
- **Why**: Powerful caching, optimistic updates, background refetching
- **Use Cases**: API data fetching, server state synchronization

### Client State

**Zustand**

- **Version**: 4.x
- **Why**: Simple API, TypeScript support, minimal boilerplate
- **Use Cases**: UI state, user preferences, temporary client data

### Forms

**React Hook Form + Zod**

- **React Hook Form**: 7.x
- **Zod**: 3.x
- **Why**: Performance, validation, TypeScript integration
- **Usage**: All forms with schema validation

## Backend & Database

### Database & Auth

**Supabase**

- **Why**: PostgreSQL, real-time, authentication, storage in one
- **Features Used**:
  - PostgreSQL database
  - Row Level Security (RLS)
  - Authentication (email/password + OAuth)
  - Real-time subscriptions
  - Storage for file uploads
  - Edge Functions for serverless compute

### ORM/Query Builder

**Supabase Client**

- **Version**: 2.x
- **Why**: Type-safe queries, real-time subscriptions
- **Usage**: All database operations

## AI & Content Generation

### AI Provider

**OpenAI API**

- **Models**: GPT-4o-mini (primary), GPT-4o (premium)
- **Why**: Best-in-class language models, reliable API
- **Features**:
  - Structured outputs
  - Streaming responses
  - Function calling

### Template Engine

**Handlebars.js**

- **Version**: 4.x
- **Why**: Simple, powerful, secure templating
- **Usage**: Content templates

## Data Visualization

### Charting

**D3.js + Canvas**

- **D3.js**: 7.x
- **Why**: Most powerful visualization library
- **Usage**: Force-directed taxonomy graph (3,000 nodes)
- **Optimization**: Canvas rendering for performance

### Simple Charts

**Recharts**

- **Version**: 2.x
- **Why**: React-friendly, simple API
- **Usage**: Dashboard analytics, simple charts

## External Services

### Payment Processing

**Stripe**

- **Products**: Checkout, Billing, Subscriptions
- **Why**: Industry standard, excellent docs, reliable
- **Integration**: Stripe SDK + webhooks

### Email Service

**Resend**

- **Why**: Developer-friendly, React Email support
- **Usage**: Transactional emails, notifications

### Monitoring & Analytics

**Sentry**

- **Why**: Error tracking, performance monitoring
- **Usage**: Production error tracking

**Vercel Analytics**

- **Why**: Built-in with Vercel, Web Vitals
- **Usage**: Performance metrics

**PostHog** (Optional)

- **Why**: Product analytics, feature flags
- **Usage**: User behavior tracking

### Search Service

**Algolia** (Future)

- **Why**: Fast search, typo tolerance
- **Usage**: Content search (post-MVP)

## Development Tools

### Package Manager

**pnpm**

- **Version**: 8.x
- **Why**: Fast, efficient disk usage, strict dependencies
- **Config**: Workspace support for monorepo (future)

### Code Quality

**ESLint**

- **Version**: 8.x
- **Config**: Next.js recommended + custom rules
- **Why**: Code consistency, catch errors

**Prettier**

- **Version**: 3.x
- **Config**: Consistent formatting
- **Integration**: Pre-commit hooks

**Husky + lint-staged**

- **Why**: Automated pre-commit checks
- **Hooks**: Linting, formatting, type checking

### Testing

**Jest + React Testing Library**

- **Jest**: 29.x
- **RTL**: 14.x
- **Why**: Standard React testing tools
- **Coverage**: Unit and integration tests

**Playwright**

- **Version**: 1.40+
- **Why**: Cross-browser E2E testing
- **Usage**: Critical user flows

### Build & Deploy

**Vercel**

- **Why**: Native Next.js support, excellent DX
- **Features**:
  - Preview deployments
  - Edge functions
  - Analytics
  - Automatic HTTPS

### CI/CD

**GitHub Actions**

- **Why**: Native GitHub integration
- **Workflows**:
  - Test on PR
  - Deploy to preview
  - Production deployment

## Development Environment

### IDE

**VS Code** (Recommended)

- **Extensions**:
  - ESLint
  - Prettier
  - Tailwind CSS IntelliSense
  - TypeScript Vue Plugin
  - Prisma (if using)

### Browser Extensions

- React Developer Tools
- Redux DevTools (for Zustand)
- Lighthouse

## Version Control

**Git + GitHub**

- **Branching Strategy**: GitHub Flow
- **PR Requirements**:
  - Passing tests
  - Code review
  - No merge conflicts

## Security Libraries

**Security Headers**

```typescript
// Dependencies
- helmet (Next.js middleware)
- @supabase/auth-helpers-nextjs
- bcryptjs (if needed)
- jsonwebtoken (for custom tokens)
```

**Rate Limiting**

```typescript
- express-rate-limit (API routes)
- p-queue (client-side)
```

## Performance Optimization

**Bundle Optimization**

- @next/bundle-analyzer
- Dynamic imports for code splitting
- Tree shaking enabled

**Image Optimization**

- Next.js Image component
- Sharp for image processing
- Cloudinary (future CDN)

## Utility Libraries

### Date & Time

**date-fns**

- **Version**: 3.x
- **Why**: Modular, tree-shakeable
- **Usage**: Date formatting and manipulation

### HTTP Client

**Native Fetch API**

- **Why**: Built-in, standards-compliant
- **Wrapper**: Custom fetch wrapper with retry logic

### Validation

**Zod**

- **Version**: 3.x
- **Why**: TypeScript-first schema validation
- **Usage**: API validation, form validation

### Utilities

```typescript
- clsx + tailwind-merge (className utilities)
- lodash-es (specific utilities only)
- uuid (ID generation)
- slugify (URL slug generation)
```

## Environment Setup

### Required Node Version

```json
{
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=8.0.0"
  }
}
```

### Environment Variables

```env
# Public (exposed to client)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_APP_URL=

# Server-only
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
RESEND_API_KEY=
```

## Architecture Decisions

### Why This Stack?

1. **Next.js + TypeScript**: Industry standard for React apps, excellent DX
2. **Supabase**: Complete backend solution, reduces complexity
3. **Tailwind + Shadcn**: Rapid UI development with consistency
4. **TanStack Query**: Best-in-class server state management
5. **Vercel**: Seamless Next.js deployment

### Trade-offs

**Chose Simplicity Over**:

- Microservices → Monolithic Next.js app
- GraphQL → REST + RPC
- Kubernetes → Vercel PaaS
- Custom auth → Supabase Auth

**Chose Power Where Needed**:

- D3.js for complex visualizations
- OpenAI for best AI capabilities
- PostgreSQL for relational data

### Future Considerations

**Potential Additions**:

- Redis for caching (if needed)
- ElasticSearch for advanced search
- WebSockets for real-time collaboration
- CDN for global content delivery

## Upgrade Policy

- **Security patches**: Immediate
- **Minor versions**: Monthly review
- **Major versions**: Quarterly evaluation
- **Breaking changes**: Planned migrations

## Support Matrix

All technologies chosen have:

- Active maintenance
- Strong community
- Good documentation
- TypeScript support
- At least 2 years runway
