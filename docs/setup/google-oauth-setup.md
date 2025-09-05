# Google OAuth Setup Guide

This guide walks you through setting up Google OAuth2 credentials for ContentMax to access Google Merchant Center, Search Console, and Analytics APIs.

## Prerequisites

- Google account with access to:
  - Google Cloud Console
  - Google Merchant Center (for product data)
  - Google Search Console (for SEO metrics)
  - Google Analytics 4 (for traffic data)

## Step 1: Create or Select a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click on the project dropdown at the top
3. Either:
   - Select an existing project, OR
   - Click "New Project" and create one:
     - Project Name: `ContentMax` (or your preferred name)
     - Project ID: Will be auto-generated
     - Click "Create"

## Step 2: Enable Required APIs

In your Google Cloud project, enable the following APIs:

1. Navigate to "APIs & Services" > "Library"
2. Search for and enable each of these APIs:
   - **Google Shopping Content API** (for Merchant Center)
   - **Google Search Console API** (for SEO data)
   - **Google Analytics Data API** (for GA4 metrics)

Click "Enable" for each API. This may take a few moments.

## Step 3: Configure OAuth Consent Screen

1. Go to "APIs & Services" > "OAuth consent screen"
2. Choose user type:
   - **Internal**: If using Google Workspace
   - **External**: For regular Gmail accounts (most common)
3. Click "Create"
4. Fill in the application information:
   - **App name**: ContentMax
   - **User support email**: Your email
   - **App logo**: Optional
   - **Application home page**: http://localhost:3000 (for development)
   - **Authorized domains**: Add your production domain when ready
   - **Developer contact information**: Your email
5. Click "Save and Continue"
6. Scopes:
   - Click "Add or Remove Scopes"
   - Add these scopes:
     ```
     https://www.googleapis.com/auth/content
     https://www.googleapis.com/auth/webmasters.readonly
     https://www.googleapis.com/auth/analytics.readonly
     openid
     email
     profile
     ```
   - Click "Update"
7. Test users (if External):
   - Add your email and any test accounts
   - Click "Save and Continue"
8. Review and click "Back to Dashboard"

## Step 4: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. Application type: **Web application**
4. Name: `ContentMax Web Client`
5. Authorized JavaScript origins:
   - Add: `http://localhost:3000` (for development)
   - Add your production domain when ready
6. Authorized redirect URIs:
   - Add: `http://localhost:3000/api/integrations/google/callback` (development)
   - Add: `https://[your-domain]/api/integrations/google/callback` (production)
7. Click "Create"
8. **IMPORTANT**: Save the Client ID and Client Secret

## Step 5: Configure Environment Variables

1. Copy the credentials from Google Cloud Console
2. Create a `.env.local` file in your project root (if it doesn't exist)
3. Add the following variables:

```bash
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret-here
GOOGLE_REDIRECT_URI=http://localhost:3000/api/integrations/google/callback

# Google Merchant Center
GOOGLE_MERCHANT_ID=your-merchant-center-id

# Optional: For server-side operations
# GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"..."}'
```

## Step 6: Get Your Merchant Center ID

1. Go to [Google Merchant Center](https://merchants.google.com/)
2. Your Merchant ID is displayed in the top-right corner
3. Add it to your `.env.local` file

## Step 7: Verify Setup

Run these checks to ensure everything is configured correctly:

### Check 1: Environment Variables
```bash
# Ensure all required variables are set
npm run check-env
```

### Check 2: OAuth Flow Test
1. Start your development server: `npm run dev`
2. Navigate to: http://localhost:3000/settings/integrations
3. Click "Connect Google Account"
4. You should be redirected to Google's OAuth consent screen
5. After authorization, you should be redirected back to your application

## Troubleshooting

### Common Issues

#### "Access blocked" error
- Ensure your app is published (for production) or your email is in test users (for development)
- Check that all redirect URIs match exactly

#### "Invalid client" error
- Double-check your Client ID and Secret are copied correctly
- Ensure no extra spaces or line breaks in environment variables

#### "Scope not authorized" error
- Return to OAuth consent screen and ensure all required scopes are added
- May need to re-submit for verification if using sensitive scopes

#### Rate limiting issues
- Google APIs have quotas. Check your quota usage in Cloud Console
- Implement exponential backoff for API calls

### Security Best Practices

1. **Never commit `.env.local` to version control**
   - Ensure it's in your `.gitignore`
   
2. **Use different credentials for production**
   - Create separate OAuth clients for dev/staging/production
   
3. **Rotate secrets regularly**
   - Update Client Secret periodically
   - Revoke unused refresh tokens
   
4. **Implement proper token storage**
   - Store refresh tokens securely (encrypted in database)
   - Never expose tokens to client-side code

5. **Monitor API usage**
   - Set up alerts in Google Cloud Console
   - Track quota usage

## Production Deployment

When deploying to production:

1. Create a separate OAuth client for production
2. Update redirect URIs to use your production domain
3. Ensure OAuth consent screen is verified/published
4. Use environment variables from your hosting provider
5. Consider using Google Secret Manager for sensitive keys

## API Quotas and Limits

Be aware of these limits:

- **Merchant Content API**: 60,000 requests/day
- **Search Console API**: 1,200 requests/minute
- **Analytics Data API**: 1,250 requests/5 minutes

Plan your sync frequency accordingly.

## Next Steps

After completing OAuth setup:

1. Implement the OAuth flow endpoints (Story 006)
2. Test token refresh mechanism
3. Set up error handling for API failures
4. Implement rate limiting to stay within quotas

## Additional Resources

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Google Merchant Content API](https://developers.google.com/shopping-content)
- [Search Console API](https://developers.google.com/webmaster-tools)
- [Google Analytics Data API](https://developers.google.com/analytics/devguides/reporting/data/v1)

---

**Last Updated:** 2025-01-09  
**Maintained by:** Development Team