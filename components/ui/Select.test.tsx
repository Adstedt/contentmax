import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Select from './Select';

describe('Select Component', () => {
  const mockOptions = [
    { value: 'option1', label: 'Option 1' },
    { value: 'option2', label: 'Option 2' },
    { value: 'option3', label: 'Option 3' },
  ];

  describe('Rendering', () => {
    it('renders with default props', () => {
      render(<Select options={mockOptions} />);
      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
    });

    it('renders with custom className', () => {
      render(<Select options={mockOptions} className="custom-class" />);
      const select = screen.getByRole('combobox');
      expect(select).toHaveClass('custom-class');
    });

    it('forwards ref correctly', () => {
      const ref = React.createRef<HTMLSelectElement>();
      render(<Select options={mockOptions} ref={ref} />);
      expect(ref.current).toBeInstanceOf(HTMLSelectElement);
    });

    it('renders placeholder when provided', () => {
      render(<Select options={mockOptions} placeholder="Choose an option" />);
      expect(screen.getByText('Choose an option')).toBeInTheDocument();
    });
  });

  describe('Options', () => {
    it('renders all options', () => {
      render(<Select options={mockOptions} />);
      mockOptions.forEach(option => {
        expect(screen.getByText(option.label)).toBeInTheDocument();
      });
    });

    it('renders options with correct values', () => {
      const { container } = render(<Select options={mockOptions} />);
      const options = container.querySelectorAll('option[value]');
      expect(options).toHaveLength(mockOptions.length);
      options.forEach((option, index) => {
        expect(option).toHaveAttribute('value', mockOptions[index].value);
      });
    });

    it('renders disabled options', () => {
      const optionsWithDisabled = [
        { value: 'opt1', label: 'Option 1' },
        { value: 'opt2', label: 'Option 2', disabled: true },
      ];
      render(<Select options={optionsWithDisabled} />);
      const disabledOption = screen.getByText('Option 2');
      expect(disabledOption).toBeDisabled();
    });
  });

  describe('Label', () => {
    it('renders with label', () => {
      render(<Select options={mockOptions} label="Select Option" />);
      expect(screen.getByText('Select Option')).toBeInTheDocument();
    });

    it('associates label with select using htmlFor', () => {
      render(<Select options={mockOptions} label="Category" id="category-select" />);
      const label = screen.getByText('Category');
      const select = screen.getByRole('combobox');
      expect(label).toHaveAttribute('for', 'category-select');
      expect(select).toHaveAttribute('id', 'category-select');
    });
  });

  describe('Error State', () => {
    it('shows error message', () => {
      render(<Select options={mockOptions} error="Please select an option" />);
      expect(screen.getByText('Please select an option')).toBeInTheDocument();
    });

    it('applies error styling to select', () => {
      render(<Select options={mockOptions} error="Error" />);
      const select = screen.getByRole('combobox');
      expect(select).toHaveClass('border-red-500', 'focus:ring-red-500');
    });

    it('sets aria-invalid when error exists', () => {
      render(<Select options={mockOptions} error="Error" />);
      const select = screen.getByRole('combobox');
      expect(select).toHaveAttribute('aria-invalid', 'true');
    });

    it('sets aria-describedby for error message', () => {
      render(<Select options={mockOptions} error="Error message" id="test-select" />);
      const select = screen.getByRole('combobox');
      expect(select).toHaveAttribute('aria-describedby', 'test-select-error');
    });
  });

  describe('Hint Text', () => {
    it('shows hint text', () => {
      render(<Select options={mockOptions} hint="Select your preferred option" />);
      expect(screen.getByText('Select your preferred option')).toBeInTheDocument();
    });

    it('shows error instead of hint when both exist', () => {
      render(<Select options={mockOptions} hint="Hint text" error="Error text" />);
      expect(screen.getByText('Error text')).toBeInTheDocument();
      expect(screen.queryByText('Hint text')).not.toBeInTheDocument();
    });
  });

  describe('Disabled State', () => {
    it('disables select when disabled prop is true', () => {
      render(<Select options={mockOptions} disabled />);
      const select = screen.getByRole('combobox');
      expect(select).toBeDisabled();
    });

    it('applies disabled styling', () => {
      render(<Select options={mockOptions} disabled />);
      const select = screen.getByRole('combobox');
      expect(select).toHaveClass('opacity-50', 'cursor-not-allowed');
    });
  });

  describe('Value Handling', () => {
    it('displays selected value', () => {
      render(<Select options={mockOptions} value="option2" onChange={() => {}} />);
      const select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select.value).toBe('option2');
    });

    it('displays default value', () => {
      render(<Select options={mockOptions} defaultValue="option3" />);
      const select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select.value).toBe('option3');
    });

    it('handles empty value with placeholder', () => {
      render(<Select options={mockOptions} placeholder="Select..." value="" onChange={() => {}} />);
      const select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select.value).toBe('');
      expect(screen.getByText('Select...')).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('calls onChange when selection changes', () => {
      const handleChange = jest.fn();
      render(<Select options={mockOptions} onChange={handleChange} />);
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'option2' } });
      expect(handleChange).toHaveBeenCalled();
      expect(handleChange.mock.calls[0][0].target.value).toBe('option2');
    });

    it('calls onFocus when focused', () => {
      const handleFocus = jest.fn();
      render(<Select options={mockOptions} onFocus={handleFocus} />);
      const select = screen.getByRole('combobox');
      fireEvent.focus(select);
      expect(handleFocus).toHaveBeenCalledTimes(1);
    });

    it('calls onBlur when blurred', () => {
      const handleBlur = jest.fn();
      render(<Select options={mockOptions} onBlur={handleBlur} />);
      const select = screen.getByRole('combobox');
      fireEvent.focus(select);
      fireEvent.blur(select);
      expect(handleBlur).toHaveBeenCalledTimes(1);
    });
  });

  describe('Required State', () => {
    it('supports required attribute', () => {
      render(<Select options={mockOptions} required />);
      const select = screen.getByRole('combobox');
      expect(select).toHaveAttribute('required');
    });

    it('shows required indicator in label', () => {
      render(<Select options={mockOptions} label="Category" required />);
      const label = screen.getByText('Category');
      const requiredIndicator = label.querySelector('.text-red-500');
      expect(requiredIndicator).toBeInTheDocument();
      expect(requiredIndicator).toHaveTextContent('*');
    });
  });

  describe('Accessibility', () => {
    it('has correct focus styles', () => {
      render(<Select options={mockOptions} />);
      const select = screen.getByRole('combobox');
      expect(select).toHaveClass('focus:ring-2', 'focus:ring-blue-500');
    });

    it('supports aria-label', () => {
      render(<Select options={mockOptions} aria-label="Choose category" />);
      const select = screen.getByRole('combobox', { name: /choose category/i });
      expect(select).toBeInTheDocument();
    });

    it('has correct keyboard navigation', async () => {
      const user = userEvent.setup();
      render(
        <>
          <Select options={mockOptions} placeholder="First" />
          <Select options={mockOptions} placeholder="Second" />
        </>
      );
      const selects = screen.getAllByRole('combobox');
      
      selects[0].focus();
      expect(selects[0]).toHaveFocus();
      
      await user.tab();
      expect(selects[1]).toHaveFocus();
    });

    it('displays dropdown arrow icon', () => {
      const { container } = render(<Select options={mockOptions} />);
      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });
  });
});