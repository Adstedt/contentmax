import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/external/supabase/server';

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Count products
    const { count, error: countError } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true });
    
    // Get first 5 products
    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .limit(5);
    
    if (error || countError) {
      return NextResponse.json({ 
        error: 'Failed to fetch products',
        details: error || countError 
      }, { status: 500 });
    }
    
    return NextResponse.json({
      total_products: count || 0,
      sample_products: products || [],
      message: count === 0 ? 'No products in database' : `Found ${count} products`
    });
  } catch (error) {
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error
    }, { status: 500 });
  }
}