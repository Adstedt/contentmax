import { NextRequest, NextResponse } from 'next/server';
import { FeedTaxonomyBuilder } from '@/lib/taxonomy/feed-taxonomy-builder';
import { CategoryMerger } from '@/lib/taxonomy/category-merger';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

// Request validation schema
const BuildTaxonomySchema = z.object({
  products: z.array(z.object({
    id: z.string().optional(),
    product_id: z.string().optional(),
    product_title: z.string(),
    product_type: z.string().optional(),
    google_product_category: z.string().optional(),
    url: z.string().optional(),
  })).min(1),
  options: z.object({
    mergeSimilar: z.boolean().default(true),
    similarityThreshold: z.number().min(0).max(1).default(0.85),
  }).optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Authentication check (if needed)
    // const session = await getServerSession();
    // if (!session) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }
    
    // Parse and validate request body
    const body = await request.json();
    const validated = BuildTaxonomySchema.parse(body);
    const { products, options } = validated;
    
    console.log(`Building taxonomy from ${products.length} products`);
    
    // Build taxonomy from product feed
    const builder = new FeedTaxonomyBuilder();
    const taxonomyData = await builder.buildFromProductFeed(products);
    
    // Get the nodes for statistics (before merging)
    const nodes = builder.getNodes();
    const productAssignments = builder.getProductAssignments();
    
    let mergeStats = { totalMerges: 0, mergeMap: new Map<string, string>() };
    let finalNodes = nodes;
    
    // Optional: Merge similar categories
    if (options?.mergeSimilar) {
      const merger = new CategoryMerger();
      finalNodes = merger.mergeSimilarCategories(nodes);
      mergeStats = merger.getMergeStats();
    }
    
    // Calculate statistics
    const depths = Array.from(finalNodes.values()).map(n => n.depth);
    const productCounts = Array.from(finalNodes.values()).map(n => n.product_count);
    
    const stats = {
      totalNodes: finalNodes.size,
      maxDepth: Math.max(...depths, 0),
      minDepth: Math.min(...depths, 0),
      totalProducts: products.length,
      avgProductsPerCategory: products.length / Math.max(finalNodes.size, 1),
      categoriesWithProducts: Array.from(finalNodes.values()).filter(n => n.product_count > 0).length,
      categoriesWithoutProducts: Array.from(finalNodes.values()).filter(n => n.product_count === 0).length,
      mergedCategories: mergeStats.totalMerges,
      productAssignments: Array.from(productAssignments.values()).reduce((sum, set) => sum + set.size, 0),
    };
    
    // Build hierarchy for response
    const hierarchy = buildHierarchy(finalNodes);
    
    return NextResponse.json({
      success: true,
      nodes: finalNodes.size,
      stats,
      hierarchy: hierarchy.slice(0, 5), // Return top 5 root categories for preview
      message: `Successfully built taxonomy with ${finalNodes.size} categories from ${products.length} products`,
    });
    
  } catch (error) {
    console.error('Taxonomy build failed:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid request data', 
          details: error.errors 
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to build taxonomy',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Helper function to build hierarchy tree for visualization
function buildHierarchy(nodes: Map<string, any>): any[] {
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

// GET endpoint to check taxonomy status
export async function GET(request: NextRequest) {
  try {
    // This could check database for existing taxonomy
    return NextResponse.json({
      status: 'ready',
      message: 'Taxonomy build endpoint is available'
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Service unavailable' },
      { status: 503 }
    );
  }
}