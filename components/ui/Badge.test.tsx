import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Badge from './Badge';

describe('Badge Component', () => {
  describe('Rendering', () => {
    it('renders with default props', () => {
      render(<Badge>Default Badge</Badge>);
      expect(screen.getByText('Default Badge')).toBeInTheDocument();
    });

    it('renders with custom className', () => {
      render(<Badge className="custom-class">Badge</Badge>);
      const badge = screen.getByText('Badge');
      expect(badge).toHaveClass('custom-class');
    });
  });

  describe('Variants', () => {
    it('renders default variant correctly', () => {
      render(<Badge variant="default">Default</Badge>);
      const badge = screen.getByText('Default');
      expect(badge).toHaveClass('bg-gray-100', 'text-gray-800');
    });

    it('renders primary variant correctly', () => {
      render(<Badge variant="primary">Primary</Badge>);
      const badge = screen.getByText('Primary');
      expect(badge).toHaveClass('bg-blue-100', 'text-blue-800');
    });

    it('renders success variant correctly', () => {
      render(<Badge variant="success">Success</Badge>);
      const badge = screen.getByText('Success');
      expect(badge).toHaveClass('bg-green-100', 'text-green-800');
    });

    it('renders warning variant correctly', () => {
      render(<Badge variant="warning">Warning</Badge>);
      const badge = screen.getByText('Warning');
      expect(badge).toHaveClass('bg-yellow-100', 'text-yellow-800');
    });

    it('renders danger variant correctly', () => {
      render(<Badge variant="danger">Danger</Badge>);
      const badge = screen.getByText('Danger');
      expect(badge).toHaveClass('bg-red-100', 'text-red-800');
    });
  });

  describe('Sizes', () => {
    it('renders small size correctly', () => {
      render(<Badge size="sm">Small</Badge>);
      const badge = screen.getByText('Small');
      expect(badge).toHaveClass('px-2', 'py-0.5', 'text-xs');
    });

    it('renders medium size correctly', () => {
      render(<Badge size="md">Medium</Badge>);
      const badge = screen.getByText('Medium');
      expect(badge).toHaveClass('px-2.5', 'py-1', 'text-sm');
    });

    it('renders large size correctly', () => {
      render(<Badge size="lg">Large</Badge>);
      const badge = screen.getByText('Large');
      expect(badge).toHaveClass('px-3', 'py-1.5', 'text-base');
    });
  });

  describe('Removable Badge', () => {
    it('shows remove button when removable is true', () => {
      render(<Badge removable>Removable</Badge>);
      const removeButton = screen.getByRole('button', { name: /remove/i });
      expect(removeButton).toBeInTheDocument();
    });

    it('does not show remove button when removable is false', () => {
      render(<Badge removable={false}>Not Removable</Badge>);
      const removeButton = screen.queryByRole('button', { name: /remove/i });
      expect(removeButton).not.toBeInTheDocument();
    });

    it('calls onRemove when remove button is clicked', () => {
      const handleRemove = jest.fn();
      render(
        <Badge removable onRemove={handleRemove}>
          Remove me
        </Badge>
      );
      const removeButton = screen.getByRole('button', { name: /remove/i });
      fireEvent.click(removeButton);
      expect(handleRemove).toHaveBeenCalledTimes(1);
    });

    it('removes badge from DOM when onRemove is not provided', () => {
      const { container } = render(<Badge removable>Remove me</Badge>);
      const removeButton = screen.getByRole('button', { name: /remove/i });
      fireEvent.click(removeButton);
      expect(container.firstChild).toBeNull();
    });

    it('shows X icon in remove button', () => {
      const { container } = render(<Badge removable>Badge</Badge>);
      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });
  });

  describe('Icons', () => {
    it('renders with left icon', () => {
      const icon = <span data-testid="left-icon">🎯</span>;
      render(<Badge leftIcon={icon}>With Icon</Badge>);
      expect(screen.getByTestId('left-icon')).toBeInTheDocument();
    });

    it('renders with right icon', () => {
      const icon = <span data-testid="right-icon">✅</span>;
      render(<Badge rightIcon={icon}>With Icon</Badge>);
      expect(screen.getByTestId('right-icon')).toBeInTheDocument();
    });

    it('renders with both icons', () => {
      const leftIcon = <span data-testid="left-icon">←</span>;
      const rightIcon = <span data-testid="right-icon">→</span>;
      render(
        <Badge leftIcon={leftIcon} rightIcon={rightIcon}>
          Badge
        </Badge>
      );
      expect(screen.getByTestId('left-icon')).toBeInTheDocument();
      expect(screen.getByTestId('right-icon')).toBeInTheDocument();
    });
  });

  describe('Pill Shape', () => {
    it('applies pill shape when pill is true', () => {
      render(<Badge pill>Pill Badge</Badge>);
      const badge = screen.getByText('Pill Badge');
      expect(badge).toHaveClass('rounded-full');
    });

    it('applies default rounded corners when pill is false', () => {
      render(<Badge pill={false}>Regular Badge</Badge>);
      const badge = screen.getByText('Regular Badge');
      expect(badge).toHaveClass('rounded-md');
      expect(badge).not.toHaveClass('rounded-full');
    });
  });

  describe('Interactions', () => {
    it('supports onClick handler', () => {
      const handleClick = jest.fn();
      render(<Badge onClick={handleClick}>Clickable</Badge>);
      const badge = screen.getByText('Clickable');
      fireEvent.click(badge);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('applies hover styles when clickable', () => {
      render(<Badge onClick={() => {}}>Hoverable</Badge>);
      const badge = screen.getByText('Hoverable');
      expect(badge).toHaveClass('cursor-pointer');
    });

    it('supports keyboard interaction when clickable', async () => {
      const handleClick = jest.fn();
      const user = userEvent.setup();
      render(<Badge onClick={handleClick}>Keyboard Badge</Badge>);
      const badge = screen.getByText('Keyboard Badge');
      badge.focus();
      await user.keyboard('{Enter}');
      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    it('has correct role when clickable', () => {
      render(<Badge onClick={() => {}}>Clickable Badge</Badge>);
      const badge = screen.getByText('Clickable Badge');
      expect(badge).toHaveAttribute('role', 'button');
    });

    it('has correct tabIndex when clickable', () => {
      render(<Badge onClick={() => {}}>Focusable</Badge>);
      const badge = screen.getByText('Focusable');
      expect(badge).toHaveAttribute('tabIndex', '0');
    });

    it('remove button has aria-label', () => {
      render(<Badge removable>Removable</Badge>);
      const removeButton = screen.getByRole('button', { name: /remove badge/i });
      expect(removeButton).toBeInTheDocument();
    });

    it('supports aria-label', () => {
      render(<Badge aria-label="Status badge">Status</Badge>);
      const badge = screen.getByText('Status');
      expect(badge).toHaveAttribute('aria-label', 'Status badge');
    });
  });

  describe('Edge Cases', () => {
    it('renders empty badge', () => {
      const { container } = render(<Badge />);
      expect(container.firstChild).toBeInTheDocument();
    });

    it('handles long text content', () => {
      const longText = 'This is a very long badge text that should wrap properly';
      render(<Badge>{longText}</Badge>);
      expect(screen.getByText(longText)).toBeInTheDocument();
    });

    it('prevents event bubbling on remove', () => {
      const handleBadgeClick = jest.fn();
      const handleRemove = jest.fn();
      render(
        <Badge onClick={handleBadgeClick} removable onRemove={handleRemove}>
          Badge
        </Badge>
      );
      const removeButton = screen.getByRole('button', { name: /remove/i });
      fireEvent.click(removeButton);
      expect(handleRemove).toHaveBeenCalled();
      expect(handleBadgeClick).not.toHaveBeenCalled();
    });
  });
});