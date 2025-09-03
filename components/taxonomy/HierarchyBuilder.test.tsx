import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HierarchyBuilder } from './HierarchyBuilder';
import { useTaxonomyNodes } from '@/hooks/use-taxonomy-nodes';
import { HierarchicalNode } from '@/lib/processing/hierarchy-builder';

// Mock the useTaxonomyNodes hook
jest.mock('@/hooks/use-taxonomy-nodes');

// Mock the Tree component from react-dnd-treeview
jest.mock('@minoru/react-dnd-treeview', () => ({
  Tree: ({ tree, render }: any) => (
    <div data-testid="tree-component">
      {tree.map((node: any) => (
        <div key={node.id} data-testid={`node-${node.id}`}>
          {render(node, { depth: 0, isOpen: true, onToggle: jest.fn() })}
        </div>
      ))}
    </div>
  ),
}));

// Mock Lucide icons
jest.mock('lucide-react', () => ({
  ChevronRight: () => <span>ChevronRight</span>,
  ChevronDown: () => <span>ChevronDown</span>,
  MoreVertical: () => <span>MoreVertical</span>,
  Plus: () => <span>Plus</span>,
  Trash2: () => <span>Trash2</span>,
  Edit2: () => <span>Edit2</span>,
  RefreshCw: () => <span>RefreshCw</span>,
  Search: () => <span>Search</span>,
}));

describe('HierarchyBuilder', () => {
  const mockNodes: HierarchicalNode[] = [
    {
      id: 'node1',
      url: 'https://example.com',
      path: '/',
      title: 'Home',
      parent_id: null,
      depth: 0,
      children: ['node2'],
      slug: 'home',
      breadcrumb: [],
      metadata: { skuCount: 10 },
    },
    {
      id: 'node2',
      url: 'https://example.com/products',
      path: '/products',
      title: 'Products',
      parent_id: 'node1',
      depth: 1,
      children: [],
      slug: 'products',
      breadcrumb: ['products'],
      metadata: { skuCount: 5 },
    },
  ];

  const mockUseTaxonomyNodes = {
    nodes: mockNodes,
    loading: false,
    error: null,
    updateNode: jest.fn(),
    deleteNode: jest.fn(),
    refresh: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useTaxonomyNodes as jest.Mock).mockReturnValue(mockUseTaxonomyNodes);
  });

  it('should render the hierarchy tree', () => {
    render(<HierarchyBuilder projectId="test-project" />);

    expect(screen.getByText('Content Hierarchy')).toBeInTheDocument();
    expect(screen.getByTestId('tree-component')).toBeInTheDocument();
  });

  it('should display nodes with their titles', () => {
    render(<HierarchyBuilder projectId="test-project" />);

    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Products')).toBeInTheDocument();
  });

  it('should show metadata badges', () => {
    render(<HierarchyBuilder projectId="test-project" />);

    expect(screen.getByText('L0')).toBeInTheDocument(); // Depth badge for Home
    expect(screen.getByText('L1')).toBeInTheDocument(); // Depth badge for Products
    expect(screen.getByText('10 SKUs')).toBeInTheDocument(); // SKU count for Home
    expect(screen.getByText('5 SKUs')).toBeInTheDocument(); // SKU count for Products
  });

  it('should call onNodeSelect when a node is clicked', () => {
    const onNodeSelect = jest.fn();
    render(<HierarchyBuilder projectId="test-project" onNodeSelect={onNodeSelect} />);

    const homeNode = screen.getByText('Home').closest('div');
    fireEvent.click(homeNode!);

    expect(onNodeSelect).toHaveBeenCalledWith(mockNodes[0]);
  });

  it('should handle search functionality', () => {
    render(<HierarchyBuilder projectId="test-project" />);

    const searchInput = screen.getByPlaceholderText('Search nodes...');
    fireEvent.change(searchInput, { target: { value: 'Products' } });

    // Both nodes should still be visible (parent is shown for context)
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Products')).toBeInTheDocument();
  });

  it('should call refresh when refresh button is clicked', async () => {
    render(<HierarchyBuilder projectId="test-project" />);

    const refreshButton = screen.getByText('Refresh');
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(mockUseTaxonomyNodes.refresh).toHaveBeenCalled();
    });
  });

  it('should display loading state', () => {
    (useTaxonomyNodes as jest.Mock).mockReturnValue({
      ...mockUseTaxonomyNodes,
      loading: true,
    });

    render(<HierarchyBuilder projectId="test-project" />);

    expect(screen.getByText('Loading hierarchy...')).toBeInTheDocument();
  });

  it('should display error state', () => {
    const error = new Error('Failed to load nodes');
    (useTaxonomyNodes as jest.Mock).mockReturnValue({
      ...mockUseTaxonomyNodes,
      error,
    });

    render(<HierarchyBuilder projectId="test-project" />);

    expect(screen.getByText(`Error loading hierarchy: ${error.message}`)).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('should display empty state when no nodes', () => {
    (useTaxonomyNodes as jest.Mock).mockReturnValue({
      ...mockUseTaxonomyNodes,
      nodes: [],
    });

    render(<HierarchyBuilder projectId="test-project" />);

    expect(screen.getByText('No nodes found')).toBeInTheDocument();
    expect(screen.getByText('Import a sitemap to get started')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <HierarchyBuilder projectId="test-project" className="custom-class" />
    );

    const card = container.querySelector('.custom-class');
    expect(card).toBeInTheDocument();
  });
});
