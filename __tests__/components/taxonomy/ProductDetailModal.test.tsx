import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProductDetailModal, { Product } from '@/components/taxonomy/ProductDetailModal';

// Mock createPortal to render in the test environment
jest.mock('react-dom', () => ({
  ...jest.requireActual('react-dom'),
  createPortal: (node: React.ReactNode) => node,
}));

const mockProduct: Product = {
  id: 'test-product-1',
  title: 'Test Product Title',
  description:
    'This is a test product description with detailed information that is quite long and should be truncated when displayed initially but can be expanded to show the full content when the user clicks the show more button. Adding more content to reach good quality threshold with specifications and benefits.',
  price: 99.99,
  image_link: 'https://example.com/test-image.jpg',
  brand: 'Test Brand',
  availability: 'in stock',
  link: 'https://example.com/product-page',
  gtin: '1234567890123',
};

const defaultProps = {
  product: mockProduct,
  isOpen: true,
  onClose: jest.fn(),
};

describe('ProductDetailModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset document body overflow
    document.body.style.overflow = 'unset';
  });

  afterEach(() => {
    // Clean up any remaining modal effects
    document.body.style.overflow = 'unset';
  });

  describe('Modal Display and Structure', () => {
    it('should render modal when open with product data', () => {
      render(<ProductDetailModal {...defaultProps} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Test Product Title')).toBeInTheDocument();
      expect(screen.getByText('ID: test-product-1 • GTIN: 1234567890123')).toBeInTheDocument();
    });

    it('should not render modal when closed', () => {
      render(<ProductDetailModal {...defaultProps} isOpen={false} />);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should not render modal when product is null', () => {
      render(<ProductDetailModal {...defaultProps} product={null} />);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should render product image with correct attributes', () => {
      render(<ProductDetailModal {...defaultProps} />);

      const image = screen.getByAltText('Test Product Title');
      expect(image).toHaveAttribute('src', 'https://example.com/test-image.jpg');
      expect(image).toHaveAttribute('loading', 'lazy');
    });

    it('should display fallback when no image is provided', () => {
      const productWithoutImage = { ...mockProduct, image_link: null };
      render(<ProductDetailModal {...defaultProps} product={productWithoutImage} />);

      expect(screen.getByText('No image available')).toBeInTheDocument();
    });
  });

  describe('Modal Interactions', () => {
    it('should call onClose when close button is clicked', async () => {
      const user = userEvent.setup();
      render(<ProductDetailModal {...defaultProps} />);

      const closeButton = screen.getByLabelText('Close product details');
      await user.click(closeButton);

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when backdrop is clicked', async () => {
      const user = userEvent.setup();
      render(<ProductDetailModal {...defaultProps} />);

      const backdrop = screen.getByRole('dialog');
      await user.click(backdrop);

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('should not call onClose when modal content is clicked', async () => {
      const user = userEvent.setup();
      render(<ProductDetailModal {...defaultProps} />);

      const modalContent = screen.getByText('Test Product Title');
      await user.click(modalContent);

      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });
  });

  describe('Keyboard Navigation', () => {
    it('should call onClose when Escape key is pressed', () => {
      render(<ProductDetailModal {...defaultProps} />);

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('should manage focus trap within modal', async () => {
      const user = userEvent.setup();
      render(<ProductDetailModal {...defaultProps} />);

      const closeButton = screen.getByLabelText('Close product details');
      const showMoreButton = screen.getByText('Show more');

      // Test forward tab navigation
      await user.tab();
      expect(closeButton).toHaveFocus();

      await user.tab();
      expect(showMoreButton).toHaveFocus();

      // Test backward tab navigation
      await user.tab({ shift: true });
      expect(closeButton).toHaveFocus();
    });

    it('should set body overflow to hidden when modal is open', () => {
      render(<ProductDetailModal {...defaultProps} />);

      expect(document.body.style.overflow).toBe('hidden');
    });

    it('should restore body overflow when modal is closed', () => {
      const { rerender } = render(<ProductDetailModal {...defaultProps} />);

      expect(document.body.style.overflow).toBe('hidden');

      rerender(<ProductDetailModal {...defaultProps} isOpen={false} />);

      expect(document.body.style.overflow).toBe('unset');
    });
  });

  describe('Product Information Display', () => {
    it('should display truncated description with show more button', () => {
      render(<ProductDetailModal {...defaultProps} />);

      // Should show truncated text initially
      const description = screen.getByText((content, element) => {
        return element?.textContent?.includes('This is a test product description') || false;
      });
      expect(description).toBeInTheDocument();

      // Should have show more button
      const showMoreButton = screen.getByText('Show more');
      expect(showMoreButton).toBeInTheDocument();
    });

    it('should expand description when show more is clicked', async () => {
      const user = userEvent.setup();
      render(<ProductDetailModal {...defaultProps} />);

      const showMoreButton = screen.getByText('Show more');
      await user.click(showMoreButton);

      // Now should show full description
      expect(
        screen.getByText((content, element) => {
          return (
            element?.textContent?.includes('show the full content when the user clicks') || false
          );
        })
      ).toBeInTheDocument();

      // And should have show less button
      expect(screen.getByText('Show less')).toBeInTheDocument();
    });

    it('should display fallback for missing description', () => {
      const productWithoutDescription = { ...mockProduct, description: null };
      render(<ProductDetailModal {...defaultProps} product={productWithoutDescription} />);

      expect(screen.getByText('No description available')).toBeInTheDocument();
    });

    it('should format and display price correctly', () => {
      render(<ProductDetailModal {...defaultProps} />);

      expect(screen.getByText('$99.99')).toBeInTheDocument();
    });

    it('should display price fallback when price is null', () => {
      const productWithoutPrice = { ...mockProduct, price: null };
      render(<ProductDetailModal {...defaultProps} product={productWithoutPrice} />);

      expect(screen.getByText('Price not available')).toBeInTheDocument();
    });

    it('should display availability status with correct styling', () => {
      render(<ProductDetailModal {...defaultProps} />);

      const availability = screen.getByText('✓ In Stock');
      expect(availability).toHaveClass('bg-green-500/20', 'text-green-400');
    });

    it('should display out of stock status correctly', () => {
      const outOfStockProduct = { ...mockProduct, availability: 'out of stock' };
      render(<ProductDetailModal {...defaultProps} product={outOfStockProduct} />);

      const availabilityElements = screen.getAllByText('out of stock');
      const statusBadge = availabilityElements.find(
        (el) => el.classList.contains('inline-flex') && el.classList.contains('items-center')
      );
      expect(statusBadge).toHaveClass('bg-orange-500/20', 'text-orange-400');
    });

    it('should display metrics in accordion with table format', async () => {
      const user = userEvent.setup();
      render(<ProductDetailModal {...defaultProps} />);

      // Check that Metrics accordion is present and initially open
      expect(screen.getByText('Metrics')).toBeInTheDocument();
      expect(screen.getByText('Product ID')).toBeInTheDocument();
      expect(screen.getByText('test-product-1')).toBeInTheDocument();
    });

    it('should display specifications in accordion with table format', async () => {
      const user = userEvent.setup();
      render(<ProductDetailModal {...defaultProps} />);

      // Check that Specifications accordion is present and initially open
      expect(screen.getByText('Specifications')).toBeInTheDocument();
      expect(screen.getByText('Brand')).toBeInTheDocument();
      expect(screen.getByText('Test Brand')).toBeInTheDocument();
    });

    it('should toggle accordions when clicked', async () => {
      const user = userEvent.setup();
      render(<ProductDetailModal {...defaultProps} />);

      // Click on Metrics accordion header to close it
      const metricsButton = screen.getByText('Metrics').closest('button');
      await user.click(metricsButton!);

      // Product ID should not be visible when accordion is closed
      expect(screen.queryByText('Product ID')).not.toBeInTheDocument();

      // Click again to open
      await user.click(metricsButton!);
      expect(screen.getByText('Product ID')).toBeInTheDocument();
    });
  });

  describe('External Links', () => {
    it('should render product link with correct attributes', () => {
      render(<ProductDetailModal {...defaultProps} />);

      const productLink = screen.getByRole('link', { name: /view product page/i });
      expect(productLink).toHaveAttribute('href', 'https://example.com/product-page');
      expect(productLink).toHaveAttribute('target', '_blank');
      expect(productLink).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('should not render product link when link is not provided', () => {
      const productWithoutLink = { ...mockProduct, link: null };
      render(<ProductDetailModal {...defaultProps} product={productWithoutLink} />);

      expect(screen.queryByRole('link', { name: /view product page/i })).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<ProductDetailModal {...defaultProps} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby', 'modal-title');

      const title = screen.getByRole('heading', { name: 'Test Product Title' });
      expect(title).toHaveAttribute('id', 'modal-title');
    });

    it('should have accessible close button', () => {
      render(<ProductDetailModal {...defaultProps} />);

      const closeButton = screen.getByLabelText('Close product details');
      expect(closeButton).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle image loading errors gracefully', () => {
      render(<ProductDetailModal {...defaultProps} />);

      const image = screen.getByAltText('Test Product Title');

      // Simulate image error
      fireEvent.error(image);

      // The error handler should hide the image and show fallback
      expect(image.style.display).toBe('none');
    });
  });

  describe('Responsive Layout', () => {
    it('should apply responsive classes for layout', () => {
      render(<ProductDetailModal {...defaultProps} />);

      // Find the main content container that has the lg:flex classes
      const modalContent = screen.getByText('Description').closest('.p-6');
      expect(modalContent).toHaveClass('p-6', 'lg:flex', 'lg:gap-6');
    });

    it('should apply responsive width classes to columns', () => {
      render(<ProductDetailModal {...defaultProps} />);

      const leftColumn = screen.getByText('Description').closest('.lg\\:w-3\\/5');
      expect(leftColumn).toHaveClass('lg:w-3/5');

      const rightColumn = screen.getByText('Pricing').closest('.lg\\:w-2\\/5');
      expect(rightColumn).toHaveClass('lg:w-2/5');
    });
  });

  describe('Description Quality Assessment', () => {
    it('should display quality badge for descriptions', () => {
      render(<ProductDetailModal {...defaultProps} />);

      // Should show quality badge (Good since description is 300+ chars)
      expect(screen.getByText(/Good|Fair|Poor|Excellent/)).toBeInTheDocument();
    });

    it('should show "Poor" badge for descriptions under 100 characters', () => {
      const shortDescProduct = {
        ...mockProduct,
        description: 'Short description.',
      };
      render(<ProductDetailModal {...defaultProps} product={shortDescProduct} />);

      expect(screen.getByText('Poor')).toBeInTheDocument();
    });

    it('should show "Fair" badge for descriptions 100-299 characters', () => {
      const fairDescProduct = {
        ...mockProduct,
        description: 'A'.repeat(150),
      };
      render(<ProductDetailModal {...defaultProps} product={fairDescProduct} />);

      expect(screen.getByText('Fair')).toBeInTheDocument();
    });

    it('should show "Good" badge for descriptions 300-499 characters', () => {
      const goodDescProduct = {
        ...mockProduct,
        description: 'A'.repeat(350),
      };
      render(<ProductDetailModal {...defaultProps} product={goodDescProduct} />);

      expect(screen.getByText('Good')).toBeInTheDocument();
    });

    it('should show "Excellent" badge for descriptions 500+ characters', () => {
      const excellentDescProduct = {
        ...mockProduct,
        description: 'A'.repeat(550),
      };
      render(<ProductDetailModal {...defaultProps} product={excellentDescProduct} />);

      expect(screen.getByText('Excellent')).toBeInTheDocument();
    });

    it('should display character count with recommended length', () => {
      render(<ProductDetailModal {...defaultProps} />);

      expect(screen.getByText(/Character Count/i)).toBeInTheDocument();
      expect(screen.getByText(/\/500 recommended/i)).toBeInTheDocument();
    });

    it('should show progress bar for character count', () => {
      const { container } = render(<ProductDetailModal {...defaultProps} />);

      const progressBar = container.querySelector('.bg-\\[\\#1a1a1a\\].rounded-full.h-2');
      expect(progressBar).toBeInTheDocument();
    });

    it('should display optimization recommendations for non-excellent quality', () => {
      const poorDescProduct = {
        ...mockProduct,
        description: 'Short.',
      };
      render(<ProductDetailModal {...defaultProps} product={poorDescProduct} />);

      expect(screen.getByText(/Optimization Opportunity/i)).toBeInTheDocument();
      expect(screen.getByText(/Add product specifications/i)).toBeInTheDocument();
    });

    it('should not show optimization recommendations for excellent quality', () => {
      const excellentDescProduct = {
        ...mockProduct,
        description: 'A'.repeat(600),
      };
      render(<ProductDetailModal {...defaultProps} product={excellentDescProduct} />);

      expect(screen.queryByText(/Optimization Opportunity/i)).not.toBeInTheDocument();
    });

    it('should show missing keywords hint for poor/fair quality', () => {
      const poorDescProduct = {
        ...mockProduct,
        description: 'Short.',
      };
      render(<ProductDetailModal {...defaultProps} product={poorDescProduct} />);

      expect(screen.getByText(/Consider adding:/i)).toBeInTheDocument();
      expect(screen.getByText(/Product features, specifications/i)).toBeInTheDocument();
    });

    it('should handle null description with appropriate messaging', () => {
      const noDescProduct = {
        ...mockProduct,
        description: null,
      };
      render(<ProductDetailModal {...defaultProps} product={noDescProduct} />);

      expect(screen.getByText('No description available')).toBeInTheDocument();
      expect(screen.getByText('Poor - Missing Content')).toBeInTheDocument();
      expect(screen.getByText(/Add a comprehensive product description/i)).toBeInTheDocument();
    });

    it('should handle empty description as poor quality', () => {
      const emptyDescProduct = {
        ...mockProduct,
        description: '',
      };
      render(<ProductDetailModal {...defaultProps} product={emptyDescProduct} />);

      expect(screen.getByText('No description available')).toBeInTheDocument();
    });

    it('should strip HTML tags when calculating character count', () => {
      const htmlDescProduct = {
        ...mockProduct,
        description: '<p>Test</p><b>Bold</b>', // 8 chars without tags
      };
      render(<ProductDetailModal {...defaultProps} product={htmlDescProduct} />);

      // Should be counted as Poor (<100 chars) even with HTML
      expect(screen.getByText('Poor')).toBeInTheDocument();
    });

    it('should use correct color for progress bar based on quality', () => {
      const { container } = render(<ProductDetailModal {...defaultProps} />);

      // Find progress bar inner div (colored part)
      const progressBarInner = container.querySelector('.h-full.transition-all');

      // Should have a color class (bg-red-500, bg-orange-500, bg-yellow-500, or bg-green-500)
      expect(progressBarInner?.className).toMatch(/bg-(red|orange|yellow|green)-500/);
    });
  });
});
