import { NextRequest, NextResponse } from 'next/server';
import { FeedTaxonomyBuilder } from '@/lib/core/taxonomy/feed-taxonomy-builder';
import { CategoryMerger } from '@/lib/core/taxonomy/category-merger';
import { FeedFetcher } from '@/lib/core/taxonomy/feed-fetcher';
import { createServerSupabaseClient } from '@/lib/external/supabase/server';
import { MetaTagFetcher } from '@/lib/services/meta-tag-fetcher';
import { z } from 'zod';

// Request validation schemas
const ImportFromUrlSchema = z.object({
  type: z.literal('url'),
  url: z.string().url(),
  projectId: z.string().optional(),
  options: z.object({
    mergeSimilar: z.boolean().default(true),
    similarityThreshold: z.number().min(0).max(1).default(0.85),
    persistToDatabase: z.boolean().default(true),
    fetchMetaTags: z.boolean().default(false),
  }).optional(),
});

const ImportFromProductsSchema = z.object({
  type: z.literal('products'),
  products: z.array(z.object({
    id: z.string().optional(),
    product_id: z.string().optional(),
    title: z.string().optional(),
    product_title: z.string().optional(),
    product_type: z.string().optional(),
    google_product_category: z.string().optional(),
    url: z.string().optional(),
    link: z.string().optional(),
  })).min(1),
  projectId: z.string().optional(),
  options: z.object({
    mergeSimilar: z.boolean().default(true),
    similarityThreshold: z.number().min(0).max(1).default(0.85),
    persistToDatabase: z.boolean().default(true),
    fetchMetaTags: z.boolean().default(false),
  }).optional(),
});

const ImportSchema = z.union([ImportFromUrlSchema, ImportFromProductsSchema]);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = ImportSchema.parse(body);
    
    let products = [];
    let feedMetadata = null;
    
    // Fetch products based on input type
    if (validated.type === 'url') {
      console.log(`Importing taxonomy from URL: ${validated.url}`);
      
      const fetcher = new FeedFetcher();
      const feedResult = await fetcher.fetchFromUrl(validated.url);
      products = feedResult.products;
      feedMetadata = feedResult.metadata;
      
      console.log(`Fetched ${products.length} products from ${feedMetadata.format} feed`);
    } else {
      console.log(`Importing taxonomy from ${validated.products.length} products`);
      products = validated.products;
    }
    
    // Validate we have products with categories
    const productsWithCategories = products.filter(p => 
      p.product_type || p.google_product_category
    );
    
    if (productsWithCategories.length === 0) {
      return NextResponse.json({
        error: 'No products with category information found',
        details: {
          totalProducts: products.length,
          productsWithCategories: 0
        }
      }, { status: 400 });
    }
    
    // Get current user for database association
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    // Build taxonomy
    const builder = new FeedTaxonomyBuilder();
    const skipPersist = validated.options?.persistToDatabase === false;
    await builder.buildFromProductFeed(products, { skipPersist, userId: user?.id, projectId: validated.projectId });
    
    // Get nodes for analysis
    const nodes = builder.getNodes();
    const productAssignments = builder.getProductAssignments();
    
    let finalNodes = nodes;
    let mergeStats = { totalMerges: 0, mergeMap: new Map<string, string>() };
    
    // Optional: Merge similar categories
    if (validated.options?.mergeSimilar !== false) {
      const merger = new CategoryMerger();
      finalNodes = merger.mergeSimilarCategories(nodes);
      mergeStats = merger.getMergeStats();
    }
    
    // Calculate comprehensive statistics
    const depths = Array.from(finalNodes.values()).map(n => n.depth);
    const productCounts = Array.from(finalNodes.values()).map(n => n.product_count);
    
    const stats = {
      totalProducts: products.length,
      productsWithCategories: productsWithCategories.length,
      productsWithoutCategories: products.length - productsWithCategories.length,
      totalNodes: finalNodes.size,
      maxDepth: Math.max(...depths, 0),
      minDepth: Math.min(...depths, 0),
      avgDepth: depths.reduce((a, b) => a + b, 0) / depths.length || 0,
      avgProductsPerCategory: products.length / Math.max(finalNodes.size, 1),
      categoriesWithProducts: productCounts.filter(c => c > 0).length,
      categoriesWithoutProducts: productCounts.filter(c => c === 0).length,
      mergedCategories: mergeStats.totalMerges,
      productAssignments: Array.from(productAssignments.values()).reduce((sum, set) => sum + set.size, 0),
    };
    
    // Build hierarchy for visualization
    const hierarchy = buildHierarchyTree(finalNodes);
    
    // Get top categories by product count
    const topCategories = Array.from(finalNodes.values())
      .sort((a, b) => b.product_count - a.product_count)
      .slice(0, 10)
      .map(node => ({
        id: node.id,
        title: node.title,
        path: node.path,
        depth: node.depth,
        product_count: node.product_count
      }));

    // Optional: Fetch meta tags for products and nodes
    let metaFetchResults = null;
    if (validated.options?.fetchMetaTags && validated.options?.persistToDatabase !== false) {
      console.log('Triggering meta tag fetching in background...');

      // Start meta tag fetching in background (non-blocking)
      const metaFetcher = new MetaTagFetcher();

      // Get all node IDs and product IDs that were just created
      const nodeIds = Array.from(finalNodes.keys());

      // Trigger fetching but don't wait for completion
      Promise.all([
        metaFetcher.updateTaxonomyMetaTags(nodeIds.slice(0, 50)), // Limit to first 50 nodes
        // Products meta tags can be fetched separately if needed
      ]).then(() => {
        console.log('Meta tag fetching completed in background');
      }).catch(error => {
        console.error('Meta tag fetching failed:', error);
      });

      metaFetchResults = {
        triggered: true,
        message: 'Meta tag fetching started in background. This may take a few minutes.',
        nodeCount: Math.min(nodeIds.length, 50),
      };
    }

    // Prepare response
    const response = {
      success: true,
      source: validated.type === 'url' ? validated.url : 'direct',
      feedMetadata,
      taxonomy: {
        nodes: finalNodes.size,
        stats,
        topCategories,
        rootCategories: hierarchy.slice(0, 5), // Top 5 root categories
        sampleHierarchy: createSampleHierarchy(hierarchy[0]), // First root with children
      },
      metaFetchResults,
      message: `Successfully built taxonomy with ${finalNodes.size} categories from ${products.length} products`,
    };

    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Taxonomy import failed:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Invalid request data',
        details: error.errors
      }, { status: 400 });
    }
    
    return NextResponse.json({
      error: 'Failed to import taxonomy',
      message: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? {
        name: error.name,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      } : undefined
    }, { status: 500 });
  }
}

// Helper function to build hierarchy tree
function buildHierarchyTree(nodes: Map<string, any>): any[] {
  const rootNodes: any[] = [];
  const nodeMap = new Map<string, any>();
  
  // First pass: create all nodes with children arrays
  for (const [id, node] of nodes) {
    nodeMap.set(id, {
      ...node,
      children: []
    });
  }
  
  // Second pass: build parent-child relationships
  for (const [id, node] of nodeMap) {
    if (node.parent_id) {
      const parent = nodeMap.get(node.parent_id);
      if (parent) {
        parent.children.push(node);
      }
    } else {
      rootNodes.push(node);
    }
  }
  
  // Sort children by product count (descending) and then by title
  const sortChildren = (node: any) => {
    if (node.children && node.children.length > 0) {
      node.children.sort((a: any, b: any) => {
        if (b.product_count !== a.product_count) {
          return b.product_count - a.product_count;
        }
        return a.title.localeCompare(b.title);
      });
      node.children.forEach(sortChildren);
    }
  };
  
  rootNodes.forEach(sortChildren);
  rootNodes.sort((a, b) => {
    if (b.product_count !== a.product_count) {
      return b.product_count - a.product_count;
    }
    return a.title.localeCompare(b.title);
  });
  
  return rootNodes;
}

// Create a sample of the hierarchy (limited depth for response)
function createSampleHierarchy(node: any, maxDepth: number = 3, currentDepth: number = 0): any {
  if (!node || currentDepth >= maxDepth) {
    return null;
  }
  
  return {
    id: node.id,
    title: node.title,
    product_count: node.product_count,
    children: node.children
      ?.slice(0, 3) // Limit to 3 children per level
      .map((child: any) => createSampleHierarchy(child, maxDepth, currentDepth + 1))
      .filter(Boolean)
  };
}

// GET endpoint to check import status
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'ready',
    message: 'Taxonomy import endpoint is available',
    acceptedFormats: ['url', 'products'],
    supportedFeedFormats: ['xml', 'json', 'csv', 'tsv'],
    endpoints: {
      import: '/api/taxonomy/import',
      build: '/api/taxonomy/build',
    }
  });
}