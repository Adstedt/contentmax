import { useState, useEffect } from 'react';

export interface Product {
  id: string;
  title: string;
  description?: string;
  price?: number;
  image_link?: string;
  link?: string;
  brand?: string;
  availability?: string;
  impressions?: number;
  clicks?: number;
  conversions?: number;
  revenue?: number;
}

interface UseCategoryProductsResult {
  products: Product[];
  loading: boolean;
  error: string | null;
  isLeafCategory: boolean;
}

export function useCategoryProducts(categoryId: string | null): UseCategoryProductsResult {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLeafCategory, setIsLeafCategory] = useState(false);

  useEffect(() => {
    if (!categoryId) {
      setProducts([]);
      setIsLeafCategory(false);
      return;
    }

    const fetchProducts = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`/api/taxonomy/products?categoryId=${categoryId}`);
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch products');
        }
        
        setProducts(data.products || []);
        setIsLeafCategory(data.isLeaf || false);
        
        if (data.isLeaf && data.products.length === 0 && data.message) {
          console.log(data.message);
        }
      } catch (err) {
        console.error('Error fetching products:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch products');
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [categoryId]);

  return { products, loading, error, isLeafCategory };
}