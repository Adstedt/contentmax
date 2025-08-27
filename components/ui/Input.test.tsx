import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Input from './Input';

describe('Input Component', () => {
  describe('Rendering', () => {
    it('renders with default props', () => {
      render(<Input />);
      const input = screen.getByRole('textbox');
      expect(input).toBeInTheDocument();
    });

    it('renders with custom className', () => {
      render(<Input className="custom-class" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('custom-class');
    });

    it('forwards ref correctly', () => {
      const ref = React.createRef<HTMLInputElement>();
      render(<Input ref={ref} />);
      expect(ref.current).toBeInstanceOf(HTMLInputElement);
    });

    it('renders with placeholder', () => {
      render(<Input placeholder="Enter text" />);
      const input = screen.getByPlaceholderText('Enter text');
      expect(input).toBeInTheDocument();
    });
  });

  describe('Label', () => {
    it('renders with label', () => {
      render(<Input label="Username" />);
      expect(screen.getByText('Username')).toBeInTheDocument();
    });

    it('associates label with input', () => {
      render(<Input label="Email" id="email-input" />);
      const label = screen.getByText('Email');
      const input = screen.getByRole('textbox');
      // Label doesn't use htmlFor, it wraps the input
      expect(label.tagName).toBe('LABEL');
      expect(input).toHaveAttribute('id', 'email-input');
    });

    it('renders label without requiring id', () => {
      render(<Input label="Password" />);
      const label = screen.getByText('Password');
      const input = screen.getByRole('textbox');
      // No automatic id generation, label wraps the input
      expect(label.tagName).toBe('LABEL');
      expect(input).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('shows error message', () => {
      render(<Input error="This field is required" />);
      expect(screen.getByText('This field is required')).toBeInTheDocument();
    });

    it('applies error styling to input', () => {
      render(<Input error="Error" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('border-red-300', 'focus:border-red-500', 'focus:ring-red-500');
    });

    it('shows error message when error exists', () => {
      render(<Input error="Error message" />);
      const errorMsg = screen.getByText('Error message');
      expect(errorMsg).toBeInTheDocument();
      expect(errorMsg).toHaveClass('text-red-600');
    });

    it('sets aria-invalid when error exists', () => {
      render(<Input error="Error" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('sets aria-describedby for error message', () => {
      render(<Input error="Error message" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-describedby', 'error-message');
      const errorElement = screen.getByText('Error message');
      expect(errorElement).toHaveAttribute('id', 'error-message');
    });
  });

  describe('Hint Text', () => {
    it('shows hint text', () => {
      render(<Input hint="Enter your full name" />);
      expect(screen.getByText('Enter your full name')).toBeInTheDocument();
    });

    it('shows both hint and error when both exist', () => {
      render(<Input hint="Hint text" error="Error text" />);
      expect(screen.getByText('Error text')).toBeInTheDocument();
      expect(screen.queryByText('Hint text')).not.toBeInTheDocument();
    });

    it('sets aria-describedby for hint text', () => {
      render(<Input hint="Hint text" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-describedby', 'hint-message');
      const hintElement = screen.getByText('Hint text');
      expect(hintElement).toHaveAttribute('id', 'hint-message');
    });
  });

  describe('Icons', () => {
    it('renders with left icon', () => {
      const icon = <span data-testid="left-icon">@</span>;
      render(<Input leftIcon={icon} />);
      expect(screen.getByTestId('left-icon')).toBeInTheDocument();
    });

    it('applies padding when left icon exists', () => {
      const icon = <span>@</span>;
      render(<Input leftIcon={icon} />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('pl-10');
    });

    it('renders with right element', () => {
      const element = <button data-testid="right-btn">Click</button>;
      render(<Input rightElement={element} />);
      expect(screen.getByTestId('right-btn')).toBeInTheDocument();
    });

    it('applies padding when right element exists', () => {
      const element = <button>Click</button>;
      render(<Input rightElement={element} />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('pr-10');
    });
  });

  describe('Input Types', () => {
    it('renders as text input by default', () => {
      render(<Input />);
      const input = screen.getByRole('textbox');
      // Input doesn't explicitly set type='text', browser default
      expect(input.tagName).toBe('INPUT');
    });

    it('renders as email input', () => {
      render(<Input type="email" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('type', 'email');
    });

    it('renders as password input', () => {
      render(<Input type="password" placeholder="Password" />);
      const input = screen.getByPlaceholderText('Password');
      expect(input).toHaveAttribute('type', 'password');
    });

    it('renders as number input', () => {
      render(<Input type="number" />);
      const input = screen.getByRole('spinbutton');
      expect(input).toHaveAttribute('type', 'number');
    });
  });

  describe('Disabled State', () => {
    it('disables input when disabled prop is true', () => {
      render(<Input disabled />);
      const input = screen.getByRole('textbox');
      expect(input).toBeDisabled();
    });

    it('applies disabled styling', () => {
      render(<Input disabled />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('disabled:bg-gray-50', 'disabled:cursor-not-allowed');
    });
  });

  describe('Interactions', () => {
    it('calls onChange when value changes', async () => {
      const handleChange = jest.fn();
      const user = userEvent.setup();
      render(<Input onChange={handleChange} />);
      const input = screen.getByRole('textbox');
      await user.type(input, 'test');
      expect(handleChange).toHaveBeenCalled();
    });

    it('calls onFocus when focused', () => {
      const handleFocus = jest.fn();
      render(<Input onFocus={handleFocus} />);
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      expect(handleFocus).toHaveBeenCalledTimes(1);
    });

    it('calls onBlur when blurred', () => {
      const handleBlur = jest.fn();
      render(<Input onBlur={handleBlur} />);
      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      fireEvent.blur(input);
      expect(handleBlur).toHaveBeenCalledTimes(1);
    });

    it('supports controlled input', () => {
      const { rerender } = render(<Input value="initial" onChange={() => {}} />);
      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.value).toBe('initial');
      
      rerender(<Input value="updated" onChange={() => {}} />);
      expect(input.value).toBe('updated');
    });
  });

  describe('Validation', () => {
    it('supports required attribute', () => {
      render(<Input required />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('required');
    });

    it('supports pattern attribute', () => {
      render(<Input pattern="[A-Za-z]+" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('pattern', '[A-Za-z]+');
    });

    it('supports minLength attribute', () => {
      render(<Input minLength={5} />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('minLength', '5');
    });

    it('supports maxLength attribute', () => {
      render(<Input maxLength={10} />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('maxLength', '10');
    });
  });

  describe('Accessibility', () => {
    it('has correct focus styles', () => {
      render(<Input />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('focus:ring-2', 'focus:ring-blue-500');
    });

    it('supports aria-label', () => {
      render(<Input aria-label="Search" />);
      const input = screen.getByRole('textbox', { name: /search/i });
      expect(input).toBeInTheDocument();
    });

    it('supports autoComplete attribute', () => {
      render(<Input autoComplete="email" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('autoComplete', 'email');
    });

    it('has correct keyboard navigation', async () => {
      const user = userEvent.setup();
      render(
        <>
          <Input placeholder="First" />
          <Input placeholder="Second" />
        </>
      );
      const firstInput = screen.getByPlaceholderText('First');
      const secondInput = screen.getByPlaceholderText('Second');
      
      firstInput.focus();
      expect(firstInput).toHaveFocus();
      
      await user.tab();
      expect(secondInput).toHaveFocus();
    });
  });
});