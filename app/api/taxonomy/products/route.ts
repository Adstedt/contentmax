import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Get category ID from query params
    const categoryId = request.nextUrl.searchParams.get('categoryId');
    
    if (!categoryId) {
      return NextResponse.json({ error: 'Category ID is required' }, { status: 400 });
    }
    
    // First check if this is a leaf category
    const { data: categoryNode, error: categoryError } = await supabase
      .from('taxonomy_nodes')
      .select('id, title, product_count, depth')
      .eq('id', categoryId)
      .single();
    
    if (categoryError || !categoryNode) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }
    
    // Check if this category has child categories
    const { data: childCategories } = await supabase
      .from('taxonomy_nodes')
      .select('id')
      .eq('parent_id', categoryId)
      .limit(1);
    
    // If it has children, it's not a leaf node - return empty products
    if (childCategories && childCategories.length > 0) {
      return NextResponse.json({ 
        category: categoryNode,
        products: [],
        isLeaf: false 
      });
    }
    
    // It's a leaf node - fetch products for this category
    const { data: productRelations, error: relError } = await supabase
      .from('product_categories')
      .select('product_id')
      .eq('category_id', categoryId);
    
    if (relError) {
      console.error('Error fetching product relations:', relError);
      // Even if no products found, return empty array
      return NextResponse.json({ 
        category: categoryNode,
        products: [],
        isLeaf: true 
      });
    }
    
    // If no products are linked to this category
    if (!productRelations || productRelations.length === 0) {
      return NextResponse.json({ 
        category: categoryNode,
        products: [],
        isLeaf: true,
        message: `No products found for category "${categoryNode.title}". Category shows ${categoryNode.product_count} products in count.`
      });
    }
    
    // Fetch the actual products
    const productIds = productRelations.map(r => r.product_id);
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('*')
      .in('id', productIds);
    
    if (productsError) {
      console.error('Error fetching products:', productsError);
      return NextResponse.json({ 
        category: categoryNode,
        products: [],
        isLeaf: true,
        error: 'Failed to fetch products'
      });
    }
    
    return NextResponse.json({
      category: categoryNode,
      products: products || [],
      isLeaf: true,
      totalProducts: products?.length || 0
    });
    
  } catch (error) {
    console.error('Error in products API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}