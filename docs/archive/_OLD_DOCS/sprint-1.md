# Sprint 1: Foundation & Core Setup

## Sprint Goal

Establish project foundation, authentication system, and basic dashboard interface.

## Duration

2 weeks

## Sprint Overview

This sprint lays the groundwork for the entire ContentMax application. Focus is on creating a solid technical foundation with Next.js 15, Supabase authentication, and core UI components.

---

## Tasks

### Task 1.1: Project Initialization

**Size**: M (4 hours) | **Priority**: P0 - Critical | **Dependencies**: None

**Implementation Steps**:

```bash
# Create Next.js app with TypeScript
npx create-next-app@latest contentmax --typescript --tailwind --app --src-dir --import-alias "@/*"

# Configure development tools
npm install -D eslint prettier husky lint-staged
npm install -D @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

**Files to Create/Modify**:

- `package.json` - Exact versions from architecture
- `tailwind.config.ts` - Custom design system configuration
- `.eslintrc.json` - Linting rules
- `.prettierrc` - Code formatting rules
- `tsconfig.json` - TypeScript configuration

**Acceptance Criteria**:

- [ ] Next.js 15 project initialized with TypeScript
- [ ] Tailwind CSS configured with custom design tokens
- [ ] ESLint and Prettier working with pre-commit hooks
- [ ] Folder structure matches architecture spec
- [ ] Environment variables template created

---

### Task 1.2: Supabase Setup & Database Schema

**Size**: L (8 hours) | **Priority**: P0 - Critical | **Dependencies**: Task 1.1

**Implementation Steps**:

1. Create Supabase project and get credentials
2. Install Supabase client libraries
3. Create initial database schema migration
4. Set up type generation

```sql
-- Core tables needed in migration
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  organization_id UUID REFERENCES organizations(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Additional tables: projects, taxonomy_nodes, content_items, generation_queue
```

**Files to Create**:

- `supabase/migrations/001_initial_schema.sql`
- `lib/supabase/client.ts` - Client-side Supabase instance
- `lib/supabase/server.ts` - Server-side Supabase instance
- `types/database.types.ts` - Generated database types

**Acceptance Criteria**:

- [ ] Supabase project created and configured
- [ ] Database schema migration applied successfully
- [ ] Type-safe database client configured
- [ ] Connection tested from Next.js app

---

### Task 1.3: Authentication Implementation

**Size**: L (8 hours) | **Priority**: P0 - Critical | **Dependencies**: Task 1.2

**Implementation Steps**:

1. Configure Supabase Auth with Google OAuth
2. Create authentication UI components
3. Set up middleware for route protection
4. Implement login/signup flows

**Files to Create**:

- `app/auth/login/page.tsx` - Login page
- `app/auth/signup/page.tsx` - Signup page
- `app/auth/callback/route.ts` - OAuth callback handler
- `middleware.ts` - Route protection middleware
- `components/auth/LoginForm.tsx` - Login form component
- `components/auth/SignupForm.tsx` - Signup form component

**Technical Notes**:

- Use Supabase Auth with email/password + Google OAuth
- Implement proper error handling for auth failures
- Add loading states during authentication

**Acceptance Criteria**:

- [ ] Users can sign up with email/password
- [ ] Google OAuth login working
- [ ] Protected routes redirect unauthenticated users
- [ ] User session persists across browser refreshes
- [ ] Proper error handling for auth failures

---

### Task 1.4: Basic Dashboard UI

**Size**: M (4 hours) | **Priority**: P0 - Critical | **Dependencies**: Task 1.3

**Implementation Steps**:

1. Create dashboard layout with sidebar and header
2. Add placeholder metric cards
3. Implement basic navigation structure

**Files to Create**:

- `app/dashboard/page.tsx` - Main dashboard page
- `components/dashboard/MetricCard.tsx` - Metric display component
- `components/layout/Sidebar.tsx` - Navigation sidebar
- `components/layout/Header.tsx` - Top header with user menu

**UI Requirements**:

- Responsive layout for desktop and mobile
- Clean, professional design following Tailwind patterns
- Placeholder metrics: "Sites Analyzed", "Content Generated", "Pages Published"

**Acceptance Criteria**:

- [ ] Dashboard loads after authentication
- [ ] Sidebar navigation functional
- [ ] Header shows user info and logout option
- [ ] Responsive design works on mobile
- [ ] Metric cards display placeholder data

---

### Task 1.5: Component Library Setup

**Size**: S (2 hours) | **Priority**: P1 - High | **Dependencies**: Task 1.1

**Implementation Steps**:

1. Create base UI components using Tailwind
2. Implement consistent styling patterns
3. Add TypeScript prop interfaces

**Files to Create**:

- `components/ui/Button.tsx` - Reusable button component
- `components/ui/Card.tsx` - Card container component
- `components/ui/Input.tsx` - Form input component
- `components/ui/Select.tsx` - Dropdown select component
- `components/ui/Modal.tsx` - Modal dialog component

**Design Requirements**:

- Follow consistent color scheme and spacing
- Include hover states and focus management
- Support different sizes and variants
- Accessible with proper ARIA attributes

**Acceptance Criteria**:

- [ ] All base UI components implemented
- [ ] Components follow consistent design patterns
- [ ] TypeScript interfaces defined for all props
- [ ] Components used in dashboard implementation

---

## Dependencies & Prerequisites

**External Dependencies**:

- Supabase project created with valid credentials
- Google OAuth app configured for authentication
- Domain configured for OAuth callbacks

**Technical Prerequisites**:

- Node.js 18+ installed
- Git repository initialized
- Access to Supabase dashboard

---

## Definition of Done

**Sprint 1 is complete when**:

- [ ] User can create account and log in successfully
- [ ] Dashboard loads with basic layout and navigation
- [ ] All authentication flows working (email/password + Google OAuth)
- [ ] Protected routes redirect unauthenticated users appropriately
- [ ] Basic UI component library established and documented
- [ ] Database schema initialized with core tables
- [ ] Development environment fully configured with linting/formatting

**Demo Criteria**:

- Show complete signup → login → dashboard flow
- Demonstrate responsive design on different screen sizes
- Show Google OAuth integration working
- Display placeholder metrics in dashboard

---

## Technical Warnings

⚠️ **Critical Setup Items**:

- Ensure Supabase Row Level Security (RLS) is configured properly
- Test OAuth callback URLs in both development and production
- Verify environment variables are properly secured
- Double-check database migration runs successfully

⚠️ **Common Pitfalls**:

- Supabase client/server configuration differences
- OAuth redirect URI mismatches
- Middleware infinite redirect loops
- TypeScript strict mode configuration issues

---

## Success Metrics

- **Authentication Success Rate**: >95% for valid credentials
- **Page Load Time**: Dashboard loads in <2 seconds
- **Mobile Responsiveness**: All screens usable on 375px+ width
- **Error Handling**: No unhandled promise rejections in auth flows
