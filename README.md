# ContentMax

AI-powered content generation platform for scalable e-commerce content creation.

## 🚀 Features

- **AI-Powered Content Generation**: Leverage OpenAI GPT-4 for high-quality content
- **Taxonomy Visualization**: Interactive force-directed graph of site structure
- **Bulk Content Management**: Generate and manage content at scale
- **Real-time Analytics**: Track performance metrics and content health
- **Smart Recommendations**: AI-driven content optimization suggestions
- **Web Scraping**: Extract and analyze competitor content
- **Template System**: Customizable content templates

## 📋 Prerequisites

- Node.js 20.0.0 or higher
- npm or pnpm package manager
- Git
- Docker Desktop (for local development with Supabase)

## 🛠️ Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS, Shadcn/UI
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **AI**: OpenAI API
- **Visualization**: D3.js
- **Monitoring**: Sentry, Vercel Analytics
- **Deployment**: Vercel

## 🏁 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/Adstedt/contentmax.git
cd contentmax
```

### 2. Install dependencies

```bash
npm install
# or
pnpm install
```

### 3. Start local development environment

Start Docker and Supabase services:

```bash
npm run local:start
# or for Mac/Linux:
npm run local:start:bash
```

This will automatically:
- Start Docker Desktop
- Install Supabase CLI
- Start all Supabase services
- Apply database migrations

For detailed setup instructions, see [Local Development Setup](./docs/LOCAL_DEV_SETUP.md).

### 4. Set up environment variables

Copy the example environment file:

```bash
cp .env.example .env.local
```

Fill in your configuration:

```env
# Supabase (from local Supabase Studio)
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenAI
OPENAI_API_KEY=your-openai-api-key

# Optional: Monitoring
NEXT_PUBLIC_SENTRY_DSN=your-sentry-dsn
SENTRY_ORG=your-sentry-org
SENTRY_PROJECT=your-sentry-project
```

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📜 Available Scripts

```bash
# Development
npm run dev              # Start development server
npm run build           # Build for production
npm run start           # Start production server

# Testing
npm run test            # Run tests
npm run test:watch      # Run tests in watch mode
npm run test:coverage   # Run tests with coverage
npm run test:e2e        # Run end-to-end tests

# Code Quality
npm run lint            # Run ESLint
npm run lint:fix        # Fix ESLint issues
npm run format          # Format code with Prettier
npm run type-check      # TypeScript type checking

# Database
npm run db:reset        # Reset database
npm run db:push         # Push schema changes
npm run db:migration:new # Create new migration
npm run db:types        # Generate TypeScript types

# Local Development
npm run local:start     # Start all local services
npm run local:stop      # Stop all local services
```

## 🏗️ Project Structure

```
contentmax/
├── app/                    # Next.js app directory
│   ├── (auth)/            # Authentication pages
│   ├── (dashboard)/       # Dashboard pages
│   ├── api/               # API routes
│   └── layout.tsx         # Root layout
├── components/            # React components
│   ├── shared/           # Shared components
│   ├── taxonomy/         # Taxonomy visualization
│   └── ui/               # UI components
├── lib/                   # Core business logic
│   ├── api/              # API utilities
│   ├── supabase/         # Supabase clients
│   └── utils/            # Utility functions
├── hooks/                 # Custom React hooks
├── types/                 # TypeScript definitions
├── tests/                 # Test files
└── public/               # Static assets
```

## 🧪 Testing

We use Jest and React Testing Library for unit and integration tests:

```bash
# Run all tests
npm run test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm run test -- components/taxonomy
```

## 📦 Deployment

### Vercel Deployment (Recommended)

1. Push your code to GitHub
2. Import project in Vercel
3. Configure environment variables
4. Deploy

### Manual Deployment

```bash
# Build the application
npm run build

# Start production server
npm run start
```

### CI/CD Pipeline

We use GitHub Actions for automated testing and deployment:

- **CI**: Runs on every PR (linting, type checking, tests)
- **Preview**: Deploys preview for PRs
- **Production**: Auto-deploys main branch to production

## 🔒 Security

- All API routes are protected with authentication
- Environment variables for sensitive data
- Row Level Security (RLS) in Supabase
- Input validation with Zod schemas
- XSS protection with React's built-in escaping
- CSRF protection with SameSite cookies

## 📊 Monitoring

- **Error Tracking**: Sentry integration for error monitoring
- **Analytics**: Vercel Analytics for performance metrics
- **Custom Metrics**: API endpoint for custom metrics
- **Health Checks**: `/api/monitoring/metrics` endpoint

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'feat: add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Commit Convention

We follow conventional commits:

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `style:` Formatting
- `refactor:` Code restructuring
- `test:` Tests
- `chore:` Maintenance

## 📝 Documentation

- [Architecture Overview](./docs/architecture.md)
- [API Documentation](./docs/api/README.md)
- [Component Documentation](./docs/components/README.md)
- [Database Schema](./docs/database/schema.md)
- [Deployment Guide](./docs/deployment/README.md)

## 🐛 Troubleshooting

### Common Issues

**Supabase connection issues:**
```bash
# Restart Supabase
npm run local:stop
npm run local:start
```

**Type errors:**
```bash
# Regenerate types
npm run db:types
```

**Build failures:**
```bash
# Clear cache and rebuild
rm -rf .next node_modules
npm install
npm run build
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- UI components from [Shadcn/UI](https://ui.shadcn.com/)
- Database by [Supabase](https://supabase.com/)
- AI powered by [OpenAI](https://openai.com/)

## 📧 Support

For support, email support@contentmax.ai or open an issue on GitHub.

---

**ContentMax** - Empowering E-commerce with AI-Driven Content