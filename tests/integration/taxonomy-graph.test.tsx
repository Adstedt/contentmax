import { render, screen, waitFor } from '@testing-library/react';
import { EnhancedTaxonomyVisualization } from '@/components/taxonomy/EnhancedTaxonomyVisualization';

describe('Taxonomy Graph View', () => {
  const mockData = {
    nodes: [
      {
        id: 'root',
        url: '/',
        title: 'Store',
        children: ['electronics', 'clothing'],
        depth: 0,
        skuCount: 100,
        traffic: 5000,
        revenue: 10000,
        status: 'optimized' as const,
      },
      {
        id: 'electronics',
        url: '/electronics',
        title: 'Electronics',
        children: ['phones', 'laptops'],
        depth: 1,
        skuCount: 50,
        traffic: 2500,
        revenue: 5000,
        status: 'optimized' as const,
      },
      {
        id: 'clothing',
        url: '/clothing',
        title: 'Clothing',
        children: [],
        depth: 1,
        skuCount: 50,
        traffic: 2500,
        revenue: 5000,
        status: 'outdated' as const,
      },
    ],
    links: [
      { source: 'root', target: 'electronics', strength: 0.8 },
      { source: 'root', target: 'clothing', strength: 0.8 },
    ],
  };

  it('should render ForceGraph when graph view is selected', async () => {
    const { container } = render(
      <EnhancedTaxonomyVisualization data={mockData} />
    );

    // Find and click the graph view button
    const graphButton = screen.getByRole('button', { name: /graph/i });
    expect(graphButton).toBeInTheDocument();
    
    // Click to switch to graph view
    graphButton.click();

    // Wait for canvas to be rendered (ForceGraph uses canvas)
    await waitFor(() => {
      const canvas = container.querySelector('canvas');
      expect(canvas).toBeInTheDocument();
    });
  });

  it('should pass data to ForceGraph component', () => {
    render(<EnhancedTaxonomyVisualization data={mockData} />);
    
    // Switch to graph view
    const graphButton = screen.getByRole('button', { name: /graph/i });
    graphButton.click();

    // Verify data is being used (canvas should be rendered)
    const canvas = document.querySelector('canvas');
    expect(canvas).toBeInTheDocument();
  });
});