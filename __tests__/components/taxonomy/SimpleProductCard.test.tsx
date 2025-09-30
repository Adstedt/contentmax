import { render, screen, fireEvent } from '@testing-library/react';
import SimpleProductCard, { Product } from '@/components/taxonomy/SimpleProductCard';

describe('SimpleProductCard', () => {
  const mockProduct: Product = {
    id: '1',
    title: 'Test Product Title',
    description: 'Test product description',
    price: 99.99,
    image_link: 'https://example.com/image.jpg',
    brand: 'Test Brand',
    availability: 'in stock',
    link: 'https://example.com/product',
    gtin: '1234567890',
  };

  it('should render product with all information', () => {
    render(<SimpleProductCard product={mockProduct} />);

    expect(screen.getByText('Test Product Title')).toBeInTheDocument();
    expect(screen.getByText('$99.99')).toBeInTheDocument();
    expect(screen.getByText('Test Brand')).toBeInTheDocument();
    expect(screen.getByAltText('Test Product Title')).toBeInTheDocument();
  });

  it('should render product without optional fields', () => {
    const productWithoutOptionals: Product = {
      id: '2',
      title: 'Minimal Product',
      description: null,
      price: null,
      image_link: null,
      brand: null,
      availability: null,
      link: null,
      gtin: null,
    };

    render(<SimpleProductCard product={productWithoutOptionals} />);

    expect(screen.getByText('Minimal Product')).toBeInTheDocument();
    expect(screen.getByText('No image')).toBeInTheDocument();
    expect(screen.queryByText('Test Brand')).not.toBeInTheDocument();
  });

  it('should truncate long product titles to single line', () => {
    const longTitleProduct: Product = {
      ...mockProduct,
      title:
        'This is a very long product title that should be truncated to a single line with ellipsis',
    };

    const { container } = render(<SimpleProductCard product={longTitleProduct} />);
    const titleElement = container.querySelector('h3');

    expect(titleElement).toHaveClass('truncate');
  });

  it('should call onSelect when card is clicked', () => {
    const handleSelect = jest.fn();
    render(<SimpleProductCard product={mockProduct} onSelect={handleSelect} />);

    const card = screen.getByRole('button', { name: /View details for Test Product Title/i });
    fireEvent.click(card);

    expect(handleSelect).toHaveBeenCalledWith(mockProduct);
    expect(handleSelect).toHaveBeenCalledTimes(1);
  });

  it('should call onProductClick when card is clicked', () => {
    const handleProductClick = jest.fn();
    render(<SimpleProductCard product={mockProduct} onProductClick={handleProductClick} />);

    const card = screen.getByRole('button', { name: /View details for Test Product Title/i });
    fireEvent.click(card);

    expect(handleProductClick).toHaveBeenCalledWith(mockProduct);
    expect(handleProductClick).toHaveBeenCalledTimes(1);
  });

  it('should call both onSelect and onProductClick when provided', () => {
    const handleSelect = jest.fn();
    const handleProductClick = jest.fn();
    render(
      <SimpleProductCard
        product={mockProduct}
        onSelect={handleSelect}
        onProductClick={handleProductClick}
      />
    );

    const card = screen.getByRole('button', { name: /View details for Test Product Title/i });
    fireEvent.click(card);

    expect(handleSelect).toHaveBeenCalledWith(mockProduct);
    expect(handleProductClick).toHaveBeenCalledWith(mockProduct);
  });

  it('should apply selected styles when isSelected is true', () => {
    const { container } = render(<SimpleProductCard product={mockProduct} isSelected={true} />);

    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('border-blue-500');
    expect(card.className).toContain('shadow-blue-500/20');
  });

  it('should apply default border styles when isSelected is false', () => {
    const { container } = render(<SimpleProductCard product={mockProduct} isSelected={false} />);

    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('border-[#2a2a2a]');
  });

  it('should have proper accessibility attributes', () => {
    render(<SimpleProductCard product={mockProduct} />);

    const card = screen.getByRole('button', { name: /View details for Test Product Title/i });

    expect(card).toHaveAttribute('tabIndex', '0');
    expect(card).toHaveAttribute('aria-label', 'View details for Test Product Title');
  });

  it('should handle keyboard navigation with Enter key', () => {
    const handleSelect = jest.fn();
    const handleProductClick = jest.fn();
    render(
      <SimpleProductCard
        product={mockProduct}
        onSelect={handleSelect}
        onProductClick={handleProductClick}
      />
    );

    const card = screen.getByRole('button', { name: /View details for Test Product Title/i });
    fireEvent.keyDown(card, { key: 'Enter' });

    expect(handleSelect).toHaveBeenCalledWith(mockProduct);
    expect(handleProductClick).toHaveBeenCalledWith(mockProduct);
  });

  it('should handle keyboard navigation with Space key', () => {
    const handleSelect = jest.fn();
    const handleProductClick = jest.fn();
    render(
      <SimpleProductCard
        product={mockProduct}
        onSelect={handleSelect}
        onProductClick={handleProductClick}
      />
    );

    const card = screen.getByRole('button', { name: /View details for Test Product Title/i });
    fireEvent.keyDown(card, { key: ' ' });

    expect(handleSelect).toHaveBeenCalledWith(mockProduct);
    expect(handleProductClick).toHaveBeenCalledWith(mockProduct);
  });

  it('should not trigger on other keyboard keys', () => {
    const handleSelect = jest.fn();
    render(<SimpleProductCard product={mockProduct} onSelect={handleSelect} />);

    const card = screen.getByRole('button', { name: /View details for Test Product Title/i });
    fireEvent.keyDown(card, { key: 'Tab' });

    expect(handleSelect).not.toHaveBeenCalled();
  });

  it('should have hover effects applied via CSS classes', () => {
    const { container } = render(<SimpleProductCard product={mockProduct} />);

    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('hover:shadow-lg');
    expect(card.className).toContain('hover:scale-[1.02]');
    expect(card.className).toContain('hover:border-blue-500/50');
  });

  it('should have proper transition duration', () => {
    const { container } = render(<SimpleProductCard product={mockProduct} />);

    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('transition-all');
    expect(card.className).toContain('duration-300');
  });

  it('should render image with white background matching modal style', () => {
    const { container } = render(<SimpleProductCard product={mockProduct} />);

    const imageContainer = container.querySelector('.bg-white');
    expect(imageContainer).toBeInTheDocument();
    expect(imageContainer).toHaveClass('border-gray-200');
  });

  it('should allocate 60% of card height to image (168px of 280px)', () => {
    const { container } = render(<SimpleProductCard product={mockProduct} />);

    const imageContainer = container.querySelector('.h-\\[168px\\]');
    expect(imageContainer).toBeInTheDocument();
  });

  it('should handle image error gracefully', () => {
    const { container } = render(<SimpleProductCard product={mockProduct} />);

    const image = screen.getByAltText('Test Product Title') as HTMLImageElement;
    fireEvent.error(image);

    // After error, "No image" text should appear
    expect(screen.getByText('No image')).toBeInTheDocument();
  });

  it('should format price to 2 decimal places', () => {
    const productWithWholePrice: Product = {
      ...mockProduct,
      price: 50,
    };

    render(<SimpleProductCard product={productWithWholePrice} />);
    expect(screen.getByText('$50.00')).toBeInTheDocument();
  });

  it('should maintain fixed card height', () => {
    const { container } = render(<SimpleProductCard product={mockProduct} />);

    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('h-[280px]');
  });
});
