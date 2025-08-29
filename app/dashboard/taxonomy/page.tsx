import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { TaxonomyVisualization } from '@/components/taxonomy/TaxonomyVisualization';
import type { TaxonomyNode, TaxonomyLink } from '@/components/taxonomy/D3Visualization';

// Generate demo data for testing
function generateDemoData(nodeCount: number = 100) {
  const nodes: TaxonomyNode[] = [];
  const links: TaxonomyLink[] = [];
  
  // Create root node
  nodes.push({
    id: 'root',
    url: '/',
    title: 'Home',
    children: [],
    depth: 0,
    skuCount: 100,
    traffic: 10000,
    revenue: 50000,
    status: 'optimized',
  });
  
  // Create category nodes
  const categories = ['Electronics', 'Clothing', 'Books', 'Sports', 'Home'];
  categories.forEach((category, i) => {
    const categoryId = `category-${i}`;
    nodes.push({
      id: categoryId,
      url: `/${category.toLowerCase()}`,
      title: category,
      children: [],
      depth: 1,
      skuCount: Math.floor(Math.random() * 50) + 10,
      traffic: Math.floor(Math.random() * 5000) + 1000,
      revenue: Math.floor(Math.random() * 20000) + 5000,
      status: ['optimized', 'outdated', 'missing', 'noContent'][Math.floor(Math.random() * 4)] as any,
    });
    
    // Link to root
    links.push({
      source: 'root',
      target: categoryId,
      strength: 0.8,
    });
    
    // Create subcategory nodes
    const subcategoryCount = Math.floor(Math.random() * 5) + 3;
    for (let j = 0; j < subcategoryCount && nodes.length < nodeCount; j++) {
      const subcategoryId = `${categoryId}-sub-${j}`;
      nodes.push({
        id: subcategoryId,
        url: `/${category.toLowerCase()}/sub-${j}`,
        title: `${category} Sub ${j}`,
        children: [],
        depth: 2,
        skuCount: Math.floor(Math.random() * 20) + 5,
        traffic: Math.floor(Math.random() * 1000) + 200,
        revenue: Math.floor(Math.random() * 5000) + 1000,
        status: ['optimized', 'outdated', 'missing', 'noContent'][Math.floor(Math.random() * 4)] as any,
      });
      
      // Link to category
      links.push({
        source: categoryId,
        target: subcategoryId,
        strength: 0.6,
      });
      
      // Create product nodes
      const productCount = Math.floor(Math.random() * 8) + 2;
      for (let k = 0; k < productCount && nodes.length < nodeCount; k++) {
        const productId = `${subcategoryId}-product-${k}`;
        nodes.push({
          id: productId,
          url: `/${category.toLowerCase()}/sub-${j}/product-${k}`,
          title: `Product ${k}`,
          children: [],
          depth: 3,
          skuCount: Math.floor(Math.random() * 5) + 1,
          traffic: Math.floor(Math.random() * 100) + 10,
          revenue: Math.floor(Math.random() * 1000) + 100,
          status: ['optimized', 'outdated', 'missing', 'noContent'][Math.floor(Math.random() * 4)] as any,
        });
        
        // Link to subcategory
        links.push({
          source: subcategoryId,
          target: productId,
          strength: 0.4,
        });
      }
    }
  });
  
  // Add some cross-links for interesting patterns
  for (let i = 0; i < 10 && i < nodes.length - 1; i++) {
    const sourceIdx = Math.floor(Math.random() * nodes.length);
    const targetIdx = Math.floor(Math.random() * nodes.length);
    if (sourceIdx !== targetIdx) {
      links.push({
        source: nodes[sourceIdx].id,
        target: nodes[targetIdx].id,
        strength: 0.2,
      });
    }
  }
  
  return { nodes, links };
}

export default async function TaxonomyPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  // Generate demo data
  const demoData = generateDemoData(150);

  return (
    <div className="flex-1 flex flex-col bg-[#000]">
      <Header
        title="Taxonomy Visualization"
        subtitle="Interactive force-directed graph of your site structure"
      />

      <main className="flex-1 p-6 overflow-hidden">
        <TaxonomyVisualization data={demoData} />
      </main>
    </div>
  );
}