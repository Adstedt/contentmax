# Story 1.3: Authentication Implementation

## User Story
As a user,
I want to securely log in with Google or email/password,
So that I can access my content management workspace.

## Size & Priority
- **Size**: L (8 hours)
- **Priority**: P0 - Critical
- **Sprint**: 1
- **Dependencies**: Task 1.2

## Description
Implement Supabase Auth with Google OAuth and email/password authentication, including protected routes and session management.

## Implementation Steps

1. **Configure Supabase Auth providers**
   - Enable Email provider in Supabase dashboard
   - Configure Google OAuth with credentials from external-services-setup.md
   - Set redirect URLs for OAuth callbacks

2. **Create authentication pages**
   - Login page with email/password and Google OAuth
   - Signup page with validation
   - Password reset flow
   - Email confirmation handling

3. **Implement auth middleware**
   ```typescript
   // middleware.ts
   import { createServerClient } from '@supabase/ssr'
   import { NextResponse } from 'next/server'

   export async function middleware(request) {
     const response = NextResponse.next()
     const supabase = createServerClient(...)
     
     const { data: { session } } = await supabase.auth.getSession()
     
     if (!session && request.nextUrl.pathname.startsWith('/dashboard')) {
       return NextResponse.redirect(new URL('/auth/login', request.url))
     }
     
     return response
   }
   ```

4. **Set up auth context and hooks**
   - Create AuthProvider component
   - Implement useAuth hook
   - Handle session refresh

5. **Configure OAuth callback handler**
   - Handle successful authentication
   - Error handling for failed auth
   - Redirect to dashboard after login

## Files to Create

- `app/auth/login/page.tsx` - Login page
- `app/auth/signup/page.tsx` - Signup page
- `app/auth/callback/route.ts` - OAuth callback handler
- `app/auth/reset-password/page.tsx` - Password reset page
- `middleware.ts` - Route protection middleware
- `components/auth/LoginForm.tsx` - Login form component
- `components/auth/SignupForm.tsx` - Signup form component
- `components/auth/GoogleButton.tsx` - Google OAuth button
- `lib/auth/auth-context.tsx` - Authentication context
- `hooks/useAuth.ts` - Authentication hook

## UI Components

### LoginForm Component
```typescript
interface LoginFormProps {
  onSuccess?: () => void
}

// Features:
// - Email/password fields with validation
// - Remember me checkbox
// - Forgot password link
// - Google OAuth button
// - Loading states
// - Error handling
```

### Protected Route Example
```typescript
// app/dashboard/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function Dashboard() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/auth/login')
  }
  
  // Dashboard content
}
```

## Acceptance Criteria

- [ ] Users can sign up with email/password
- [ ] Email verification working
- [ ] Google OAuth login functional
- [ ] Protected routes redirect unauthenticated users
- [ ] User session persists across browser refreshes
- [ ] Password reset flow working
- [ ] Proper error handling for auth failures
- [ ] Loading states during authentication
- [ ] Logout functionality clears session completely
- [ ] Magic link authentication optional

## Security Requirements

- [ ] Passwords hashed using bcrypt (handled by Supabase)
- [ ] Session tokens stored securely
- [ ] CSRF protection enabled
- [ ] Rate limiting on auth endpoints
- [ ] Secure cookie settings for sessions
- [ ] OAuth state parameter validation

## Error Handling

- Invalid credentials: Show user-friendly error message
- Network errors: Retry with exponential backoff
- OAuth failures: Redirect to login with error message
- Session expiry: Automatic refresh or re-login prompt
- Email not verified: Show verification reminder

## Testing Requirements

- [ ] Test successful login/signup flow
- [ ] Test invalid credentials handling
- [ ] Test OAuth flow with Google
- [ ] Test protected route access
- [ ] Test session persistence
- [ ] Test logout functionality
- [ ] Test password reset flow
- [ ] Test concurrent sessions handling

## Definition of Done

- [ ] Code complete and committed
- [ ] All authentication flows working
- [ ] Protected routes functioning
- [ ] Error handling implemented
- [ ] Security requirements met
- [ ] Tests written and passing
- [ ] Documentation updated
- [ ] Peer review completed