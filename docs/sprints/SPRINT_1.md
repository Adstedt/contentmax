# Sprint 1: Foundation Setup

## Week 1 - Database & Core Infrastructure

### Sprint Goal

Establish the foundational database architecture and successfully import initial taxonomy data from sitemap/Shopify sources.

### Success Criteria

- [ ] Supabase project fully configured
- [ ] Database schema deployed and tested
- [ ] 1000+ category nodes imported from sitemap
- [ ] Basic CRUD operations functional
- [ ] Parent-child relationships validated

---

## Technical Tasks

### 1.1 Supabase Project Setup

**Priority**: P0 - Blocker
**Estimate**: 2 hours

```bash
# Environment variables needed
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

**Acceptance Criteria**:

- Project created with correct region
- Authentication configured
- Environment variables set
- Connection tested from Next.js

### 1.2 Database Schema Creation

**Priority**: P0 - Blocker  
**Estimate**: 4 hours

```sql
-- Run in Supabase SQL editor
CREATE TABLE category_nodes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  url TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  parent_id UUID REFERENCES category_nodes(id),
  level INTEGER NOT NULL,
  product_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_nodes_parent ON category_nodes(parent_id);
CREATE INDEX idx_nodes_url ON category_nodes(url);
CREATE INDEX idx_nodes_level ON category_nodes(level);
```

### 1.3 Sitemap Parser Implementation

**Priority**: P0 - Critical
**Estimate**: 6 hours

**File**: `lib/parsers/sitemap-parser.ts`

```typescript
interface SitemapNode {
  url: string;
  title: string;
  lastmod?: string;
  priority?: number;
}

export async function parseSitemap(url: string): Promise<SitemapNode[]> {
  // Implementation here
}

export function buildHierarchy(nodes: SitemapNode[]): CategoryNode[] {
  // Convert flat list to tree structure
}
```

### 1.4 Data Import API

**Priority**: P0 - Critical
**Estimate**: 4 hours

**Endpoint**: `POST /api/import/sitemap`

```typescript
// app/api/import/sitemap/route.ts
export async function POST(request: Request) {
  const { sitemapUrl } = await request.json();

  // 1. Parse sitemap
  // 2. Build hierarchy
  // 3. Batch insert to database
  // 4. Return import statistics
}
```

### 1.5 Basic CRUD Operations

**Priority**: P1 - High
**Estimate**: 3 hours

```typescript
// lib/db/nodes.ts
export const nodeOperations = {
  create: async (node: Partial<CategoryNode>) => {},
  read: async (id: string) => {},
  update: async (id: string, updates: Partial<CategoryNode>) => {},
  delete: async (id: string) => {},
  list: async (filters?: NodeFilters) => {},
};
```

---

## Testing Requirements

### Unit Tests

```typescript
// __tests__/sitemap-parser.test.ts
describe('Sitemap Parser', () => {
  test('parses XML sitemap correctly', async () => {});
  test('handles malformed XML gracefully', async () => {});
  test('builds hierarchy from flat structure', () => {});
  test('detects circular references', () => {});
});
```

### Integration Tests

- Database connection and operations
- Sitemap import end-to-end
- Parent-child relationship integrity
- Bulk import performance (1000+ nodes)

---

## Definition of Done

- [ ] All code reviewed and merged to main
- [ ] Unit tests passing with >80% coverage
- [ ] Integration tests passing
- [ ] Database migrations documented
- [ ] Import tested with real sitemap
- [ ] Performance validated (<30s for 1000 nodes)
- [ ] Error handling implemented
- [ ] Logging configured

---

## Dependencies

- Supabase account created (see EXTERNAL_SERVICES_SETUP.md)
- Sample sitemap available for testing
- Database backup strategy defined

---

## Risk Mitigation

| Risk                       | Mitigation                               |
| -------------------------- | ---------------------------------------- |
| Sitemap format variations  | Support multiple formats, add validation |
| Large sitemap performance  | Implement streaming parser               |
| Database connection issues | Add retry logic, connection pooling      |
| Circular references        | Add cycle detection algorithm            |

---

## Sprint Review Prep

**Demo Script**:

1. Show database schema in Supabase
2. Import sample sitemap via UI
3. Display imported nodes in table view
4. Show parent-child relationships
5. Demonstrate CRUD operations

**Metrics to Share**:

- Nodes imported: 1000+
- Import time: <30 seconds
- Database size: X MB
- Query performance: <50ms avg

---

## Next Sprint Preview

Sprint 2 will focus on:

- Google Search Console integration
- GA4 connection setup
- Metrics enrichment pipeline
- Data matching algorithms

**Handoff Requirements**:

- Database populated with test data
- Node ID system established
- URL structure documented
- API patterns defined
