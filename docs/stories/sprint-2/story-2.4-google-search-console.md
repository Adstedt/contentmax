# Story 2.4: Google Search Console Integration

## User Story
As an SEO manager,
I want to integrate Google Search Console data,
So that I can see search performance metrics alongside content status.

## Size & Priority
- **Size**: M (6 hours)
- **Priority**: P1 - High
- **Sprint**: 2
- **Dependencies**: Sprint 1 complete

## Prerequisites
- Google Cloud project created (see docs/external-services-setup.md)
- OAuth credentials configured
- Search Console API enabled

## Description
Implement Google Search Console API integration to fetch search performance data, indexing status, and Core Web Vitals for content optimization decisions.

## Implementation Steps

1. **Set up Google OAuth 2.0 flow**
   ```typescript
   import { google } from 'googleapis';
   
   const oauth2Client = new google.auth.OAuth2(
     process.env.GOOGLE_CLIENT_ID,
     process.env.GOOGLE_CLIENT_SECRET,
     process.env.GOOGLE_REDIRECT_URI
   );
   
   // Generate auth URL
   const authUrl = oauth2Client.generateAuthUrl({
     access_type: 'offline',
     scope: ['https://www.googleapis.com/auth/webmasters.readonly'],
     prompt: 'consent'
   });
   ```

2. **Handle OAuth callback**
   ```typescript
   // app/api/integrations/google/callback/route.ts
   export async function GET(request: Request) {
     const { searchParams } = new URL(request.url);
     const code = searchParams.get('code');
     
     // Exchange code for tokens
     const { tokens } = await oauth2Client.getToken(code);
     
     // Store refresh token encrypted
     await storeTokens(userId, tokens);
     
     // Redirect to settings page
   }
   ```

3. **Create Search Console API client**
   ```typescript
   class SearchConsoleClient {
     private webmasters: any;
     
     constructor(tokens: OAuth2Tokens) {
       oauth2Client.setCredentials(tokens);
       this.webmasters = google.webmasters({ 
         version: 'v3', 
         auth: oauth2Client 
       });
     }
     
     async getSearchAnalytics(siteUrl: string, options: QueryOptions) {
       return this.webmasters.searchanalytics.query({
         siteUrl,
         requestBody: options
       });
     }
   }
   ```

4. **Fetch performance data**
   ```typescript
   interface PerformanceData {
     clicks: number;
     impressions: number;
     ctr: number;
     position: number;
     queries: QueryData[];
     pages: PageData[];
   }
   
   async function fetchPerformanceData(
     siteUrl: string, 
     startDate: string, 
     endDate: string
   ): Promise<PerformanceData> {
     // Fetch clicks, impressions, CTR, position
     // Group by page and query
     // Calculate trends
   }
   ```

5. **Store and cache data**
   ```typescript
   // Cache strategy to avoid API limits
   class GSCDataCache {
     async get(key: string): Promise<any> {
       // Check cache validity (24 hours)
       // Return cached data if fresh
     }
     
     async set(key: string, data: any): Promise<void> {
       // Store with timestamp
       // Invalidate old entries
     }
   }
   ```

## Files to Create

- `lib/integrations/google-oauth.ts` - OAuth flow handling
- `lib/integrations/search-console.ts` - GSC API client
- `lib/integrations/gsc-cache.ts` - Data caching layer
- `app/settings/integrations/page.tsx` - Integration settings UI
- `app/api/integrations/google/auth/route.ts` - Start OAuth flow
- `app/api/integrations/google/callback/route.ts` - OAuth callback
- `app/api/integrations/google/disconnect/route.ts` - Revoke access
- `types/google.types.ts` - TypeScript interfaces

## API Data Points

```typescript
interface GSCMetrics {
  // Performance metrics
  clicks: number;
  impressions: number;
  ctr: number;          // Click-through rate
  position: number;      // Average position
  
  // Dimensions
  queries: string[];     // Search queries
  pages: string[];       // Page URLs
  countries: string[];   // Country codes
  devices: string[];     // desktop/mobile/tablet
  
  // Time series
  dailyData: DailyMetric[];
  
  // Issues
  coverageIssues: CoverageIssue[];
  mobileUsability: MobileIssue[];
}
```

## Settings UI Components

```typescript
interface IntegrationSettingsProps {
  isConnected: boolean;
  connectedEmail?: string;
  sites?: string[];
  lastSync?: Date;
}

// Features:
// - Connect/disconnect button
// - Site selector
// - Sync frequency settings
// - Data retention settings
// - Manual sync trigger
```

## Rate Limiting & Quotas

```typescript
const GSC_LIMITS = {
  requestsPerDay: 1200,      // Per project
  requestsPerMinute: 20,      // Per project
  rowsPerRequest: 25000,      // Max rows returned
  dimensionsPerRequest: 5,    // Max dimensions
  dateRange: 16,              // Months of data available
};

// Implement rate limiting
class RateLimitedGSC {
  private requestCount = 0;
  private resetTime: Date;
  
  async makeRequest(fn: () => Promise<any>): Promise<any> {
    await this.checkRateLimit();
    return fn();
  }
}
```

## Acceptance Criteria

- [ ] Users can connect Google Search Console account
- [ ] OAuth flow completes successfully
- [ ] Search performance data fetched and displayed
- [ ] Data cached to respect API limits
- [ ] Multiple sites supported per account
- [ ] Disconnect functionality working
- [ ] Error handling for expired tokens
- [ ] Automatic token refresh
- [ ] Settings UI shows connection status

## Security Requirements

- [ ] Refresh tokens encrypted at rest
- [ ] Access tokens never exposed to client
- [ ] State parameter in OAuth for CSRF protection
- [ ] Tokens scoped to read-only access
- [ ] Audit log for connection/disconnection

## Database Schema

```sql
CREATE TABLE google_integrations (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  email TEXT NOT NULL,
  refresh_token TEXT NOT NULL, -- Encrypted
  access_token TEXT,            -- Encrypted
  token_expiry TIMESTAMP,
  connected_at TIMESTAMP DEFAULT NOW(),
  last_sync TIMESTAMP,
  UNIQUE(user_id)
);

CREATE TABLE gsc_data (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  url TEXT NOT NULL,
  date DATE NOT NULL,
  clicks INTEGER,
  impressions INTEGER,
  ctr DECIMAL(5,4),
  position DECIMAL(6,2),
  data JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(project_id, url, date)
);
```

## Error Handling

- **Invalid credentials**: Clear message, re-authenticate
- **API quota exceeded**: Use cached data, show warning
- **Network errors**: Retry with exponential backoff
- **Expired tokens**: Auto-refresh using refresh token
- **No access to property**: Show specific sites with access

## Testing Requirements

- [ ] Test OAuth flow end-to-end
- [ ] Test token refresh mechanism
- [ ] Test API rate limiting
- [ ] Test data caching
- [ ] Test error scenarios
- [ ] Test disconnection flow
- [ ] Test with multiple sites
- [ ] Test data accuracy

## Definition of Done

- [ ] Code complete and committed
- [ ] OAuth flow functioning
- [ ] Data fetching and storage working
- [ ] Caching implemented
- [ ] Settings UI complete
- [ ] Security requirements met
- [ ] Tests written and passing
- [ ] Documentation updated
- [ ] Peer review completed