# External Services Setup Guide

## Overview

This document outlines all external service accounts required for ContentMax and provides step-by-step instructions for setting them up. These accounts must be created **before** starting the relevant sprint tasks.

---

## Required External Services

### 1. Supabase Account (Sprint 1 - Task 1.2)

**Required By**: Sprint 1, Task 1.2
**Purpose**: Database, authentication, realtime subscriptions, and file storage

#### Setup Steps:

1. **Create Account**:
   - Go to https://supabase.com
   - Click "Start your project"
   - Sign up with GitHub or email
2. **Create Project**:
   - Click "New Project"
   - Project Name: `contentmax-production`
   - Database Password: Generate strong password (save securely)
   - Region: Select closest to your target users (e.g., US East)
   - Click "Create new project" (takes ~2 minutes)

3. **Gather Credentials**:
   - Navigate to Settings → API in your Supabase dashboard
   - Copy and save these three values:
     - **Project URL**: `https://[your-project].supabase.co`
       - This will be your `NEXT_PUBLIC_SUPABASE_URL`
     - **anon/public key**: Long string starting with `eyJ...`
       - This will be your `NEXT_PUBLIC_SUPABASE_ANON_KEY`
       - Safe to expose in client-side code
     - **service_role key**: Different long string starting with `eyJ...`
       - This will be your `SUPABASE_SERVICE_ROLE_KEY`
       - ⚠️ NEVER expose this in client-side code or commit to git!
4. **Configure Authentication**:
   - Go to Authentication → Providers
   - Enable Email provider
   - Configure Google OAuth (see Google OAuth section below)

5. **Set Environment Variables**:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

---

### 2. Vercel Account (Sprint 1 - Initial Deployment)

**Required By**: Sprint 1, for deployment
**Purpose**: Hosting, edge functions, and preview deployments

#### Setup Steps:

1. **Create Account**:
   - Go to https://vercel.com
   - Sign up with GitHub (recommended) or email
   - Select "Hobby" plan for development (free)

2. **Connect GitHub Repository**:
   - Click "Import Project"
   - Select your ContentMax repository
   - Configure project settings:
     - Framework Preset: Next.js
     - Root Directory: ./
     - Build Command: `npm run build`
     - Output Directory: .next

3. **Configure Environment Variables**:
   - Go to Project Settings → Environment Variables
   - Add the following Supabase credentials:
     - `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL (e.g., https://abcdefghijk.supabase.co)
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anonymous/public key (safe for client-side)
     - `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key (server-side only, keep secret!)
   - Add OpenAI API key (when available):
     - `OPENAI_API_KEY`: Your OpenAI secret key (starts with sk-)
   - For each variable, enable it for:
     - ✅ Production
     - ✅ Preview
     - ✅ Development

   **Important**: The `NEXT_PUBLIC_` prefix makes variables available to the browser. Only use it for public keys!

4. **Enable Preview Deployments**:
   - Already enabled by default
   - Each PR will get a unique preview URL

---

### 3. OpenAI Account (Sprint 4 - Task 4.3)

**Required By**: Sprint 4, Task 4.3
**Purpose**: AI content generation using GPT-4

#### Setup Steps:

1. **Create Account**:
   - Go to https://platform.openai.com
   - Sign up with email or Google
   - Verify email address

2. **Add Payment Method**:
   - Navigate to Billing → Payment methods
   - Add credit card
   - Set usage limits:
     - Monthly budget: $100 (adjust as needed)
     - Email threshold alerts at $50, $75, $90

3. **Generate API Key**:
   - Go to API keys section
   - Click "Create new secret key"
   - Name: `contentmax-production`
   - Copy immediately (won't be shown again!)
4. **Configure Usage**:
   - Set up usage tracking dashboard
   - Monitor API costs daily initially
   - Plan for ~$0.03-0.10 per content generation

5. **Set Environment Variable**:
   ```env
   OPENAI_API_KEY=sk-...your_key_here
   ```

---

### 4. Google Cloud Console (Sprint 2 - Task 2.3)

**Required By**: Sprint 2, Task 2.3
**Purpose**: Google Search Console API access

#### Setup Steps:

1. **Create Google Cloud Project**:
   - Go to https://console.cloud.google.com
   - Click "Create Project"
   - Project Name: `ContentMax`
   - Note the Project ID

2. **Enable APIs**:
   - Navigate to "APIs & Services" → "Library"
   - Search and enable:
     - Google Search Console API
     - Google OAuth 2.0 API

3. **Create OAuth Credentials**:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth client ID"
   - Configure consent screen first:
     - App name: ContentMax
     - User support email: your email
     - Authorized domains: your-domain.com
   - Application type: Web application
   - Name: ContentMax Web Client
   - Authorized redirect URIs:
     - `http://localhost:3000/api/integrations/google/callback` (dev)
     - `https://your-domain.com/api/integrations/google/callback` (prod)

4. **Download Credentials**:
   - Download JSON credentials file
   - Store securely (never commit to git!)

5. **Set Environment Variables**:
   ```env
   GOOGLE_CLIENT_ID=your_client_id
   GOOGLE_CLIENT_SECRET=your_client_secret
   GOOGLE_REDIRECT_URI=your_redirect_uri
   ```

---

### 5. GitHub Account (Already Required)

**Required By**: Project initialization
**Purpose**: Code repository and CI/CD

#### Setup Steps:

1. **Repository Settings**:
   - Go to repository Settings
   - Configure branch protection for `main`:
     - Require pull request reviews
     - Require status checks to pass
     - Require branches to be up to date
     - Include administrators

2. **GitHub Actions Setup** (Sprint 2):
   - No additional account needed
   - Secrets added via Settings → Secrets:
     - `VERCEL_TOKEN` (from Vercel dashboard)
     - `SUPABASE_SERVICE_ROLE_KEY`
     - Other sensitive environment variables

---

## Service Setup Timeline

| Sprint   | Service        | Priority      | Setup Time | Monthly Cost         |
| -------- | -------------- | ------------- | ---------- | -------------------- |
| Sprint 1 | Supabase       | P0 - Critical | 30 mins    | Free tier / $25      |
| Sprint 1 | Vercel         | P0 - Critical | 20 mins    | Free tier / $20      |
| Sprint 2 | GitHub Actions | P0 - Critical | 10 mins    | Free for public      |
| Sprint 2 | Google Cloud   | P1 - High     | 45 mins    | Free tier            |
| Sprint 4 | OpenAI         | P0 - Critical | 20 mins    | Usage-based ~$50-200 |

---

## Cost Estimates

### Development Phase (First 3 months)

- **Supabase**: Free tier (up to 500MB database, 2GB storage)
- **Vercel**: Free tier (100GB bandwidth)
- **OpenAI**: ~$50-100/month during testing
- **Google Cloud**: Free tier (Search Console API has generous limits)
- **Total**: ~$50-100/month

### Production Phase (Post-launch)

- **Supabase**: Pro plan $25/month
- **Vercel**: Pro plan $20/month
- **OpenAI**: ~$200-500/month (depends on usage)
- **Google Cloud**: Free tier should suffice
- **Total**: ~$245-545/month

---

## Security Best Practices

### API Key Management

1. **Never commit keys to Git**
   - Use `.env.local` for local development
   - Add `.env*` to `.gitignore`

2. **Use Different Keys for Environments**
   - Separate keys for development/staging/production
   - Rotate keys regularly (every 90 days)

3. **Store Keys Securely**
   - Development: `.env.local` file
   - Production: Vercel environment variables
   - Use Supabase Vault for ultra-sensitive keys

4. **Implement Key Rotation**
   - Document rotation schedule
   - Keep previous key active for 24 hours during rotation
   - Update all environments systematically

### Access Control

1. **Principle of Least Privilege**
   - Development environment uses restricted API keys
   - Production uses full-access keys only where needed

2. **Team Access**
   - Use OAuth/SSO where possible
   - Document who has access to which services
   - Regular access audits (monthly)

---

## Troubleshooting Common Issues

### Supabase Connection Issues

- **Error**: "Failed to connect to Supabase"
- **Solution**: Check if project is paused (free tier pauses after 1 week of inactivity)

### OpenAI Rate Limits

- **Error**: "Rate limit exceeded"
- **Solution**: Implement exponential backoff, consider upgrading tier

### Google OAuth Issues

- **Error**: "Redirect URI mismatch"
- **Solution**: Ensure exact match including trailing slashes in Google Console

### Vercel Deployment Failures

- **Error**: "Build failed"
- **Solution**: Check environment variables are set for the deployment environment

---

## Monitoring & Alerts

### Set Up Monitoring For:

1. **Supabase**:
   - Database size (alert at 80% of limit)
   - API request count
   - Failed authentication attempts

2. **OpenAI**:
   - Daily spend (alert at $10, $25, $50)
   - API errors rate
   - Response time degradation

3. **Vercel**:
   - Build failures
   - Function execution errors
   - Bandwidth usage

---

## Pre-Sprint Checklist

### Before Sprint 1:

- [ ] Supabase account created and project initialized
- [ ] Vercel account created and repository connected
- [ ] GitHub repository configured with branch protection
- [ ] Local development environment variables set

### Before Sprint 2:

- [ ] Google Cloud project created
- [ ] Search Console API enabled
- [ ] OAuth credentials configured
- [ ] GitHub Actions secrets configured

### Before Sprint 4:

- [ ] OpenAI account created with payment method
- [ ] API key generated and stored securely
- [ ] Usage limits and alerts configured
- [ ] Fallback plan for API failures documented

---

## Support & Documentation

### Official Documentation:

- **Supabase**: https://supabase.com/docs
- **Vercel**: https://vercel.com/docs
- **OpenAI**: https://platform.openai.com/docs
- **Google Search Console API**: https://developers.google.com/webmaster-tools/search-console-api-original

### Support Channels:

- **Supabase**: Discord community, GitHub issues
- **Vercel**: Discord community, support tickets (Pro plan)
- **OpenAI**: Developer forum, help.openai.com
- **Google**: Stack Overflow, Issue tracker

---

## Notes for AI Agents/Developers

When implementing integrations:

1. Always use environment variables for sensitive data
2. Implement retry logic with exponential backoff
3. Add comprehensive error logging
4. Create fallback mechanisms for service outages
5. Document any additional service-specific setup required
