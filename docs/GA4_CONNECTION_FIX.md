# GA4 Connection Fix - Action Required

## Issue

The Google Analytics 4 connection is not showing properties because the OAuth scope needs to be updated.

## Root Cause

The OAuth callback is only granting `analytics.readonly` scope, but GA4 Admin API requires additional scope:

- `https://www.googleapis.com/auth/analytics.manage.users.readonly`

## Solution

You need to **disconnect and reconnect** your Google Analytics integration:

### Steps to Fix:

1. **Go to Settings > Integrations**
2. **Disconnect** the existing Google Analytics connection (if any)
3. **Connect Google Analytics again**
4. When prompted by Google, **carefully review the permissions** and make sure to grant all requested permissions including:
   - View your Google Analytics data
   - See and download your Google Analytics user permissions

## Technical Changes Made

1. Fixed API endpoint to use `v1beta` (the correct version for GA4 Admin API)
2. Updated OAuth scopes to include the required `analytics.manage.users.readonly` scope
3. Fixed Next.js 15 dynamic route params to use async/await pattern
4. Added fallback to direct properties endpoint if account-based listing fails

## Verification

After reconnecting, you should see your GA4 properties listed in the configuration page.

## Note

The error logs show the OAuth callback is still only receiving `analytics.readonly` scope, which means the browser has cached the old OAuth URL. A fresh connection will request the correct scopes.
