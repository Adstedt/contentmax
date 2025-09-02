# ContentMax QuickStart Guide

Get ContentMax running in under 10 minutes! This guide walks you through setup, development, and deployment.

## Prerequisites

- Node.js 18+ and npm
- Git
- Supabase account (free tier works)
- Google Cloud account (for GSC/GA4 integration)

## 🚀 Quick Setup

### 1. Clone and Install

```bash
# Clone the repository
git clone https://github.com/your-org/contentmax.git
cd contentmax

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Settings → API
3. Copy your credentials to `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

4. Run database migrations:

```bash
npm run db:migrate
```

### 3. Start Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) 🎉

## 📊 First Steps

### Import Your Sitemap

1. Click **Import** in the navigation
2. Enter your sitemap URL (e.g., `https://yoursite.com/sitemap.xml`)
3. Click **Import** and wait for processing
4. Your taxonomy visualization will appear!

### Connect Google Search Console

1. Go to **Settings → Integrations**
2. Click **Connect Google Search Console**
3. Authorize access to your GSC property
4. Metrics will sync automatically

### View Opportunities

1. Navigate to the **Dashboard**
2. Top revenue opportunities appear automatically
3. Click any opportunity for detailed recommendations

## 🏗️ Project Structure

```
contentmax/
├── app/                    # Next.js app router
│   ├── api/               # API routes
│   ├── dashboard/         # Dashboard pages
│   └── layout.tsx         # Root layout
├── components/            # React components
│   ├── ui/               # UI components
│   └── visualization/    # D3.js components
├── lib/                   # Core logic
│   ├── db/              # Database operations
│   ├── integrations/    # External APIs
│   ├── scoring/         # Opportunity scoring
│   └── visualization/   # D3.js logic
├── docs/                  # Documentation
│   ├── BRIEF.md         # Project brief
│   ├── PHASE_1_PRD.md   # Product requirements
│   └── sprints/         # Sprint guides
└── public/               # Static assets
```

## 🛠️ Development Commands

```bash
# Development
npm run dev              # Start dev server
npm run build           # Build for production
npm run test            # Run tests
npm run lint            # Lint code
npm run type-check      # TypeScript check

# Database
npm run db:migrate      # Run migrations
npm run db:seed         # Seed test data
npm run db:reset        # Reset database

# Deployment
npm run deploy          # Deploy to Vercel
```

## 📚 Key Concepts

### Node-Centric Architecture

- **Truth Source**: Sitemap/Shopify defines structure
- **Enrichment**: GSC/GA4 add metrics but don't change structure
- **Single Node**: Each URL has one canonical node

### Opportunity Scoring

```typescript
Score = (Search Volume × 0.25) +
        (CTR Gap × 0.30) +
        (Position Potential × 0.20) +
        (Competition × 0.10) +
        (Revenue Impact × 0.15)
```

### Visual Encoding

- **Green**: Optimized (score > 80)
- **Yellow**: Needs work (score 50-80)
- **Red**: Critical (score < 50)
- **Gray**: No data

## 🔧 Configuration

### Environment Variables

```env
# Supabase (Required)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Google APIs (Required for metrics)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=

# Optional
SENTRY_DSN=
POSTHOG_API_KEY=
```

### Performance Tuning

Edit `lib/visualization/config.ts`:

```typescript
export const visualizationConfig = {
  maxNodes: 3000, // Maximum nodes to render
  chunkSize: 100, // Progressive loading batch size
  targetFPS: 30, // Target frame rate
  enableWebGL: true, // Use WebGL renderer
};
```

## 🚢 Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Add environment variables
4. Deploy!

### Production Checklist

- [ ] Set all environment variables
- [ ] Enable Supabase Row Level Security
- [ ] Configure custom domain
- [ ] Set up monitoring (Sentry)
- [ ] Enable analytics (PostHog)
- [ ] Test with real data

## 🐛 Troubleshooting

### Common Issues

**"Failed to connect to Supabase"**

- Check if project is paused (free tier auto-pauses)
- Verify environment variables are correct

**"Visualization not rendering"**

- Check browser console for errors
- Ensure you have imported nodes
- Try refreshing the page

**"Metrics not syncing"**

- Verify Google OAuth is connected
- Check API quotas in Google Cloud Console
- Look for errors in `/api/metrics/sync`

### Debug Mode

Enable debug logging:

```typescript
// In your .env.local
DEBUG = true;
LOG_LEVEL = verbose;
```

## 📖 Learn More

- [Full Documentation](docs/README.md)
- [Phase 1 PRD](docs/PHASE_1_PRD.md)
- [Sprint Guides](docs/sprints/)
- [API Reference](docs/api/README.md)

## 💬 Support

- GitHub Issues: [github.com/your-org/contentmax/issues](https://github.com/your-org/contentmax/issues)
- Discord: [discord.gg/contentmax](https://discord.gg/contentmax)
- Email: support@contentmax.io

## 🎯 Next Steps

1. **Import your sitemap** to see your taxonomy
2. **Connect GSC/GA4** for real metrics
3. **Review top opportunities** for quick wins
4. **Join our Discord** for tips and support

---

Built with ❤️ by the ContentMax team. Happy optimizing!
