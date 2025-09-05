import React from 'react';
import { render, screen } from '@testing-library/react';
import Card from './Card';

describe('Card Component', () => {
  describe('Rendering', () => {
    it('renders with default props', () => {
      render(<Card>Card content</Card>);
      expect(screen.getByText('Card content')).toBeInTheDocument();
    });

    it('renders with custom className', () => {
      const { container } = render(
        <Card className="custom-class">Content</Card>
      );
      const card = container.firstChild;
      expect(card).toHaveClass('custom-class');
    });

    it('forwards ref correctly', () => {
      const ref = React.createRef<HTMLDivElement>();
      render(<Card ref={ref}>Content</Card>);
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe('Padding Variants', () => {
    it('renders with no padding', () => {
      const { container } = render(<Card padding="none">Content</Card>);
      const card = container.firstChild;
      // When padding is none, no padding class is applied
      expect(card).not.toHaveClass('p-4', 'p-6', 'p-8');
    });

    it('renders with small padding', () => {
      const { container } = render(<Card padding="sm">Content</Card>);
      const card = container.firstChild;
      expect(card).toHaveClass('p-4');
    });

    it('renders with medium padding (default)', () => {
      const { container } = render(<Card>Content</Card>);
      const card = container.firstChild;
      expect(card).toHaveClass('p-6');
    });

    it('renders with large padding', () => {
      const { container } = render(<Card padding="lg">Content</Card>);
      const card = container.firstChild;
      expect(card).toHaveClass('p-8');
    });
  });

  describe('Shadow Variants', () => {
    it('renders with no shadow', () => {
      const { container } = render(<Card shadow="none">Content</Card>);
      const card = container.firstChild;
      expect(card).not.toHaveClass('shadow-sm', 'shadow-md', 'shadow-lg');
    });

    it('renders with small shadow (default)', () => {
      const { container } = render(<Card>Content</Card>);
      const card = container.firstChild;
      expect(card).toHaveClass('shadow-sm');
    });

    it('renders with medium shadow', () => {
      const { container } = render(<Card shadow="md">Content</Card>);
      const card = container.firstChild;
      expect(card).toHaveClass('shadow-md');
    });

    it('renders with large shadow', () => {
      const { container } = render(<Card shadow="lg">Content</Card>);
      const card = container.firstChild;
      expect(card).toHaveClass('shadow-lg');
    });
  });

  describe('Border', () => {
    it('renders with border by default', () => {
      const { container } = render(<Card>Content</Card>);
      const card = container.firstChild;
      expect(card).toHaveClass('border', 'border-gray-200');
    });

    it('renders without border when border is false', () => {
      const { container } = render(<Card border={false}>Content</Card>);
      const card = container.firstChild;
      expect(card).not.toHaveClass('border');
    });
  });

  describe('Sub-components', () => {
    it('renders Card.Header correctly', () => {
      const { container } = render(
        <Card padding="none">
          {/* @ts-ignore - Card doesn't have Header property */}
          <Card.Header>Header Content</Card.Header>
        </Card>
      );
      expect(screen.getByText('Header Content')).toBeInTheDocument();
      // Find the header div which is a direct child of Card
      const card = container.firstChild as HTMLElement;
      const header = card.firstChild as HTMLElement;
      expect(header).toHaveClass('pb-4', 'border-b', 'border-gray-200');
    });

    it('renders Card.Body correctly', () => {
      const { container } = render(
        <Card padding="none">
          {/* @ts-ignore - Card doesn't have Body property */}
          <Card.Body>Body Content</Card.Body>
        </Card>
      );
      expect(screen.getByText('Body Content')).toBeInTheDocument();
      // Find the body div which is a direct child of Card
      const card = container.firstChild as HTMLElement;
      const body = card.firstChild as HTMLElement;
      expect(body).toHaveClass('py-4');
    });

    it('renders Card.Footer correctly', () => {
      const { container } = render(
        <Card padding="none">
          {/* @ts-ignore - Card doesn't have Footer property */}
          <Card.Footer>Footer Content</Card.Footer>
        </Card>
      );
      expect(screen.getByText('Footer Content')).toBeInTheDocument();
      // Find the footer div which is a direct child of Card
      const card = container.firstChild as HTMLElement;
      const footer = card.firstChild as HTMLElement;
      expect(footer).toHaveClass('pt-4', 'border-t', 'border-gray-200');
    });

    it('renders all sub-components together', () => {
      render(
        <Card>
          {/* @ts-ignore - Card doesn't have these properties */}
          <Card.Header>Header</Card.Header>
          {/* @ts-ignore */}
          <Card.Body>Body</Card.Body>
          {/* @ts-ignore */}
          <Card.Footer>Footer</Card.Footer>
        </Card>
      );
      expect(screen.getByText('Header')).toBeInTheDocument();
      expect(screen.getByText('Body')).toBeInTheDocument();
      expect(screen.getByText('Footer')).toBeInTheDocument();
    });
  });

  describe('Composition', () => {
    it('renders mixed content correctly', () => {
      render(
        <Card>
          <Card.Header>Title</Card.Header>
          <div>Custom content</div>
          <Card.Footer>Actions</Card.Footer>
        </Card>
      );
      expect(screen.getByText('Title')).toBeInTheDocument();
      expect(screen.getByText('Custom content')).toBeInTheDocument();
      expect(screen.getByText('Actions')).toBeInTheDocument();
    });

    it('applies custom className to sub-components', () => {
      const { container } = render(
        <Card padding="none">
          <Card.Header className="custom-header">Header</Card.Header>
          <Card.Body className="custom-body">Body</Card.Body>
          <Card.Footer className="custom-footer">Footer</Card.Footer>
        </Card>
      );
      
      const card = container.firstChild as HTMLElement;
      const header = card.children[0] as HTMLElement;
      const body = card.children[1] as HTMLElement;
      const footer = card.children[2] as HTMLElement;
      
      expect(header).toHaveClass('custom-header');
      expect(body).toHaveClass('custom-body');
      expect(footer).toHaveClass('custom-footer');
    });
  });

  describe('Accessibility', () => {
    it('renders as div with proper structure', () => {
      const { container } = render(<Card>Content</Card>);
      const card = container.firstChild as HTMLElement;
      expect(card.tagName).toBe('DIV');
      expect(card).toHaveClass('bg-white', 'rounded-md');
    });

    it('maintains semantic structure', () => {
      const { container } = render(
        <Card>
          <Card.Header>
            <h2>Card Title</h2>
          </Card.Header>
          <Card.Body>
            <p>Card content</p>
          </Card.Body>
        </Card>
      );
      expect(container.querySelector('h2')).toBeInTheDocument();
      expect(container.querySelector('p')).toBeInTheDocument();
    });

    it('applies correct background and border radius', () => {
      const { container } = render(<Card>Content</Card>);
      const card = container.firstChild;
      expect(card).toHaveClass('bg-white', 'rounded-md');
    });
  });
});