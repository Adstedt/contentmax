import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Tooltip from './Tooltip';

describe('Tooltip Component', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('Rendering', () => {
    it('renders children', () => {
      render(
        <Tooltip content="Tooltip text">
          <button>Hover me</button>
        </Tooltip>
      );
      expect(screen.getByText('Hover me')).toBeInTheDocument();
    });

    it('does not show tooltip by default', () => {
      render(
        <Tooltip content="Tooltip text">
          <button>Button</button>
        </Tooltip>
      );
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('renders with custom className', () => {
      render(
        <Tooltip content="Tooltip" className="custom-tooltip">
          <button>Button</button>
        </Tooltip>
      );
      const button = screen.getByText('Button');
      fireEvent.mouseEnter(button);
      
      act(() => {
        jest.runAllTimers();
      });
      
      const tooltip = screen.getByRole('tooltip');
      expect(tooltip).toHaveClass('custom-tooltip');
    });
  });

  describe('Hover Interactions', () => {
    it('shows tooltip on mouse enter after delay', () => {
      render(
        <Tooltip content="Tooltip text" delay={200}>
          <button>Hover me</button>
        </Tooltip>
      );
      
      const button = screen.getByText('Hover me');
      fireEvent.mouseEnter(button);
      
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
      
      act(() => {
        jest.advanceTimersByTime(200);
      });
      
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
      expect(screen.getByText('Tooltip text')).toBeInTheDocument();
    });

    it('hides tooltip on mouse leave', () => {
      render(
        <Tooltip content="Tooltip text" delay={0}>
          <button>Hover me</button>
        </Tooltip>
      );
      
      const button = screen.getByText('Hover me');
      fireEvent.mouseEnter(button);
      
      act(() => {
        jest.runAllTimers();
      });
      
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
      
      fireEvent.mouseLeave(button);
      
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('cancels show timer on mouse leave before delay', () => {
      render(
        <Tooltip content="Tooltip text" delay={200}>
          <button>Hover me</button>
        </Tooltip>
      );
      
      const button = screen.getByText('Hover me');
      fireEvent.mouseEnter(button);
      
      act(() => {
        jest.advanceTimersByTime(100);
      });
      
      fireEvent.mouseLeave(button);
      
      act(() => {
        jest.advanceTimersByTime(200);
      });
      
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  describe('Focus Interactions', () => {
    it('shows tooltip on focus', () => {
      render(
        <Tooltip content="Tooltip text" delay={0}>
          <button>Focus me</button>
        </Tooltip>
      );
      
      const button = screen.getByText('Focus me');
      fireEvent.focus(button);
      
      act(() => {
        jest.runAllTimers();
      });
      
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    it('hides tooltip on blur', () => {
      render(
        <Tooltip content="Tooltip text" delay={0}>
          <button>Focus me</button>
        </Tooltip>
      );
      
      const button = screen.getByText('Focus me');
      fireEvent.focus(button);
      
      act(() => {
        jest.runAllTimers();
      });
      
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
      
      fireEvent.blur(button);
      
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  describe('Positions', () => {
    it('renders tooltip on top', () => {
      render(
        <Tooltip content="Tooltip" position="top" delay={0}>
          <button>Button</button>
        </Tooltip>
      );
      
      const button = screen.getByText('Button');
      fireEvent.mouseEnter(button);
      
      act(() => {
        jest.runAllTimers();
      });
      
      const tooltip = screen.getByRole('tooltip');
      expect(tooltip).toHaveClass('bottom-full', 'mb-2');
    });

    it('renders tooltip on bottom', () => {
      render(
        <Tooltip content="Tooltip" position="bottom" delay={0}>
          <button>Button</button>
        </Tooltip>
      );
      
      const button = screen.getByText('Button');
      fireEvent.mouseEnter(button);
      
      act(() => {
        jest.runAllTimers();
      });
      
      const tooltip = screen.getByRole('tooltip');
      expect(tooltip).toHaveClass('top-full', 'mt-2');
    });

    it('renders tooltip on left', () => {
      render(
        <Tooltip content="Tooltip" position="left" delay={0}>
          <button>Button</button>
        </Tooltip>
      );
      
      const button = screen.getByText('Button');
      fireEvent.mouseEnter(button);
      
      act(() => {
        jest.runAllTimers();
      });
      
      const tooltip = screen.getByRole('tooltip');
      expect(tooltip).toHaveClass('right-full', 'mr-2');
    });

    it('renders tooltip on right', () => {
      render(
        <Tooltip content="Tooltip" position="right" delay={0}>
          <button>Button</button>
        </Tooltip>
      );
      
      const button = screen.getByText('Button');
      fireEvent.mouseEnter(button);
      
      act(() => {
        jest.runAllTimers();
      });
      
      const tooltip = screen.getByRole('tooltip');
      expect(tooltip).toHaveClass('left-full', 'ml-2');
    });
  });

  describe('Arrow', () => {
    it('renders arrow pointing to trigger', () => {
      render(
        <Tooltip content="Tooltip" position="top" delay={0}>
          <button>Button</button>
        </Tooltip>
      );
      
      const button = screen.getByText('Button');
      fireEvent.mouseEnter(button);
      
      act(() => {
        jest.runAllTimers();
      });
      
      const tooltip = screen.getByRole('tooltip');
      const arrow = tooltip.querySelector('.w-0.h-0');
      expect(arrow).toBeInTheDocument();
    });

    it('arrow has correct position for top tooltip', () => {
      render(
        <Tooltip content="Tooltip" position="top" delay={0}>
          <button>Button</button>
        </Tooltip>
      );
      
      const button = screen.getByText('Button');
      fireEvent.mouseEnter(button);
      
      act(() => {
        jest.runAllTimers();
      });
      
      const tooltip = screen.getByRole('tooltip');
      const arrow = tooltip.querySelector('.top-full');
      expect(arrow).toBeInTheDocument();
    });
  });

  describe('Content Types', () => {
    it('renders text content', () => {
      render(
        <Tooltip content="Simple text" delay={0}>
          <button>Button</button>
        </Tooltip>
      );
      
      const button = screen.getByText('Button');
      fireEvent.mouseEnter(button);
      
      act(() => {
        jest.runAllTimers();
      });
      
      expect(screen.getByText('Simple text')).toBeInTheDocument();
    });

    it('renders JSX content', () => {
      render(
        <Tooltip
          content={
            <div>
              <strong>Bold text</strong>
              <span> and normal text</span>
            </div>
          }
          delay={0}
        >
          <button>Button</button>
        </Tooltip>
      );
      
      const button = screen.getByText('Button');
      fireEvent.mouseEnter(button);
      
      act(() => {
        jest.runAllTimers();
      });
      
      expect(screen.getByText('Bold text')).toBeInTheDocument();
      expect(screen.getByText('and normal text')).toBeInTheDocument();
    });
  });

  describe('Delay', () => {
    it('respects custom delay', () => {
      render(
        <Tooltip content="Tooltip" delay={500}>
          <button>Button</button>
        </Tooltip>
      );
      
      const button = screen.getByText('Button');
      fireEvent.mouseEnter(button);
      
      act(() => {
        jest.advanceTimersByTime(400);
      });
      
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
      
      act(() => {
        jest.advanceTimersByTime(100);
      });
      
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    it('shows immediately with delay=0', () => {
      render(
        <Tooltip content="Tooltip" delay={0}>
          <button>Button</button>
        </Tooltip>
      );
      
      const button = screen.getByText('Button');
      fireEvent.mouseEnter(button);
      
      act(() => {
        jest.runAllTimers();
      });
      
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has role tooltip', () => {
      render(
        <Tooltip content="Tooltip text" delay={0}>
          <button>Button</button>
        </Tooltip>
      );
      
      const button = screen.getByText('Button');
      fireEvent.mouseEnter(button);
      
      act(() => {
        jest.runAllTimers();
      });
      
      const tooltip = screen.getByRole('tooltip');
      expect(tooltip).toBeInTheDocument();
    });

    it('tooltip is not focusable', () => {
      render(
        <Tooltip content="Tooltip text" delay={0}>
          <button>Button</button>
        </Tooltip>
      );
      
      const button = screen.getByText('Button');
      fireEvent.mouseEnter(button);
      
      act(() => {
        jest.runAllTimers();
      });
      
      const tooltip = screen.getByRole('tooltip');
      expect(tooltip).toHaveClass('pointer-events-none');
    });

    it('supports keyboard users', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      
      render(
        <Tooltip content="Tooltip text" delay={200}>
          <button>Button</button>
        </Tooltip>
      );
      
      const button = screen.getByText('Button');
      await user.tab();
      
      expect(button).toHaveFocus();
      
      act(() => {
        jest.runAllTimers();
      });
      
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });
  });

  describe('Styling', () => {
    it('has correct default styles', () => {
      render(
        <Tooltip content="Tooltip" delay={0}>
          <button>Button</button>
        </Tooltip>
      );
      
      const button = screen.getByText('Button');
      fireEvent.mouseEnter(button);
      
      act(() => {
        jest.runAllTimers();
      });
      
      const tooltip = screen.getByRole('tooltip');
      expect(tooltip).toHaveClass(
        'bg-gray-800',
        'text-white',
        'text-sm',
        'rounded-md',
        'shadow-lg'
      );
    });

    it('applies transition classes', () => {
      render(
        <Tooltip content="Tooltip" delay={0}>
          <button>Button</button>
        </Tooltip>
      );
      
      const button = screen.getByText('Button');
      fireEvent.mouseEnter(button);
      
      act(() => {
        jest.runAllTimers();
      });
      
      const tooltip = screen.getByRole('tooltip');
      expect(tooltip).toHaveClass('transition-opacity', 'duration-200');
    });
  });

  describe('Cleanup', () => {
    it('cleans up timeout on unmount', () => {
      const { unmount } = render(
        <Tooltip content="Tooltip" delay={200}>
          <button>Button</button>
        </Tooltip>
      );
      
      const button = screen.getByText('Button');
      fireEvent.mouseEnter(button);
      
      unmount();
      
      act(() => {
        jest.runAllTimers();
      });
      
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });
});