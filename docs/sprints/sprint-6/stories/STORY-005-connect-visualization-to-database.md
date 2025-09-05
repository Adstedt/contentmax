# STORY-005: Connect Visualization to Database

## Story Overview

**Story ID:** STORY-005  
**Epic:** EPIC-001 - Data Ingestion Pipeline  
**Sprint:** Sprint 6  
**Priority:** P0 - Critical Path  
**Estimated Effort:** 2 hours  
**Story Points:** 2  

## User Story

As a **site owner**,  
I want **the visualization to display my actual site taxonomy**,  
So that **I can see my real categories instead of demo data**.

## Context

Currently, the D3 visualization uses hardcoded demo data. This story connects it to the database to display the real taxonomy imported from sitemaps. This is the critical connection between backend data and frontend visualization.

## Acceptance Criteria

### Functional Requirements
1. ✅ Remove hardcoded demo data
2. ✅ Fetch taxonomy from database API
3. ✅ Display real categories in visualization
4. ✅ Show correct parent-child relationships
5. ✅ Maintain existing visualization features

### Technical Requirements
6. ✅ API endpoint returns database data
7. ✅ Data format matches visualization requirements
8. ✅ Loading states while fetching
9. ✅ Error handling for failed fetches
10. ✅ Caching for performance

### Performance Requirements
11. ✅ Initial load under 2 seconds
12. ✅ Smooth transitions when updating
13. ✅ Handle 1000+ nodes efficiently
14. ✅ Progressive loading for large trees

## Technical Implementation Notes

### Update API to Fetch from Database
```typescript
// app/api/taxonomy/nodes/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Fetch all taxonomy nodes with relationships
    const { data: nodes, error } = await supabase
      .from('taxonomy_nodes')
      .select(`
        *,
        products:products(count),
        metrics:node_metrics(*)
      `)
      .order('depth', { ascending: true });
    
    if (error) throw error;
    
    // Transform to visualization format
    const visualizationData = transformToD3Format(nodes);
    
    return NextResponse.json({
      nodes: visualizationData.nodes,
      links: visualizationData.links,
      stats: {
        totalNodes: nodes.length,
        maxDepth: Math.max(...nodes.map(n => n.depth)),
        productCount: nodes.reduce((acc, n) => acc + (n.products?.[0]?.count || 0), 0)
      }
    });
  } catch (error) {
    console.error('Failed to fetch taxonomy:', error);
    return NextResponse.json(
      { error: 'Failed to fetch taxonomy data' },
      { status: 500 }
    );
  }
}

function transformToD3Format(dbNodes: any[]) {
  const nodes = dbNodes.map(node => ({
    id: node.id,
    name: node.title,
    value: node.products?.[0]?.count || 10,
    category: determineCategory(node),
    parentId: node.parent_id,
    depth: node.depth,
    url: node.url,
    metrics: node.metrics?.[0] || {}
  }));
  
  const links = dbNodes
    .filter(node => node.parent_id)
    .map(node => ({
      source: node.parent_id,
      target: node.id,
      value: 1
    }));
  
  return { nodes, links };
}
```

### Update Visualization Component
```typescript
// components/taxonomy/D3Visualization/D3Visualization.tsx
import { useEffect, useState } from 'react';
import { useTaxonomyData } from '@/hooks/useTaxonomyData';

export function D3Visualization() {
  const { data, loading, error } = useTaxonomyData();
  const [visualizationData, setVisualizationData] = useState(null);
  
  useEffect(() => {
    if (data) {
      setVisualizationData({
        nodes: data.nodes,
        links: data.links
      });
    }
  }, [data]);
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <span className="ml-3">Loading taxonomy data...</span>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-red-500">
          Failed to load taxonomy data. Please try again.
        </div>
      </div>
    );
  }
  
  // Existing D3 visualization code
  // Now uses visualizationData instead of mockData
}
```

### Create Data Hook
```typescript
// hooks/useTaxonomyData.ts
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function useTaxonomyData() {
  const { data, error, mutate } = useSWR(
    '/api/taxonomy/nodes',
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      refreshInterval: 0,
      dedupingInterval: 60000 // Cache for 1 minute
    }
  );
  
  return {
    data,
    loading: !error && !data,
    error,
    refresh: mutate
  };
}
```

### Remove Mock Data
```typescript
// components/taxonomy/D3Visualization/mockData.ts
// DELETE THIS FILE - No longer needed

// lib/taxonomy/demo-data.ts
// DELETE THIS FILE - No longer needed
```

## Dependencies

- Requires STORY-004 completion (taxonomy in database)
- Existing D3 visualization component
- Database with taxonomy_nodes table

## Testing Requirements

### Unit Tests
```typescript
describe('Taxonomy API', () => {
  it('returns nodes from database');
  it('transforms data to D3 format');
  it('includes parent-child relationships');
  it('handles empty database gracefully');
  it('returns proper error on failure');
});
```

### Integration Tests
- Test with imported sitemap data
- Verify visualization renders database data
- Test performance with 1000+ nodes
- Validate real-time updates

### Visual Testing
1. Compare before/after screenshots
2. Verify node positioning
3. Check relationship lines
4. Test zoom and pan functionality
5. Validate product card displays

## Definition of Done

- [ ] API endpoint fetches from database
- [ ] Mock data removed completely
- [ ] Visualization displays real data
- [ ] Loading states implemented
- [ ] Error handling in place
- [ ] Performance acceptable (< 2s load)
- [ ] Unit tests passing
- [ ] Integration test complete
- [ ] No visual regressions

## Dev Agent Record

### Agent Model Used
_To be filled by implementing agent_

### Debug Log References
_To be filled during implementation_

### Completion Notes
_To be filled after implementation_

### File List
- `app/api/taxonomy/nodes/route.ts` (modified)
- `hooks/useTaxonomyData.ts` (new)
- `components/taxonomy/D3Visualization/D3Visualization.tsx` (modified)
- `components/taxonomy/D3Visualization/mockData.ts` (deleted)

---
**Created:** 2025-01-09  
**Status:** Ready for Development  
**Assigned:** Unassigned