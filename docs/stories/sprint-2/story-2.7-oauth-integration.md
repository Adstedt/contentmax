# Story 2.7: OAuth Integration (Split from 1.3)

## User Story

As a user,
I want to sign in with my Google account,
So that I can access ContentMax without creating a new password.

## Size & Priority

- **Size**: M (4 hours) - Split from original Story 1.3
- **Priority**: P1 - High
- **Sprint**: 2 (Adjusted - moved from Sprint 1)
- **Dependencies**: Story 1.3a (Basic Authentication)

## Description

Add OAuth providers (Google, GitHub) to the existing authentication system. This was split from the original authentication story to reduce Sprint 1 complexity.

## Implementation Steps

1. **Update Supabase OAuth configuration**

   ```typescript
   // Instructions for Supabase Dashboard
   /*
   1. Go to Authentication > Providers in Supabase Dashboard
   2. Enable Google provider
   3. Add redirect URLs:
      - http://localhost:3000/auth/callback
      - https://contentmax.ai/auth/callback
   4. Configure Google OAuth:
      - Create project in Google Cloud Console
      - Enable Google+ API
      - Create OAuth 2.0 credentials
      - Add authorized redirect URIs
   */
   ```

2. **Extend auth context for OAuth**

   ```typescript
   // contexts/AuthContext.tsx (additions)
   import { Provider } from '@supabase/supabase-js';

   interface AuthContextType {
     // ... existing properties
     signInWithOAuth: (provider: Provider) => Promise<void>;
     linkOAuthAccount: (provider: Provider) => Promise<void>;
     unlinkOAuthAccount: (provider: Provider) => Promise<void>;
   }

   // Inside AuthProvider component
   const signInWithOAuth = async (provider: Provider) => {
     const { error } = await supabase.auth.signInWithOAuth({
       provider,
       options: {
         redirectTo: `${window.location.origin}/auth/callback`,
         scopes: provider === 'google' ? 'email profile' : undefined,
         queryParams: {
           access_type: 'offline',
           prompt: 'consent',
         },
       },
     });

     if (error) throw error;
   };

   const linkOAuthAccount = async (provider: Provider) => {
     const { error } = await supabase.auth.linkIdentity({
       provider,
       options: {
         redirectTo: `${window.location.origin}/settings/linked-accounts`,
       },
     });

     if (error) throw error;
   };

   const unlinkOAuthAccount = async (provider: Provider) => {
     const {
       data: { identities },
     } = await supabase.auth.getUserIdentities();

     const identity = identities?.find((i) => i.provider === provider);
     if (!identity) {
       throw new Error(`No ${provider} account linked`);
     }

     const { error } = await supabase.auth.unlinkIdentity(identity);
     if (error) throw error;
   };
   ```

3. **OAuth button components**

   ```typescript
   // components/auth/OAuthButtons.tsx
   import { useState } from 'react';
   import { useAuth } from '@/contexts/AuthContext';
   import { Provider } from '@supabase/supabase-js';

   interface OAuthProvider {
     name: string;
     provider: Provider;
     icon: React.ComponentType<{ className?: string }>;
     bgColor: string;
     hoverColor: string;
   }

   const providers: OAuthProvider[] = [
     {
       name: 'Google',
       provider: 'google',
       icon: GoogleIcon,
       bgColor: 'bg-white',
       hoverColor: 'hover:bg-gray-50'
     },
     {
       name: 'GitHub',
       provider: 'github',
       icon: GitHubIcon,
       bgColor: 'bg-gray-900',
       hoverColor: 'hover:bg-gray-800'
     }
   ];

   export function OAuthButtons() {
     const { signInWithOAuth } = useAuth();
     const [loading, setLoading] = useState<Provider | null>(null);
     const [error, setError] = useState<string | null>(null);

     const handleOAuthSignIn = async (provider: Provider) => {
       setError(null);
       setLoading(provider);

       try {
         await signInWithOAuth(provider);
       } catch (error: any) {
         setError(error.message);
         setLoading(null);
       }
     };

     return (
       <div className="space-y-3">
         <div className="relative">
           <div className="absolute inset-0 flex items-center">
             <div className="w-full border-t border-gray-300" />
           </div>
           <div className="relative flex justify-center text-sm">
             <span className="px-2 bg-white text-gray-500">Or continue with</span>
           </div>
         </div>

         <div className="grid grid-cols-2 gap-3">
           {providers.map((p) => (
             <button
               key={p.provider}
               onClick={() => handleOAuthSignIn(p.provider)}
               disabled={loading !== null}
               className={`
                 relative flex justify-center items-center px-4 py-2
                 border border-gray-300 rounded-md shadow-sm
                 text-sm font-medium text-gray-700
                 ${p.bgColor} ${p.hoverColor}
                 disabled:opacity-50 disabled:cursor-not-allowed
               `}
             >
               <p.icon className="h-5 w-5" />
               <span className="ml-2">
                 {loading === p.provider ? 'Loading...' : p.name}
               </span>
             </button>
           ))}
         </div>

         {error && (
           <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
             {error}
           </div>
         )}
       </div>
     );
   }

   // Icon components
   function GoogleIcon({ className }: { className?: string }) {
     return (
       <svg className={className} viewBox="0 0 24 24">
         <path
           fill="#4285F4"
           d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
         />
         <path
           fill="#34A853"
           d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
         />
         <path
           fill="#FBBC05"
           d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
         />
         <path
           fill="#EA4335"
           d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
         />
       </svg>
     );
   }

   function GitHubIcon({ className }: { className?: string }) {
     return (
       <svg className={className} fill="currentColor" viewBox="0 0 20 20">
         <path
           fillRule="evenodd"
           d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z"
           clipRule="evenodd"
         />
       </svg>
     );
   }
   ```

4. **Update auth pages with OAuth**

   ```typescript
   // app/auth/login/page.tsx (updated)
   import { SignInForm } from '@/components/auth/SignInForm';
   import { OAuthButtons } from '@/components/auth/OAuthButtons';
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

           <OAuthButtons />

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
   ```

5. **OAuth callback handler**

   ```typescript
   // app/auth/callback/route.ts
   import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
   import { cookies } from 'next/headers';
   import { NextResponse } from 'next/server';

   export async function GET(request: Request) {
     const requestUrl = new URL(request.url);
     const code = requestUrl.searchParams.get('code');
     const next = requestUrl.searchParams.get('next') ?? '/dashboard';

     if (code) {
       const cookieStore = cookies();
       const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

       try {
         await supabase.auth.exchangeCodeForSession(code);
       } catch (error) {
         console.error('OAuth callback error:', error);
         return NextResponse.redirect(
           new URL('/auth/error?message=authentication_failed', request.url)
         );
       }
     }

     return NextResponse.redirect(new URL(next, request.url));
   }
   ```

6. **Account linking in settings**

   ```typescript
   // components/settings/LinkedAccounts.tsx
   import { useEffect, useState } from 'react';
   import { useAuth } from '@/contexts/AuthContext';
   import { Identity } from '@supabase/supabase-js';

   export function LinkedAccounts() {
     const { user, linkOAuthAccount, unlinkOAuthAccount } = useAuth();
     const [identities, setIdentities] = useState<Identity[]>([]);
     const [loading, setLoading] = useState(false);

     useEffect(() => {
       loadIdentities();
     }, [user]);

     const loadIdentities = async () => {
       const { data } = await supabase.auth.getUserIdentities();
       setIdentities(data?.identities || []);
     };

     const handleLink = async (provider: Provider) => {
       setLoading(true);
       try {
         await linkOAuthAccount(provider);
         await loadIdentities();
       } catch (error) {
         console.error('Failed to link account:', error);
       } finally {
         setLoading(false);
       }
     };

     const handleUnlink = async (provider: Provider) => {
       if (identities.length <= 1) {
         alert('You must have at least one authentication method');
         return;
       }

       if (confirm(`Unlink ${provider} account?`)) {
         setLoading(true);
         try {
           await unlinkOAuthAccount(provider);
           await loadIdentities();
         } catch (error) {
           console.error('Failed to unlink account:', error);
         } finally {
           setLoading(false);
         }
       }
     };

     const providers = ['google', 'github'];

     return (
       <div className="space-y-4">
         <h3 className="text-lg font-medium">Linked Accounts</h3>

         {providers.map(provider => {
           const linked = identities.some(i => i.provider === provider);

           return (
             <div key={provider} className="flex items-center justify-between p-4 border rounded-lg">
               <div className="flex items-center space-x-3">
                 <span className="capitalize">{provider}</span>
                 {linked && (
                   <span className="text-sm text-green-600">✓ Connected</span>
                 )}
               </div>

               <button
                 onClick={() => linked ? handleUnlink(provider) : handleLink(provider)}
                 disabled={loading}
                 className={`px-4 py-2 rounded-md text-sm ${
                   linked
                     ? 'bg-red-100 text-red-700 hover:bg-red-200'
                     : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                 } disabled:opacity-50`}
               >
                 {linked ? 'Disconnect' : 'Connect'}
               </button>
             </div>
           );
         })}
       </div>
     );
   }
   ```

## Files to Create/Modify

- `components/auth/OAuthButtons.tsx` - OAuth provider buttons
- `app/auth/callback/route.ts` - OAuth callback handler
- `app/auth/error/page.tsx` - Auth error page
- `components/settings/LinkedAccounts.tsx` - Account linking UI
- `contexts/AuthContext.tsx` - Update with OAuth methods

## Environment Variables Required

```env
# Google OAuth
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# GitHub OAuth (if implementing)
NEXT_PUBLIC_GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
```

## Acceptance Criteria

- [ ] Google OAuth sign in working
- [ ] GitHub OAuth sign in working (optional)
- [ ] OAuth callback handles success/failure
- [ ] Users can link OAuth to existing account
- [ ] Users can unlink OAuth providers
- [ ] At least one auth method required
- [ ] Proper error messages for OAuth failures
- [ ] Mobile responsive OAuth buttons

## Testing Requirements

- [ ] Test Google OAuth flow
- [ ] Test GitHub OAuth flow
- [ ] Test linking OAuth to email account
- [ ] Test unlinking OAuth providers
- [ ] Test OAuth with existing email
- [ ] Test OAuth callback errors
- [ ] Test account with multiple providers
- [ ] Test mobile OAuth experience

## Definition of Done

- [ ] OAuth providers configured in Supabase
- [ ] Google OAuth fully functional
- [ ] Account linking working
- [ ] Error handling comprehensive
- [ ] Tests passing
- [ ] No console errors
- [ ] Documentation updated
- [ ] Security review complete
