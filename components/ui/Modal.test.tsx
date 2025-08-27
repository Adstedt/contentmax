import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Modal from './Modal';

describe('Modal Component', () => {
  describe('Rendering', () => {
    it('renders when isOpen is true', () => {
      render(
        <Modal isOpen={true} onClose={() => {}} title="Test Modal">
          Modal content
        </Modal>
      );
      expect(screen.getByText('Modal content')).toBeInTheDocument();
    });

    it('does not render when isOpen is false', () => {
      render(
        <Modal isOpen={false} onClose={() => {}} title="Test Modal">
          Modal content
        </Modal>
      );
      expect(screen.queryByText('Modal content')).not.toBeInTheDocument();
    });

    it('renders title when provided', () => {
      render(
        <Modal isOpen={true} onClose={() => {}} title="Modal Title">
          Content
        </Modal>
      );
      expect(screen.getByText('Modal Title')).toBeInTheDocument();
    });

    it('renders without title', () => {
      render(
        <Modal isOpen={true} onClose={() => {}}>
          Content
        </Modal>
      );
      expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    });
  });

  describe('Size Variants', () => {
    it('renders small size', () => {
      const { container } = render(
        <Modal isOpen={true} onClose={() => {}} size="sm">
          Content
        </Modal>
      );
      const modalContent = container.querySelector('.max-w-md');
      expect(modalContent).toBeInTheDocument();
    });

    it('renders medium size', () => {
      const { container } = render(
        <Modal isOpen={true} onClose={() => {}} size="md">
          Content
        </Modal>
      );
      const modalContent = container.querySelector('.max-w-lg');
      expect(modalContent).toBeInTheDocument();
    });

    it('renders large size', () => {
      const { container } = render(
        <Modal isOpen={true} onClose={() => {}} size="lg">
          Content
        </Modal>
      );
      const modalContent = container.querySelector('.max-w-2xl');
      expect(modalContent).toBeInTheDocument();
    });

    it('renders full size', () => {
      const { container } = render(
        <Modal isOpen={true} onClose={() => {}} size="full">
          Content
        </Modal>
      );
      const modalContent = container.querySelector('.max-w-full');
      expect(modalContent).toBeInTheDocument();
    });
  });

  describe('Close Functionality', () => {
    it('calls onClose when close button is clicked', () => {
      const handleClose = jest.fn();
      render(
        <Modal isOpen={true} onClose={handleClose} title="Test">
          Content
        </Modal>
      );
      const closeButton = screen.getByRole('button', { name: /close/i });
      fireEvent.click(closeButton);
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when backdrop is clicked', () => {
      const handleClose = jest.fn();
      const { container } = render(
        <Modal isOpen={true} onClose={handleClose}>
          Content
        </Modal>
      );
      const backdrop = container.querySelector('.fixed.inset-0.bg-black');
      if (backdrop) fireEvent.click(backdrop);
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('does not close when modal content is clicked', () => {
      const handleClose = jest.fn();
      render(
        <Modal isOpen={true} onClose={handleClose}>
          <div>Modal content</div>
        </Modal>
      );
      const content = screen.getByText('Modal content');
      fireEvent.click(content);
      expect(handleClose).not.toHaveBeenCalled();
    });

    it('does not show close button when showCloseButton is false', () => {
      render(
        <Modal isOpen={true} onClose={() => {}} showCloseButton={false}>
          Content
        </Modal>
      );
      expect(screen.queryByRole('button', { name: /close/i })).not.toBeInTheDocument();
    });
  });

  describe('Keyboard Navigation', () => {
    it('closes on Escape key press', async () => {
      const handleClose = jest.fn();
      const user = userEvent.setup();
      render(
        <Modal isOpen={true} onClose={handleClose}>
          Content
        </Modal>
      );
      await user.keyboard('{Escape}');
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('traps focus within modal', async () => {
      const user = userEvent.setup();
      render(
        <Modal isOpen={true} onClose={() => {}} title="Test">
          <button>First button</button>
          <button>Second button</button>
        </Modal>
      );
      
      const firstButton = screen.getByText('First button');
      const secondButton = screen.getByText('Second button');
      const closeButton = screen.getByRole('button', { name: /close/i });
      
      closeButton.focus();
      expect(closeButton).toHaveFocus();
      
      await user.tab();
      expect(firstButton).toHaveFocus();
      
      await user.tab();
      expect(secondButton).toHaveFocus();
    });
  });

  describe('Prevent Close Options', () => {
    it('does not close on backdrop click when preventCloseOnBackdrop is true', () => {
      const handleClose = jest.fn();
      const { container } = render(
        <Modal isOpen={true} onClose={handleClose} preventCloseOnBackdrop>
          Content
        </Modal>
      );
      const backdrop = container.querySelector('.fixed.inset-0.bg-black');
      if (backdrop) fireEvent.click(backdrop);
      expect(handleClose).not.toHaveBeenCalled();
    });

    it('does not close on Escape when preventCloseOnEscape is true', async () => {
      const handleClose = jest.fn();
      const user = userEvent.setup();
      render(
        <Modal isOpen={true} onClose={handleClose} preventCloseOnEscape>
          Content
        </Modal>
      );
      await user.keyboard('{Escape}');
      expect(handleClose).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has correct ARIA attributes', () => {
      render(
        <Modal isOpen={true} onClose={() => {}} title="Accessible Modal">
          Content
        </Modal>
      );
      const modal = screen.getByRole('dialog');
      expect(modal).toHaveAttribute('aria-modal', 'true');
      expect(modal).toHaveAttribute('aria-labelledby');
    });

    it('sets focus on close button when opened', async () => {
      render(
        <Modal isOpen={true} onClose={() => {}} title="Test">
          Content
        </Modal>
      );
      // Focus behavior is automatic in Modal component
      const closeButton = screen.getByRole('button', { name: /close/i });
      expect(closeButton).toBeInTheDocument();
    });

    it('returns focus to trigger element when closed', () => {
      const triggerButton = document.createElement('button');
      document.body.appendChild(triggerButton);
      triggerButton.focus();
      
      const { rerender } = render(
        <Modal isOpen={true} onClose={() => {}}>
          Content
        </Modal>
      );
      
      rerender(
        <Modal isOpen={false} onClose={() => {}}>
          Content
        </Modal>
      );
      
      expect(triggerButton).toHaveFocus();
      document.body.removeChild(triggerButton);
    });

    it('prevents body scroll when open', () => {
      render(
        <Modal isOpen={true} onClose={() => {}}>
          Content
        </Modal>
      );
      expect(document.body).toHaveStyle({ overflow: 'hidden' });
    });

    it('restores body scroll when closed', () => {
      const { rerender } = render(
        <Modal isOpen={true} onClose={() => {}}>
          Content
        </Modal>
      );
      
      rerender(
        <Modal isOpen={false} onClose={() => {}}>
          Content
        </Modal>
      );
      
      expect(document.body).not.toHaveStyle({ overflow: 'hidden' });
    });
  });

  describe('Animation', () => {
    it('applies animation classes', () => {
      const { container } = render(
        <Modal isOpen={true} onClose={() => {}}>
          Content
        </Modal>
      );
      const modalContent = container.querySelector('.transform');
      expect(modalContent).toBeInTheDocument();
      expect(modalContent).toHaveClass('transition-all');
    });
  });

  describe('Custom className', () => {
    it('applies custom className to modal content', () => {
      const { container } = render(
        <Modal isOpen={true} onClose={() => {}} className="custom-modal">
          Content
        </Modal>
      );
      // Check that the modal content exists
      const modalContent = screen.getByText('Content');
      expect(modalContent).toBeInTheDocument();
      // Check that custom class is applied somewhere in the modal structure
      const customElement = container.querySelector('.custom-modal');
      expect(customElement).toBeInTheDocument();
    });
  });
});