import React from 'react';
import { render, screen } from '@testing-library/react';
import Spinner from './Spinner';

describe('Spinner Component', () => {
  describe('Rendering', () => {
    it('renders spinner', () => {
      const { container } = render(<Spinner />);
      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('renders with default size', () => {
      const { container } = render(<Spinner />);
      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toHaveClass('h-8', 'w-8');
    });

    it('renders with default color', () => {
      const { container } = render(<Spinner />);
      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toHaveClass('border-blue-600');
    });

    it('applies custom className', () => {
      const { container } = render(<Spinner className="custom-spinner" />);
      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('custom-spinner');
    });
  });

  describe('Size Variants', () => {
    it('renders small size', () => {
      const { container } = render(<Spinner size="sm" />);
      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toHaveClass('h-4', 'w-4');
    });

    it('renders medium size', () => {
      const { container } = render(<Spinner size="md" />);
      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toHaveClass('h-8', 'w-8');
    });

    it('renders large size', () => {
      const { container } = render(<Spinner size="lg" />);
      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toHaveClass('h-12', 'w-12');
    });

    it('renders extra large size', () => {
      const { container } = render(<Spinner size="xl" />);
      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toHaveClass('h-16', 'w-16');
    });
  });

  describe('Color Variants', () => {
    it('renders primary color', () => {
      const { container } = render(<Spinner color="primary" />);
      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toHaveClass('border-blue-600');
    });

    it('renders white color', () => {
      const { container } = render(<Spinner color="white" />);
      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toHaveClass('border-white');
    });

    it('renders gray color', () => {
      const { container } = render(<Spinner color="gray" />);
      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toHaveClass('border-gray-600');
    });
  });

  describe('Label', () => {
    it('renders with label', () => {
      render(<Spinner label="Loading..." />);
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('renders without visible label by default', () => {
      render(<Spinner />);
      // There's a sr-only label but not visible
      const srOnly = screen.getByText('Loading...');
      expect(srOnly).toHaveClass('sr-only');
    });

    it('shows custom label text', () => {
      render(<Spinner label="Processing" />);
      expect(screen.getByText('Processing')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has correct role', () => {
      const { container } = render(<Spinner />);
      const wrapper = container.firstChild;
      expect(wrapper).toHaveAttribute('role', 'status');
    });

    it('has correct aria-label', () => {
      const { container } = render(<Spinner />);
      const wrapper = container.firstChild;
      expect(wrapper).toHaveAttribute('aria-label', 'Loading');
    });

    it('uses custom aria-label when label is provided', () => {
      const { container } = render(<Spinner label="Saving changes" />);
      const wrapper = container.firstChild;
      expect(wrapper).toHaveAttribute('aria-label', 'Saving changes');
    });

    it('includes screen reader only text', () => {
      render(<Spinner />);
      const srText = screen.getByText('Loading...');
      expect(srText).toHaveClass('sr-only');
    });
  });

  describe('Styling', () => {
    it('has animation class', () => {
      const { container } = render(<Spinner />);
      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('has rounded shape', () => {
      const { container } = render(<Spinner />);
      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toHaveClass('rounded-full');
    });

    it('has transparent border base', () => {
      const { container } = render(<Spinner />);
      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toHaveClass('border-2', 'border-transparent');
    });
  });
});