# Story 1.5: Component Library Setup

## User Story
As a developer,
I want a consistent set of base UI components,
So that we can build interfaces quickly with uniform styling.

## Size & Priority
- **Size**: S (2 hours)
- **Priority**: P1 - High
- **Sprint**: 1
- **Dependencies**: Task 1.1

## Description
Create base UI components using Tailwind CSS with consistent styling patterns, TypeScript interfaces, and accessibility features.

## Implementation Steps

1. **Create base component structure**
   - Set up components/ui directory
   - Implement variant patterns
   - Add TypeScript interfaces
   - Configure class name merging

2. **Implement core components**
   - Button with variants
   - Card with sections
   - Input with validation states
   - Select/dropdown
   - Modal/dialog
   - Badge/chip
   - Spinner/loading

3. **Set up utility functions**
   ```typescript
   // lib/utils.ts
   import { clsx, type ClassValue } from 'clsx'
   import { twMerge } from 'tailwind-merge'

   export function cn(...inputs: ClassValue[]) {
     return twMerge(clsx(inputs))
   }
   ```

## Files to Create

- `components/ui/Button.tsx` - Button component with variants
- `components/ui/Card.tsx` - Card container component
- `components/ui/Input.tsx` - Text input component
- `components/ui/Select.tsx` - Select dropdown component
- `components/ui/Modal.tsx` - Modal dialog component
- `components/ui/Badge.tsx` - Badge/chip component
- `components/ui/Spinner.tsx` - Loading spinner
- `components/ui/Alert.tsx` - Alert message component
- `components/ui/Tooltip.tsx` - Tooltip component
- `lib/utils.ts` - Utility functions

## Component Specifications

### Button Component
```typescript
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

// Example usage:
<Button variant="primary" size="md" loading={isLoading}>
  Save Changes
</Button>
```

### Input Component
```typescript
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  leftIcon?: React.ReactNode
  rightElement?: React.ReactNode
}

// Features:
// - Label positioning
// - Error state styling
// - Helper text
// - Icon support
// - Validation feedback
```

### Card Component
```typescript
interface CardProps {
  children: React.ReactNode
  className?: string
  padding?: 'none' | 'sm' | 'md' | 'lg'
  shadow?: 'none' | 'sm' | 'md' | 'lg'
  border?: boolean
}

// With sub-components:
// - Card.Header
// - Card.Body
// - Card.Footer
```

## Design System

### Component Variants
```typescript
const buttonVariants = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700',
  secondary: 'bg-gray-600 text-white hover:bg-gray-700',
  outline: 'border border-gray-300 hover:bg-gray-50',
  ghost: 'hover:bg-gray-100',
  danger: 'bg-red-600 text-white hover:bg-red-700'
}

const sizeVariants = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-base',
  lg: 'px-6 py-3 text-lg'
}
```

### Consistent Patterns
- Border radius: rounded-md (6px)
- Shadows: shadow-sm, shadow-md, shadow-lg
- Transitions: transition-all duration-200
- Focus states: focus:ring-2 focus:ring-blue-500
- Disabled states: opacity-50 cursor-not-allowed

## Accessibility Features

- [ ] Proper ARIA attributes
- [ ] Keyboard navigation support
- [ ] Focus management
- [ ] Screen reader compatibility
- [ ] Color contrast compliance
- [ ] Touch targets minimum 44x44px

## Acceptance Criteria

- [ ] All components render correctly
- [ ] TypeScript types properly defined
- [ ] Variants working as expected
- [ ] Accessibility requirements met
- [ ] Components are composable
- [ ] Consistent styling across components
- [ ] Props properly documented
- [ ] Examples provided for each component

## Documentation Requirements

Each component should include:
- TypeScript interface documentation
- Usage examples
- Variant demonstrations
- Accessibility notes
- Common patterns

Example:
```tsx
/**
 * Button component with multiple variants and sizes
 * 
 * @example
 * <Button variant="primary" size="md">
 *   Click me
 * </Button>
 */
```

## Testing Requirements

- [ ] Unit tests for component logic
- [ ] Render tests for all variants
- [ ] Accessibility tests (axe-core)
- [ ] Keyboard navigation tests
- [ ] Visual regression tests (optional)

## Definition of Done

- [ ] Code complete and committed
- [ ] All components implemented
- [ ] TypeScript types defined
- [ ] Accessibility verified
- [ ] Documentation complete
- [ ] Tests written
- [ ] Peer review completed