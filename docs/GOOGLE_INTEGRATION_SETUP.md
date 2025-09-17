# Google Integration Setup Guide

## Overview

This guide will help you set up Google OAuth2 and connect Google Analytics 4, Google Search Console, and Google Merchant Center to Content Machine.

## Prerequisites

- Google Cloud Console account
- Access to GA4, Search Console, and Merchant Center accounts
- Admin access to your Content Machine deployment

## Step 1: Google Cloud Console Setup

### 1.1 Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Click "Select a project" → "New Project"
3. Name it "Content Machine Integration" (or similar)
4. Click "Create"

### 1.2 Enable Required APIs

Navigate to "APIs & Services" → "Library" and enable:

- **Google Analytics Data API** (for GA4)
- **Google Search Console API** (for GSC)
- **Content API for Shopping** (for Merchant Center)

### 1.3 Create OAuth2 Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. If prompted, configure the OAuth consent screen first:
   - User Type: External (or Internal for Workspace)
   - App name: Content Machine
   - User support email: Your email
   - Developer contact: Your email
   - Add scopes:
     - `https://www.googleapis.com/auth/analytics.readonly`
     - `https://www.googleapis.com/auth/webmasters.readonly`
     - `https://www.googleapis.com/auth/content`
   - Add test users if in development

4. Create OAuth 2.0 Client ID:
   - Application type: Web application
   - Name: Content Machine Web Client
   - Authorized JavaScript origins:
     - `http://localhost:3000` (for development)
     - `https://yourdomain.com` (for production)
   - Authorized redirect URIs:
     - `http://localhost:3000/api/auth/google/callback` (for development)
     - `https://yourdomain.com/api/auth/google/callback` (for production)
   - Click "Create"

5. Save the Client ID and Client Secret

## Step 2: Environment Configuration

### 2.1 Generate Encryption Key

```bash
# On Mac/Linux:
openssl rand -hex 32

# On Windows (PowerShell):
[System.BitConverter]::ToString((1..32 | ForEach-Object {Get-Random -Max 256})) -replace '-','' | Out-String
```

### 2.2 Update .env.local

Add the following to your `.env.local` file:

```env
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret_here

# Encryption Key (32 bytes in hex)
ENCRYPTION_KEY=your_generated_32_byte_hex_key_here

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Supabase Service Key (if not already set)
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
```

## Step 3: Connect Services

### 3.1 Start the Application

```bash
npm run dev
```

### 3.2 Navigate to Integration Settings

1. Go to `http://localhost:3000/dashboard/settings?tab=integrations`
2. You should see three integration cards: GA4, Search Console, Merchant Center

### 3.3 Connect Google Analytics 4

1. Click "Connect" on the GA4 card
2. Authorize with Google
3. Select your GA4 property
4. Choose data sync frequency
5. Click "Save Configuration"

### 3.4 Connect Google Search Console

1. Click "Connect" on the Search Console card
2. Authorize with Google (may auto-connect if already authorized)
3. Select your verified properties
4. Configure data sync settings
5. Click "Save Configuration"

### 3.5 Connect Google Merchant Center

1. Click "Connect" on the Merchant Center card
2. Authorize with Google
3. Enter your Merchant ID
4. Configure product sync settings
5. Click "Save Configuration"

## Step 4: Verify Integration

### 4.1 Check Connection Status

- Each connected service should show a green "Connected" badge
- Last sync time should be displayed
- Sync status should show "Active"

### 4.2 Test Data Sync

1. Click "Sync Now" on any connected service
2. Check the sync progress in the UI
3. Verify data appears in your database tables:
   - `integration_ga4_metrics`
   - `integration_gsc_data`
   - `integration_merchant_products`

### 4.3 Monitor Sync Jobs

- Go to the monitoring dashboard (if available)
- Check for any failed sync jobs
- Review error logs if syncs fail

## Troubleshooting

### Common Issues

#### "Invalid OAuth credentials"

- Verify GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are correct
- Check that redirect URI matches exactly (including protocol and port)
- Ensure OAuth consent screen is configured

#### "Insufficient permissions"

- Check that all required APIs are enabled in Google Cloud Console
- Verify the OAuth scopes include necessary permissions
- User may need to re-authorize with updated scopes

#### "No data after sync"

- Verify the Google account has access to the selected properties
- Check date ranges for data sync
- GA4 and GSC may have data delays (up to 48 hours)
- Check browser console and network tab for API errors

#### "Encryption error"

- Ensure ENCRYPTION_KEY is exactly 32 bytes (64 hex characters)
- Key must remain consistent after initial setup
- Changing the key will invalidate stored credentials

### Debug Mode

Set these in .env.local for detailed logging:

```env
DEBUG_INTEGRATIONS=true
LOG_LEVEL=debug
```

## Security Best Practices

1. **Never commit .env.local to git**
2. **Rotate encryption keys periodically**
3. **Use separate Google Cloud projects for dev/staging/production**
4. **Limit OAuth scopes to minimum required**
5. **Set up IP restrictions in Google Cloud Console for production**
6. **Monitor API usage and set quotas**
7. **Use service accounts for server-to-server communication when possible**

## API Quotas and Limits

### Google Analytics 4

- 1,000 requests per project per minute
- 10 concurrent requests per project
- Consider implementing rate limiting

### Google Search Console

- 200 requests per minute
- 2,000 rows per request
- Data available for last 16 months

### Google Merchant Center

- 2,500 requests per day for most methods
- Batch operations recommended for bulk updates

## Next Steps

1. Set up automated sync schedules (cron jobs)
2. Configure alerting for sync failures
3. Implement data validation and quality checks
4. Set up monitoring dashboards
5. Plan for data retention and archival

## Support

For issues specific to:

- Google APIs: [Google Cloud Support](https://cloud.google.com/support)
- OAuth2: [Google OAuth2 Documentation](https://developers.google.com/identity/protocols/oauth2)
- Content Machine: Check the project's issue tracker
