import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { getServerSession } from '@/lib/auth/session';

// Query parameter validation schema
const QuerySchema = z.object({
  projectId: z.string().uuid().optional(),
  minScore: z.coerce.number().min(0).max(100).optional(),
  maxScore: z.coerce.number().min(0).max(100).optional(),
  priority: z.enum(['1', '2', '3', '4', '5']).optional(),
  category: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  sortBy: z.enum(['score', 'revenue_potential', 'priority', 'created_at']).default('score'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

// Cache configuration
const CACHE_TTL = 5 * 60; // 5 minutes
const cache = new Map<string, { data: any; timestamp: number }>();

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const query = QuerySchema.parse(searchParams);

    // Generate cache key
    const cacheKey = JSON.stringify({ ...query, userId: session.user.id });

    // Check cache
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL * 1000) {
      return NextResponse.json(cached.data, {
        headers: {
          'X-Cache': 'HIT',
          'Cache-Control': `private, max-age=${CACHE_TTL}`,
        },
      });
    }

    const supabase = await createClient();

    // Build query
    let opportunitiesQuery = supabase.from('opportunities').select(`
        *,
        node:taxonomy_nodes (
          id,
          url,
          path,
          title,
          sku_count,
          content_status,
          optimization_status,
          parent_id,
          project_id
        )
      `);

    // Apply filters
    if (query.projectId) {
      opportunitiesQuery = opportunitiesQuery.eq('node.project_id', query.projectId);
    }

    if (query.minScore !== undefined) {
      opportunitiesQuery = opportunitiesQuery.gte('score', query.minScore);
    }

    if (query.maxScore !== undefined) {
      opportunitiesQuery = opportunitiesQuery.lte('score', query.maxScore);
    }

    if (query.priority) {
      opportunitiesQuery = opportunitiesQuery.eq('priority', parseInt(query.priority));
    }

    if (query.category) {
      opportunitiesQuery = opportunitiesQuery.ilike('node.path', `%${query.category}%`);
    }

    // Apply sorting
    opportunitiesQuery = opportunitiesQuery.order(query.sortBy, {
      ascending: query.order === 'asc',
    });

    // Apply pagination
    const startIndex = (query.page - 1) * query.limit;
    opportunitiesQuery = opportunitiesQuery.range(startIndex, startIndex + query.limit - 1);

    // Execute query
    const { data: opportunities, error: opportunitiesError } = await opportunitiesQuery;

    if (opportunitiesError) {
      console.error('Error fetching opportunities:', opportunitiesError);
      return NextResponse.json({ error: 'Failed to fetch insights' }, { status: 500 });
    }

    // Get total count for pagination
    const countQuery = supabase
      .from('opportunities')
      .select('count', { count: 'exact', head: true });

    if (query.projectId) {
      countQuery.eq('node.project_id', query.projectId);
    }

    const { count } = await countQuery;

    // Format response
    const response = {
      data: opportunities || [],
      pagination: {
        page: query.page,
        limit: query.limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / query.limit),
      },
      filters: {
        projectId: query.projectId,
        minScore: query.minScore,
        maxScore: query.maxScore,
        priority: query.priority,
        category: query.category,
      },
    };

    // Update cache
    cache.set(cacheKey, { data: response, timestamp: Date.now() });

    // Clean old cache entries
    for (const [key, value] of cache.entries()) {
      if (Date.now() - value.timestamp > CACHE_TTL * 1000 * 2) {
        cache.delete(key);
      }
    }

    return NextResponse.json(response, {
      headers: {
        'X-Cache': 'MISS',
        'Cache-Control': `private, max-age=${CACHE_TTL}`,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request parameters', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Insights API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
