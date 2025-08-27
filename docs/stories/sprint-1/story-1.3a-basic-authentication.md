# Story 1.3a: Basic Authentication Implementation

## User Story
As a user,
I want to sign up and log in with email and password,
So that I can securely access my ContentMax account.

## Size & Priority
- **Size**: M (4 hours) - Reduced from original L
- **Priority**: P0 - Critical
- **Sprint**: 1 (Adjusted)
- **Dependencies**: Story 1.2 (Supabase Setup)

## Description
Implement core authentication functionality with email/password using Supabase Auth. OAuth and SSO will be handled in Story 1.3b (Sprint 2).

## Implementation Steps

1. **Authentication context and hooks**
   ```typescript
   // contexts/AuthContext.tsx
   import { createContext, useContext, useEffect, useState } from 'react';
   import { User, Session } from '@supabase/supabase-js';
   import { supabase } from '@/lib/supabase/client';
   
   interface AuthContextType {
     user: User | null;
     session: Session | null;
     loading: boolean;
     signUp: (email: string, password: string) => Promise<void>;
     signIn: (email: string, password: string) => Promise<void>;
     signOut: () => Promise<void>;
     resetPassword: (email: string) => Promise<void>;
   }
   
   const AuthContext = createContext<AuthContextType | undefined>(undefined);
   
   export function AuthProvider({ children }: { children: React.ReactNode }) {
     const [user, setUser] = useState<User | null>(null);
     const [session, setSession] = useState<Session | null>(null);
     const [loading, setLoading] = useState(true);
     
     useEffect(() => {
       // Check active session
       supabase.auth.getSession().then(({ data: { session } }) => {
         setSession(session);
         setUser(session?.user ?? null);
         setLoading(false);
       });
       
       // Listen for auth changes
       const { data: { subscription } } = supabase.auth.onAuthStateChange(
         (_event, session) => {
           setSession(session);
           setUser(session?.user ?? null);
         }
       );
       
       return () => subscription.unsubscribe();
     }, []);
     
     const signUp = async (email: string, password: string) => {
       const { error } = await supabase.auth.signUp({
         email,
         password,
         options: {
           emailRedirectTo: `${window.location.origin}/auth/callback`
         }
       });
       
       if (error) throw error;
     };
     
     const signIn = async (email: string, password: string) => {
       const { error } = await supabase.auth.signInWithPassword({
         email,
         password
       });
       
       if (error) throw error;
     };
     
     const signOut = async () => {
       const { error } = await supabase.auth.signOut();
       if (error) throw error;
     };
     
     const resetPassword = async (email: string) => {
       const { error } = await supabase.auth.resetPasswordForEmail(email, {
         redirectTo: `${window.location.origin}/auth/reset-password`
       });
       
       if (error) throw error;
     };
     
     return (
       <AuthContext.Provider value={{
         user,
         session,
         loading,
         signUp,
         signIn,
         signOut,
         resetPassword
       }}>
         {children}
       </AuthContext.Provider>
     );
   }
   
   export const useAuth = () => {
     const context = useContext(AuthContext);
     if (!context) {
       throw new Error('useAuth must be used within AuthProvider');
     }
     return context;
   };
   ```

2. **Sign up form component**
   ```typescript
   // components/auth/SignUpForm.tsx
   import { useState } from 'react';
   import { useRouter } from 'next/navigation';
   import { useAuth } from '@/contexts/AuthContext';
   
   export function SignUpForm() {
     const router = useRouter();
     const { signUp } = useAuth();
     const [loading, setLoading] = useState(false);
     const [error, setError] = useState<string | null>(null);
     
     const [formData, setFormData] = useState({
       email: '',
       password: '',
       confirmPassword: ''
     });
     
     const handleSubmit = async (e: React.FormEvent) => {
       e.preventDefault();
       setError(null);
       
       // Validation
       if (formData.password !== formData.confirmPassword) {
         setError('Passwords do not match');
         return;
       }
       
       if (formData.password.length < 8) {
         setError('Password must be at least 8 characters');
         return;
       }
       
       setLoading(true);
       
       try {
         await signUp(formData.email, formData.password);
         router.push('/auth/verify-email');
       } catch (error: any) {
         setError(error.message);
       } finally {
         setLoading(false);
       }
     };
     
     return (
       <form onSubmit={handleSubmit} className="space-y-4">
         <div>
           <label htmlFor="email" className="block text-sm font-medium">
             Email
           </label>
           <input
             id="email"
             type="email"
             required
             value={formData.email}
             onChange={(e) => setFormData({ ...formData, email: e.target.value })}
             className="mt-1 block w-full rounded-md border-gray-300"
             placeholder="you@example.com"
           />
         </div>
         
         <div>
           <label htmlFor="password" className="block text-sm font-medium">
             Password
           </label>
           <input
             id="password"
             type="password"
             required
             value={formData.password}
             onChange={(e) => setFormData({ ...formData, password: e.target.value })}
             className="mt-1 block w-full rounded-md border-gray-300"
             placeholder="••••••••"
           />
         </div>
         
         <div>
           <label htmlFor="confirmPassword" className="block text-sm font-medium">
             Confirm Password
           </label>
           <input
             id="confirmPassword"
             type="password"
             required
             value={formData.confirmPassword}
             onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
             className="mt-1 block w-full rounded-md border-gray-300"
             placeholder="••••••••"
           />
         </div>
         
         {error && (
           <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
             {error}
           </div>
         )}
         
         <button
           type="submit"
           disabled={loading}
           className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
         >
           {loading ? 'Creating account...' : 'Sign up'}
         </button>
       </form>
     );
   }
   ```

3. **Sign in form component**
   ```typescript
   // components/auth/SignInForm.tsx
   import { useState } from 'react';
   import { useRouter } from 'next/navigation';
   import Link from 'next/link';
   import { useAuth } from '@/contexts/AuthContext';
   
   export function SignInForm() {
     const router = useRouter();
     const { signIn } = useAuth();
     const [loading, setLoading] = useState(false);
     const [error, setError] = useState<string | null>(null);
     
     const [formData, setFormData] = useState({
       email: '',
       password: ''
     });
     
     const handleSubmit = async (e: React.FormEvent) => {
       e.preventDefault();
       setError(null);
       setLoading(true);
       
       try {
         await signIn(formData.email, formData.password);
         router.push('/dashboard');
       } catch (error: any) {
         setError(error.message);
       } finally {
         setLoading(false);
       }
     };
     
     return (
       <form onSubmit={handleSubmit} className="space-y-4">
         <div>
           <label htmlFor="email" className="block text-sm font-medium">
             Email
           </label>
           <input
             id="email"
             type="email"
             required
             value={formData.email}
             onChange={(e) => setFormData({ ...formData, email: e.target.value })}
             className="mt-1 block w-full rounded-md border-gray-300"
             placeholder="you@example.com"
           />
         </div>
         
         <div>
           <label htmlFor="password" className="block text-sm font-medium">
             Password
           </label>
           <input
             id="password"
             type="password"
             required
             value={formData.password}
             onChange={(e) => setFormData({ ...formData, password: e.target.value })}
             className="mt-1 block w-full rounded-md border-gray-300"
             placeholder="••••••••"
           />
         </div>
         
         <div className="flex justify-end">
           <Link 
             href="/auth/forgot-password" 
             className="text-sm text-blue-600 hover:underline"
           >
             Forgot password?
           </Link>
         </div>
         
         {error && (
           <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
             {error}
           </div>
         )}
         
         <button
           type="submit"
           disabled={loading}
           className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
         >
           {loading ? 'Signing in...' : 'Sign in'}
         </button>
       </form>
     );
   }
   ```

4. **Auth pages**
   ```typescript
   // app/auth/login/page.tsx
   import { SignInForm } from '@/components/auth/SignInForm';
   import Link from 'next/link';
   
   export default function LoginPage() {
     return (
       <div className="min-h-screen flex items-center justify-center bg-gray-50">
         <div className="max-w-md w-full space-y-8">
           <div>
             <h2 className="text-center text-3xl font-extrabold text-gray-900">
               Sign in to ContentMax
             </h2>
           </div>
           <SignInForm />
           <p className="text-center text-sm text-gray-600">
             Don't have an account?{' '}
             <Link href="/auth/signup" className="text-blue-600 hover:underline">
               Sign up
             </Link>
           </p>
         </div>
       </div>
     );
   }
   
   // app/auth/signup/page.tsx
   import { SignUpForm } from '@/components/auth/SignUpForm';
   import Link from 'next/link';
   
   export default function SignUpPage() {
     return (
       <div className="min-h-screen flex items-center justify-center bg-gray-50">
         <div className="max-w-md w-full space-y-8">
           <div>
             <h2 className="text-center text-3xl font-extrabold text-gray-900">
               Create your account
             </h2>
           </div>
           <SignUpForm />
           <p className="text-center text-sm text-gray-600">
             Already have an account?{' '}
             <Link href="/auth/login" className="text-blue-600 hover:underline">
               Sign in
             </Link>
           </p>
         </div>
       </div>
     );
   }
   ```

5. **Middleware for route protection**
   ```typescript
   // middleware.ts
   import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
   import { NextResponse } from 'next/server';
   import type { NextRequest } from 'next/server';
   
   export async function middleware(req: NextRequest) {
     const res = NextResponse.next();
     const supabase = createMiddlewareClient({ req, res });
     
     const {
       data: { session },
     } = await supabase.auth.getSession();
     
     // Protected routes
     const protectedPaths = ['/dashboard', '/content', '/generate', '/settings'];
     const authPaths = ['/auth/login', '/auth/signup'];
     
     const isProtectedPath = protectedPaths.some(path => 
       req.nextUrl.pathname.startsWith(path)
     );
     
     const isAuthPath = authPaths.some(path => 
       req.nextUrl.pathname.startsWith(path)
     );
     
     // Redirect to login if accessing protected route without session
     if (isProtectedPath && !session) {
       return NextResponse.redirect(new URL('/auth/login', req.url));
     }
     
     // Redirect to dashboard if accessing auth pages with active session
     if (isAuthPath && session) {
       return NextResponse.redirect(new URL('/dashboard', req.url));
     }
     
     return res;
   }
   
   export const config = {
     matcher: ['/dashboard/:path*', '/content/:path*', '/auth/:path*']
   };
   ```

## Files to Create

- `contexts/AuthContext.tsx` - Authentication context and hooks
- `components/auth/SignUpForm.tsx` - Sign up form component
- `components/auth/SignInForm.tsx` - Sign in form component  
- `app/auth/login/page.tsx` - Login page
- `app/auth/signup/page.tsx` - Sign up page
- `app/auth/verify-email/page.tsx` - Email verification page
- `app/auth/forgot-password/page.tsx` - Password reset request page
- `middleware.ts` - Route protection middleware

## Acceptance Criteria

- [ ] Users can sign up with email/password
- [ ] Email verification required before access
- [ ] Users can sign in with credentials
- [ ] Password reset flow functional
- [ ] Protected routes redirect to login
- [ ] Session persists across refreshes
- [ ] Proper error messages displayed
- [ ] Loading states during auth operations

## Testing Requirements

- [ ] Test sign up with valid/invalid emails
- [ ] Test password validation rules
- [ ] Test sign in with correct/incorrect credentials
- [ ] Test password reset flow
- [ ] Test protected route access
- [ ] Test session persistence
- [ ] Test auth state changes
- [ ] Test error handling

## Definition of Done

- [ ] All auth flows working
- [ ] Email verification functional
- [ ] Protected routes secured
- [ ] Error handling complete
- [ ] Tests passing
- [ ] No console errors
- [ ] Responsive on mobile
- [ ] Accessibility compliant