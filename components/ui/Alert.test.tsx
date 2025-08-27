import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Alert from './Alert';

describe('Alert Component', () => {
  describe('Rendering', () => {
    it('renders with default props', () => {
      render(<Alert>Default alert message</Alert>);
      expect(screen.getByText('Default alert message')).toBeInTheDocument();
    });

    it('renders with custom className', () => {
      render(<Alert className="custom-alert">Alert</Alert>);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('custom-alert');
    });

    it('renders as alert role', () => {
      render(<Alert>Alert message</Alert>);
      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
    });
  });

  describe('Variants', () => {
    it('renders info variant correctly', () => {
      render(<Alert variant="info">Info alert</Alert>);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('bg-blue-50', 'text-blue-800', 'border-blue-200');
    });

    it('renders success variant correctly', () => {
      render(<Alert variant="success">Success alert</Alert>);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('bg-green-50', 'text-green-800', 'border-green-200');
    });

    it('renders warning variant correctly', () => {
      render(<Alert variant="warning">Warning alert</Alert>);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('bg-yellow-50', 'text-yellow-800', 'border-yellow-200');
    });

    it('renders error variant correctly', () => {
      render(<Alert variant="error">Error alert</Alert>);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('bg-red-50', 'text-red-800', 'border-red-200');
    });

    it('displays correct icon for info variant', () => {
      const { container } = render(<Alert variant="info">Info</Alert>);
      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });

    it('displays correct icon for success variant', () => {
      const { container } = render(<Alert variant="success">Success</Alert>);
      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });

    it('displays correct icon for warning variant', () => {
      const { container } = render(<Alert variant="warning">Warning</Alert>);
      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });

    it('displays correct icon for error variant', () => {
      const { container } = render(<Alert variant="error">Error</Alert>);
      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });
  });

  describe('Title', () => {
    it('renders with title', () => {
      render(<Alert title="Alert Title">Alert content</Alert>);
      expect(screen.getByText('Alert Title')).toBeInTheDocument();
      expect(screen.getByText('Alert content')).toBeInTheDocument();
    });

    it('renders title with correct styling', () => {
      render(<Alert title="Title">Content</Alert>);
      const title = screen.getByText('Title');
      expect(title).toHaveClass('font-semibold');
    });

    it('renders without title', () => {
      render(<Alert>Just content</Alert>);
      expect(screen.getByText('Just content')).toBeInTheDocument();
      expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    });
  });

  describe('Dismissible', () => {
    it('shows dismiss button when dismissible is true', () => {
      render(<Alert dismissible>Dismissible alert</Alert>);
      const dismissButton = screen.getByRole('button', { name: /dismiss/i });
      expect(dismissButton).toBeInTheDocument();
    });

    it('does not show dismiss button when dismissible is false', () => {
      render(<Alert dismissible={false}>Non-dismissible alert</Alert>);
      const dismissButton = screen.queryByRole('button', { name: /dismiss/i });
      expect(dismissButton).not.toBeInTheDocument();
    });

    it('calls onDismiss when dismiss button is clicked', () => {
      const handleDismiss = jest.fn();
      render(
        <Alert dismissible onDismiss={handleDismiss}>
          Dismissible alert
        </Alert>
      );
      const dismissButton = screen.getByRole('button', { name: /dismiss/i });
      fireEvent.click(dismissButton);
      expect(handleDismiss).toHaveBeenCalledTimes(1);
    });

    it('removes alert from DOM when dismissed without onDismiss handler', () => {
      const { container } = render(
        <Alert dismissible>Dismissible alert</Alert>
      );
      const dismissButton = screen.getByRole('button', { name: /dismiss/i });
      fireEvent.click(dismissButton);
      expect(container.firstChild).toBeNull();
    });

    it('shows X icon in dismiss button', () => {
      const { container } = render(
        <Alert dismissible>Alert</Alert>
      );
      const dismissButton = screen.getByRole('button', { name: /dismiss/i });
      const icon = dismissButton.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });
  });

  describe('Icons', () => {
    it('shows icon by default', () => {
      const { container } = render(<Alert>Alert with icon</Alert>);
      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });

    it('hides icon when showIcon is false', () => {
      const { container } = render(<Alert showIcon={false}>Alert without icon</Alert>);
      // The dismiss button might have an icon, so we check for the alert icon specifically
      const icons = container.querySelectorAll('svg');
      expect(icons).toHaveLength(0);
    });

    it('renders custom icon', () => {
      const customIcon = <span data-testid="custom-icon">⚡</span>;
      render(<Alert icon={customIcon}>Alert with custom icon</Alert>);
      expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
    });
  });

  describe('Actions', () => {
    it('renders action buttons', () => {
      const actions = (
        <button type="button">Action Button</button>
      );
      render(<Alert actions={actions}>Alert with actions</Alert>);
      expect(screen.getByText('Action Button')).toBeInTheDocument();
    });

    it('positions actions correctly', () => {
      const actions = <button>Action</button>;
      const { container } = render(
        <Alert actions={actions}>Alert content</Alert>
      );
      const actionsContainer = screen.getByText('Action').parentElement;
      expect(actionsContainer).toHaveClass('mt-4');
    });

    it('supports multiple action buttons', () => {
      const actions = (
        <>
          <button>Action 1</button>
          <button>Action 2</button>
        </>
      );
      render(<Alert actions={actions}>Alert</Alert>);
      expect(screen.getByText('Action 1')).toBeInTheDocument();
      expect(screen.getByText('Action 2')).toBeInTheDocument();
    });
  });

  describe('Compact Mode', () => {
    it('applies compact styling when compact is true', () => {
      render(<Alert compact>Compact alert</Alert>);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('p-3');
    });

    it('applies normal padding when compact is false', () => {
      render(<Alert compact={false}>Normal alert</Alert>);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('p-4');
    });
  });

  describe('Accessibility', () => {
    it('has correct aria-live attribute for info', () => {
      render(<Alert variant="info">Info</Alert>);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('aria-live', 'polite');
    });

    it('has correct aria-live attribute for error', () => {
      render(<Alert variant="error">Error</Alert>);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('aria-live', 'assertive');
    });

    it('dismiss button has aria-label', () => {
      render(<Alert dismissible>Alert</Alert>);
      const dismissButton = screen.getByRole('button', { name: /dismiss alert/i });
      expect(dismissButton).toBeInTheDocument();
    });

    it('supports keyboard navigation for dismiss', async () => {
      const handleDismiss = jest.fn();
      const user = userEvent.setup();
      render(
        <Alert dismissible onDismiss={handleDismiss}>
          Alert
        </Alert>
      );
      const dismissButton = screen.getByRole('button', { name: /dismiss/i });
      dismissButton.focus();
      await user.keyboard('{Enter}');
      expect(handleDismiss).toHaveBeenCalledTimes(1);
    });
  });

  describe('Complex Content', () => {
    it('renders with HTML content', () => {
      render(
        <Alert>
          <div>
            <p>Paragraph 1</p>
            <p>Paragraph 2</p>
          </div>
        </Alert>
      );
      expect(screen.getByText('Paragraph 1')).toBeInTheDocument();
      expect(screen.getByText('Paragraph 2')).toBeInTheDocument();
    });

    it('renders with list content', () => {
      render(
        <Alert>
          <ul>
            <li>Item 1</li>
            <li>Item 2</li>
          </ul>
        </Alert>
      );
      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.getByText('Item 2')).toBeInTheDocument();
    });
  });

  describe('Animations', () => {
    it('applies fade-in animation when appearing', () => {
      const { rerender } = render(<div />);
      rerender(<Alert>Animated alert</Alert>);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('transition-all');
    });
  });
});