# Technical Debt Task: Fix Linting and TypeScript Errors

## Task Overview

**Title:** Fix All Linting and TypeScript Errors Across Codebase  
**Type:** Technical Debt  
**Priority:** P2 - Medium (Non-blocking but impacts code quality)  
**Created:** 2025-01-04  
**Target Sprint:** Post Sprint 5

## Current State

### TypeScript Errors Summary

- **Total Errors:** 195
- **Main Error Types:**
  - TS2339 (98 errors) - Property does not exist on type
  - TS2345 (39 errors) - Argument type mismatch
  - TS2322 (20 errors) - Type assignment issues
  - TS2769 (12 errors) - No overload matches call
  - Other (26 errors) - Various type issues

### Linting Warnings Summary

- **Total Issues:** 584 (1 error, 583 warnings)
- **Main Warning Categories:**
  - `@typescript-eslint/no-explicit-any` - Unexpected any types
  - `@typescript-eslint/no-unused-vars` - Unused variables
  - `react-hooks/exhaustive-deps` - Missing dependencies
  - `no-console` - Console statements in production code

## Root Causes

1. **Database Schema Drift**
   - Supabase type definitions out of sync with actual schema
   - Missing type updates after schema migrations
   - Test mocks not matching current database structure

2. **Test Infrastructure**
   - Mock implementations missing required properties
   - Test utilities lacking proper type definitions
   - Jest matchers not properly typed

3. **Third-party Libraries**
   - Missing or outdated type definitions
   - Incompatible versions between libraries and types

4. **Legacy Code**
   - Pre-TypeScript strict mode code
   - Rushed implementations without proper typing
   - Technical debt from rapid feature development

## Impact Assessment

### Current Impact

- **Development Speed:** Slowed by false positives in IDE
- **Code Quality:** Reduced confidence in type safety
- **CI/CD:** TypeScript checks disabled or ignored
- **New Developer Experience:** Confusion from error noise

### Risk if Not Addressed

- **Growing Debt:** Each new feature adds more errors
- **Type Safety Loss:** Real errors hidden in noise
- **Refactoring Difficulty:** Hard to refactor with broken types
- **Testing Confidence:** Tests may not catch type issues

## Resolution Strategy

### Phase 1: Database Types (40% of errors)

```bash
# Regenerate Supabase types
npx supabase gen types typescript --local > types/database.types.ts

# Update all database queries to use new types
# Fix mock implementations in tests
```

### Phase 2: Test Infrastructure (30% of errors)

- Update test setup files with proper types
- Fix mock implementations to match interfaces
- Add missing test matcher types
- Update jest configuration

### Phase 3: Component Props (20% of errors)

- Add missing prop types
- Fix React hook dependencies
- Remove unused variables
- Replace `any` with proper types

### Phase 4: API Routes (10% of errors)

- Type API request/response objects
- Fix Supabase client usage
- Add proper error handling types

## Detailed Fix Categories

### 1. Database Type Mismatches

**Files Affected:**

- `app/api/*/route.ts`
- `lib/supabase/*.ts`
- Test files using Supabase mocks

**Fix Approach:**

```typescript
// Before
const { data } = await supabase.from('table').select('*');
data.someProperty; // TS2339: Property doesn't exist

// After
import { Database } from '@/types/database.types';
const { data } = await supabase.from('table').select('*');
if (data) {
  data[0].correctProperty; // Properly typed
}
```

### 2. React Hook Dependencies

**Files Affected:**

- Component files with useEffect/useCallback
- Custom hooks

**Fix Approach:**

```typescript
// Add missing dependencies or use eslint-disable if intentional
useEffect(() => {
  // effect code
}, [dependency1, dependency2]); // Add all dependencies
```

### 3. Explicit Any Types

**Files Affected:**

- Utility functions
- API handlers
- Test files

**Fix Approach:**

```typescript
// Before
function processData(data: any): any {}

// After
function processData<T>(data: T): ProcessedData<T> {}
```

### 4. Unused Variables

**Files Affected:**

- Throughout codebase

**Fix Approach:**

```typescript
// Prefix with underscore if intentionally unused
function handler(_req: Request, res: Response) {}

// Or remove if truly unused
```

## Implementation Plan

### Week 1: Preparation

- [ ] Generate fresh database types
- [ ] Audit all TypeScript configurations
- [ ] Create type definition files for missing types
- [ ] Set up proper test type infrastructure

### Week 2: Core Fixes

- [ ] Fix database query types (highest impact)
- [ ] Update test mocks and fixtures
- [ ] Fix API route types
- [ ] Address React component prop types

### Week 3: Cleanup

- [ ] Remove all explicit `any` types
- [ ] Fix React hook dependencies
- [ ] Remove unused variables
- [ ] Address console statements

### Week 4: Validation

- [ ] Run full TypeScript check
- [ ] Run linter with --fix
- [ ] Manual review of remaining issues
- [ ] Update CI/CD to enforce type checking

## Success Criteria

- [ ] Zero TypeScript errors (`npx tsc --noEmit` passes)
- [ ] Less than 50 linting warnings (documentation/intentional)
- [ ] CI/CD pipeline includes TypeScript checking
- [ ] ESLint configuration updated and enforced
- [ ] Developer documentation updated

## Estimated Effort

- **Total Effort:** 40-60 hours
- **Team Size:** 1-2 developers
- **Duration:** 2-4 weeks (part-time)
- **Complexity:** Medium

## Tools and Commands

```bash
# Check TypeScript errors
npx tsc --noEmit

# Count errors by type
npx tsc --noEmit 2>&1 | grep "error TS" | sed 's/.*error TS\([0-9]*\):.*/\1/' | sort | uniq -c | sort -rn

# Fix linting issues automatically
npm run lint -- --fix

# Generate Supabase types
npx supabase gen types typescript --local > types/database.types.ts

# Find unused exports
npx ts-unused-exports tsconfig.json --showLineNumber
```

## Prevention Strategy

### Going Forward

1. **Enable strict TypeScript** in new files
2. **Require type checking** in PR reviews
3. **Add pre-commit hooks** for type checking
4. **Regular type audits** (monthly)
5. **Document type patterns** for common scenarios

### New Development Guidelines

- No new `any` types without justification
- All new code must pass TypeScript strict mode
- Tests must include proper type mocks
- Database schema changes require type regeneration

## Notes

- This is non-blocking for current feature development
- Should be addressed before major refactoring
- Consider breaking into smaller PRs by module
- Coordinate with team to avoid conflicts
- Update this document as fixes are completed

## Related Issues

- Database schema documentation needs update
- Test infrastructure needs overhaul
- Consider migrating to stricter TypeScript config
- May reveal actual bugs currently hidden by type errors
