# STORY-006: Implement Google Merchant OAuth Flow

## Story Overview

**Story ID:** STORY-006  
**Epic:** EPIC-001 - Data Ingestion Pipeline  
**Sprint:** Sprint 6  
**Priority:** P1 - High  
**Estimated Effort:** 3 hours  
**Story Points:** 3  

## User Story

As a **merchant**,  
I want **to authorize ContentMax to access my Google Merchant Center**,  
So that **my product feed can be imported automatically**.

## Context

Google Merchant Center contains the richest product data including images, prices, availability, and attributes. OAuth2 flow enables secure access to this data without storing credentials.

## Acceptance Criteria

### Functional Requirements
1. ✅ OAuth initiation button in UI
2. ✅ Google consent screen displayed
3. ✅ Callback handles authorization code
4. ✅ Tokens stored securely in database
5. ✅ Token refresh handled automatically

### Technical Requirements
6. ✅ Implement OAuth 2.0 flow correctly
7. ✅ Store tokens encrypted in database
8. ✅ Handle token expiration/refresh
9. ✅ Support multiple merchant accounts
10. ✅ Revocation endpoint available

### Security Requirements
11. ✅ State parameter prevents CSRF
12. ✅ Tokens never exposed to frontend
13. ✅ Refresh tokens stored separately
14. ✅ Audit log for authorization events

## Technical Implementation Notes

### OAuth Initiation Endpoint
```typescript
// app/api/integrations/google/auth/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import crypto from 'crypto';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

export async function GET(request: NextRequest) {
  try {
    // Generate state for CSRF protection
    const state = crypto.randomBytes(32).toString('hex');
    
    // Store state in session
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Save state to database
    await saveOAuthState(session.user.id, state);
    
    // Generate authorization URL
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/content',
        'https://www.googleapis.com/auth/webmasters.readonly',
        'https://www.googleapis.com/auth/analytics.readonly'
      ],
      state: state,
      prompt: 'consent' // Force consent to get refresh token
    });
    
    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error('OAuth initiation failed:', error);
    return NextResponse.json(
      { error: 'Failed to initiate OAuth flow' },
      { status: 500 }
    );
  }
}
```

### OAuth Callback Handler
```typescript
// app/api/integrations/google/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  
  if (error) {
    console.error('OAuth error:', error);
    return NextResponse.redirect('/dashboard/settings?error=oauth_denied');
  }
  
  if (!code || !state) {
    return NextResponse.redirect('/dashboard/settings?error=invalid_callback');
  }
  
  try {
    // Verify state parameter
    const session = await getSession(request);
    const savedState = await getOAuthState(session.user.id);
    
    if (state !== savedState) {
      throw new Error('Invalid state parameter');
    }
    
    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    
    // Store tokens in database
    await storeGoogleTokens(session.user.id, {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date,
      scope: tokens.scope
    });
    
    // Get merchant info
    const content = google.content({ version: 'v2.1', auth: oauth2Client });
    const { data } = await content.accounts.authinfo();
    
    await storeMerchantInfo(session.user.id, {
      merchant_id: data.accountIdentifiers[0].merchantId,
      account_id: data.accountIdentifiers[0].accountId,
      email: data.email
    });
    
    return NextResponse.redirect('/dashboard/settings?success=google_connected');
  } catch (error) {
    console.error('OAuth callback failed:', error);
    return NextResponse.redirect('/dashboard/settings?error=oauth_failed');
  }
}
```

### Token Management Service
```typescript
// lib/integrations/google/token-manager.ts
export class GoogleTokenManager {
  private oauth2Client: any;
  
  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
  }
  
  async getValidTokens(userId: string) {
    const tokens = await this.getStoredTokens(userId);
    
    if (!tokens) {
      throw new Error('No tokens found');
    }
    
    // Check if token is expired
    if (tokens.expiry_date && tokens.expiry_date < Date.now()) {
      return await this.refreshTokens(userId, tokens.refresh_token);
    }
    
    return tokens;
  }
  
  async refreshTokens(userId: string, refreshToken: string) {
    this.oauth2Client.setCredentials({ refresh_token: refreshToken });
    
    const { credentials } = await this.oauth2Client.refreshAccessToken();
    
    await this.updateStoredTokens(userId, {
      access_token: credentials.access_token,
      expiry_date: credentials.expiry_date
    });
    
    return credentials;
  }
}
```

### UI Integration Component
```typescript
// components/settings/GoogleIntegration.tsx
export function GoogleIntegration() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  
  const handleConnect = async () => {
    setIsConnecting(true);
    
    try {
      const response = await fetch('/api/integrations/google/auth');
      const { authUrl } = await response.json();
      
      // Redirect to Google OAuth
      window.location.href = authUrl;
    } catch (error) {
      console.error('Failed to connect:', error);
      setIsConnecting(false);
    }
  };
  
  return (
    <div className="p-6 border rounded-lg">
      <h3>Google Merchant Center</h3>
      {isConnected ? (
        <div className="flex items-center gap-2 text-green-600">
          <CheckIcon /> Connected
        </div>
      ) : (
        <button
          onClick={handleConnect}
          disabled={isConnecting}
          className="btn btn-primary"
        >
          {isConnecting ? 'Connecting...' : 'Connect Google Account'}
        </button>
      )}
    </div>
  );
}
```

## Dependencies

- Requires STORY-002 completion (OAuth credentials configured)
- Google APIs client library
- Secure token storage in database

## Testing Requirements

### Unit Tests
```typescript
describe('Google OAuth', () => {
  it('generates valid authorization URL');
  it('includes required scopes');
  it('validates state parameter');
  it('exchanges code for tokens');
  it('refreshes expired tokens');
  it('handles OAuth errors gracefully');
});
```

### Integration Tests
- Manual OAuth flow testing
- Token refresh simulation
- Error case handling
- Multi-account support

### Security Testing
1. CSRF protection via state parameter
2. Token encryption verification
3. Scope limitation testing
4. Session validation

## Definition of Done

- [ ] OAuth initiation endpoint working
- [ ] Callback handler implemented
- [ ] Tokens stored securely
- [ ] Token refresh working
- [ ] UI integration complete
- [ ] Error handling comprehensive
- [ ] Security measures in place
- [ ] Unit tests passing
- [ ] Manual OAuth flow tested

## Dev Agent Record

### Agent Model Used
_To be filled by implementing agent_

### Debug Log References
_To be filled during implementation_

### Completion Notes
_To be filled after implementation_

### File List
- `app/api/integrations/google/auth/route.ts` (new)
- `app/api/integrations/google/callback/route.ts` (new)
- `lib/integrations/google/token-manager.ts` (new)
- `components/settings/GoogleIntegration.tsx` (new)

---
**Created:** 2025-01-09  
**Status:** Ready for Development  
**Assigned:** Unassigned