'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/external/supabase/client';

interface Product {
  id: string;
  title: string;
  description: string | null;
  price: number | null;
  image_link: string | null;
  brand: string | null;
  availability: string | null;
  link: string | null;
}

interface ProductsListProps {
  categoryId: string;
  categoryTitle: string;
}

export default function ProductsList({ categoryId, categoryTitle }: ProductsListProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProducts() {
      try {
        setLoading(true);
        const supabase = createClient();

        // First get product IDs associated with this category
        const { data: productCategories, error: catError } = await supabase
          .from('product_categories')
          .select('product_id')
          .eq('category_id', categoryId);

        if (catError) throw catError;

        if (!productCategories || productCategories.length === 0) {
          setProducts([]);
          return;
        }

        // Then fetch the actual products
        const productIds = productCategories.map((pc) => pc.product_id);
        const { data: productsData, error: prodError } = await supabase
          .from('products')
          .select('*')
          .in('id', productIds)
          .limit(50); // Limit for performance

        if (prodError) throw prodError;

        setProducts(productsData || []);
      } catch (err) {
        console.error('Error fetching products:', err);
        setError('Failed to load products');
      } finally {
        setLoading(false);
      }
    }

    if (categoryId) {
      fetchProducts();
    }
  }, [categoryId]);

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-700 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="p-4 text-red-400">{error}</div>;
  }

  if (products.length === 0) {
    return <div className="p-4 text-gray-400">No products in this category yet</div>;
  }

  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold mb-4 text-white">
        Products in {categoryTitle} ({products.length})
      </h3>
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {products.map((product) => (
          <div
            key={product.id}
            className="bg-gray-800 rounded-lg p-3 hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-start gap-3">
              {product.image_link && (
                <img
                  src={product.image_link}
                  alt={product.title}
                  className="w-16 h-16 object-cover rounded"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              )}
              <div className="flex-1">
                <h4 className="font-medium text-white text-sm mb-1">{product.title}</h4>
                {product.description && (
                  <p className="text-xs text-gray-400 line-clamp-2 mb-2">{product.description}</p>
                )}
                <div className="flex items-center gap-4 text-xs">
                  {product.price && (
                    <span className="text-green-400">${product.price.toFixed(2)}</span>
                  )}
                  {product.brand && <span className="text-gray-500">{product.brand}</span>}
                  {product.availability && (
                    <span
                      className={`${
                        product.availability === 'in stock' ? 'text-green-400' : 'text-orange-400'
                      }`}
                    >
                      {product.availability}
                    </span>
                  )}
                </div>
                {product.link && (
                  <a
                    href={product.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-2 text-xs text-blue-400 hover:text-blue-300"
                  >
                    View Product →
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
