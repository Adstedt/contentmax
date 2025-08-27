# ContentMax Coding Standards

## Overview
This document defines the coding standards and conventions for the ContentMax project. All code must adhere to these standards to ensure consistency, maintainability, and quality across the codebase.

## General Principles

### 1. Code Quality
- **Readability over cleverness** - Write code that junior developers can understand
- **Self-documenting code** - Use clear variable and function names
- **DRY (Don't Repeat Yourself)** - Extract common logic into reusable functions
- **KISS (Keep It Simple)** - Avoid unnecessary complexity
- **YAGNI (You Aren't Gonna Need It)** - Don't add functionality until needed

### 2. Comments
- Comment WHY, not WHAT - Code should be self-explanatory
- Use JSDoc for all public functions and components
- NO commented-out code in production
- Update comments when changing code logic

## TypeScript Standards

### Type Safety
```typescript
// ✅ GOOD - Explicit types
interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

function getUser(id: string): Promise<User> {
  // Implementation
}

// ❌ BAD - Using 'any'
function processData(data: any): any {
  // Avoid this
}
```

### Naming Conventions
- **Files**: kebab-case (e.g., `user-service.ts`, `auth-context.tsx`)
- **Components**: PascalCase files and exports (e.g., `UserProfile.tsx`)
- **Variables/Functions**: camelCase (e.g., `getUserById`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_RETRY_COUNT`)
- **Interfaces/Types**: PascalCase with 'I' prefix optional (e.g., `User` or `IUser`)
- **Enums**: PascalCase for name, UPPER_SNAKE_CASE for values

### File Organization
```typescript
// 1. Imports (grouped and ordered)
import React, { useState, useEffect } from 'react'; // React
import { useRouter } from 'next/navigation'; // Next.js
import { Button, Card } from '@/components/ui'; // Internal components
import { UserService } from '@/services'; // Services
import { User } from '@/types'; // Types
import { formatDate } from '@/utils'; // Utilities

// 2. Type definitions
interface Props {
  user: User;
  onUpdate: (user: User) => void;
}

// 3. Constants
const MAX_NAME_LENGTH = 100;

// 4. Component/Function
export function UserProfile({ user, onUpdate }: Props) {
  // Implementation
}

// 5. Exports (if not already exported)
```

## React/Next.js Standards

### Component Structure
```typescript
// ✅ GOOD - Functional component with proper typing
interface UserCardProps {
  user: User;
  onClick?: (id: string) => void;
  className?: string;
}

export function UserCard({ user, onClick, className }: UserCardProps) {
  const handleClick = () => {
    onClick?.(user.id);
  };

  return (
    <div className={cn('user-card', className)} onClick={handleClick}>
      <h3>{user.name}</h3>
      <p>{user.email}</p>
    </div>
  );
}

// ❌ BAD - No proper typing
export function UserCard({ user, onClick }) {
  // Avoid this
}
```

### Hooks Rules
- Custom hooks start with 'use' (e.g., `useAuth`, `useDebounce`)
- Place hooks at the top of components
- Extract complex logic into custom hooks
- Document hook dependencies

### State Management
```typescript
// ✅ GOOD - Clear state management
const [isLoading, setIsLoading] = useState(false);
const [error, setError] = useState<Error | null>(null);
const [data, setData] = useState<User[]>([]);

// ❌ BAD - Ambiguous state
const [state, setState] = useState({});
```

## API Standards

### Route Handlers (App Router)
```typescript
// app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const CreateUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
});

export async function POST(request: NextRequest) {
  try {
    // 1. Authentication check
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Validate input
    const body = await request.json();
    const validated = CreateUserSchema.parse(body);

    // 3. Business logic
    const user = await createUser(validated);

    // 4. Return response
    return NextResponse.json({ data: user }, { status: 201 });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }
    
    console.error('User creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### Error Handling
```typescript
// ✅ GOOD - Consistent error handling
class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// Usage
throw new AppError('User not found', 404, 'USER_NOT_FOUND');
```

## Database Standards (Supabase)

### Query Patterns
```typescript
// ✅ GOOD - Type-safe queries with error handling
async function getUserById(id: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching user:', error);
    throw new AppError('Failed to fetch user', 500);
  }

  return data;
}

// ❌ BAD - No error handling
async function getUser(id: string) {
  const { data } = await supabase.from('users').select('*').eq('id', id);
  return data;
}
```

### Transactions
```typescript
// Use RPC functions for transactions
const { data, error } = await supabase.rpc('transfer_credits', {
  from_user_id: userId,
  to_user_id: targetId,
  amount: 100
});
```

## Testing Standards

### Test Structure
```typescript
// __tests__/components/UserCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { UserCard } from '@/components/UserCard';

describe('UserCard', () => {
  const mockUser = {
    id: '1',
    name: 'Test User',
    email: 'test@example.com',
  };

  it('should render user information', () => {
    render(<UserCard user={mockUser} />);
    
    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  it('should call onClick when clicked', () => {
    const handleClick = jest.fn();
    render(<UserCard user={mockUser} onClick={handleClick} />);
    
    fireEvent.click(screen.getByText('Test User'));
    
    expect(handleClick).toHaveBeenCalledWith('1');
  });
});
```

### Test Naming
- Use descriptive test names
- Start with "should" for behavior tests
- Group related tests with describe blocks

## CSS/Styling Standards

### Tailwind Classes Order
```tsx
// ✅ GOOD - Consistent class order
<div className="
  {/* Layout */}
  flex flex-col gap-4
  {/* Sizing */}
  w-full max-w-4xl
  {/* Spacing */}
  p-6 mx-auto
  {/* Typography */}
  text-gray-900 font-medium
  {/* Background */}
  bg-white
  {/* Border */}
  border border-gray-200 rounded-lg
  {/* Effects */}
  shadow-sm
  {/* Interactions */}
  hover:shadow-md transition-shadow
">
```

### Component Styling
```typescript
// ✅ GOOD - Using cn() utility for conditional classes
import { cn } from '@/lib/utils';

<button
  className={cn(
    'px-4 py-2 rounded-md font-medium transition-colors',
    'bg-blue-600 text-white hover:bg-blue-700',
    disabled && 'opacity-50 cursor-not-allowed',
    className
  )}
/>
```

## Security Standards

### Input Validation
- Always validate user input on the server
- Use Zod schemas for validation
- Sanitize data before database operations
- Never trust client-side validation alone

### Authentication Checks
```typescript
// ✅ GOOD - Consistent auth pattern
export async function protectedRoute(request: NextRequest) {
  const session = await getServerSession();
  
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Check additional permissions if needed
  if (!hasPermission(session.user, 'resource:write')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  // Proceed with business logic
}
```

### Environment Variables
```typescript
// ✅ GOOD - Validate environment variables
const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'OPENAI_API_KEY'
];

requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    throw new Error(`Missing required environment variable: ${varName}`);
  }
});
```

## Performance Standards

### Image Optimization
```tsx
// ✅ GOOD - Using Next.js Image component
import Image from 'next/image';

<Image
  src="/hero.jpg"
  alt="Hero image"
  width={1920}
  height={1080}
  priority
  placeholder="blur"
  blurDataURL={shimmer}
/>
```

### Code Splitting
```typescript
// ✅ GOOD - Dynamic imports for heavy components
const HeavyComponent = dynamic(
  () => import('@/components/HeavyComponent'),
  { 
    loading: () => <Skeleton />,
    ssr: false 
  }
);
```

### Memoization
```typescript
// ✅ GOOD - Memoize expensive computations
const expensiveValue = useMemo(() => {
  return computeExpensiveValue(data);
}, [data]);

const memoizedCallback = useCallback((id: string) => {
  return fetchData(id);
}, []);
```

## Git Standards

### Commit Messages
```bash
# Format: <type>(<scope>): <subject>

feat(auth): add Google OAuth integration
fix(ui): resolve button alignment issue
docs(api): update endpoint documentation
refactor(users): simplify user service logic
test(auth): add login flow tests
```

### Branch Naming
- `feature/` - New features (e.g., `feature/user-dashboard`)
- `fix/` - Bug fixes (e.g., `fix/login-error`)
- `refactor/` - Code refactoring (e.g., `refactor/api-structure`)
- `docs/` - Documentation (e.g., `docs/api-guide`)

## Code Review Checklist

Before submitting PR:
- [ ] Code follows naming conventions
- [ ] TypeScript types are properly defined
- [ ] No `any` types without justification
- [ ] Error handling is implemented
- [ ] Tests are written and passing
- [ ] No console.log statements
- [ ] Security considerations addressed
- [ ] Performance impact considered
- [ ] Documentation updated if needed

## Enforcement

- ESLint configuration enforces these standards
- Prettier formats code automatically
- Pre-commit hooks run linting and tests
- CI/CD pipeline validates all standards
- Code reviews ensure compliance

## Exceptions

Exceptions to these standards must be:
1. Documented with clear justification
2. Marked with appropriate comments
3. Approved by technical lead
4. Added to technical debt backlog for future resolution