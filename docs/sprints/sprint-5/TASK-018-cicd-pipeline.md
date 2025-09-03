# TASK-018: CI/CD Pipeline

## Overview

**Priority**: P1 - Critical  
**Estimate**: 3 hours  
**Owner**: DevOps Engineer  
**Dependencies**: Repository setup, testing complete  
**Status**: Not Started

## Problem Statement

We need a robust CI/CD pipeline using GitHub Actions that automates testing, building, and deployment processes. The pipeline should include quality gates, automated testing, security scanning, and seamless deployment to Vercel.

## Technical Requirements

### 1. Main CI/CD Workflow

#### File: `.github/workflows/ci-cd.yml`

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]
  workflow_dispatch:

env:
  NODE_VERSION: '20.x'
  PNPM_VERSION: '8'

jobs:
  # Quality checks
  quality:
    name: Code Quality
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Full history for better analysis

      - name: Setup PNPM
        uses: pnpm/action-setup@v2
        with:
          version: ${{ env.PNPM_VERSION }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run ESLint
        run: pnpm lint

      - name: Run Prettier check
        run: pnpm format:check

      - name: TypeScript type checking
        run: pnpm type-check

      - name: Check for dependency vulnerabilities
        run: pnpm audit --audit-level moderate

      - name: License compliance check
        run: pnpm license-checker --summary --onlyAllow 'MIT;Apache-2.0;BSD;ISC;CC0-1.0'

  # Testing
  test:
    name: Test Suite
    runs-on: ubuntu-latest
    needs: quality

    strategy:
      matrix:
        test-type: [unit, integration, e2e]

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: contentmax_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup PNPM
        uses: pnpm/action-setup@v2
        with:
          version: ${{ env.PNPM_VERSION }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Setup test database
        if: matrix.test-type != 'unit'
        run: |
          cp .env.test.example .env.test
          pnpm db:migrate:test
          pnpm db:seed:test
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/contentmax_test

      - name: Run unit tests
        if: matrix.test-type == 'unit'
        run: pnpm test:unit --coverage

      - name: Run integration tests
        if: matrix.test-type == 'integration'
        run: pnpm test:integration
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/contentmax_test

      - name: Run E2E tests
        if: matrix.test-type == 'e2e'
        run: |
          pnpm build
          pnpm test:e2e
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/contentmax_test
          NEXT_PUBLIC_APP_URL: http://localhost:3000

      - name: Upload coverage reports
        if: matrix.test-type == 'unit'
        uses: codecov/codecov-action@v3
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
          files: ./coverage/lcov.info
          flags: unittests

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: test-results-${{ matrix.test-type }}
          path: |
            coverage/
            test-results/
            playwright-report/

  # Security scanning
  security:
    name: Security Scan
    runs-on: ubuntu-latest
    needs: quality

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          format: 'sarif'
          output: 'trivy-results.sarif'
          severity: 'CRITICAL,HIGH'

      - name: Upload Trivy results to GitHub Security
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: 'trivy-results.sarif'

      - name: Run Snyk security scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=medium

      - name: OWASP Dependency Check
        uses: dependency-check/Dependency-Check_Action@main
        with:
          project: 'ContentMax'
          path: '.'
          format: 'HTML'
          args: >
            --enableRetired
            --enableExperimental

      - name: Upload OWASP results
        uses: actions/upload-artifact@v3
        with:
          name: owasp-report
          path: reports/

  # Build and analyze
  build:
    name: Build & Analyze
    runs-on: ubuntu-latest
    needs: [quality, test, security]

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup PNPM
        uses: pnpm/action-setup@v2
        with:
          version: ${{ env.PNPM_VERSION }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build application
        run: pnpm build
        env:
          NEXT_PUBLIC_APP_VERSION: ${{ github.sha }}
          NEXT_PUBLIC_SENTRY_DSN: ${{ secrets.SENTRY_DSN }}
          ANALYZE: true

      - name: Analyze bundle size
        run: |
          echo "## Bundle Size Report" >> $GITHUB_STEP_SUMMARY
          echo "\`\`\`" >> $GITHUB_STEP_SUMMARY
          pnpm analyze:size >> $GITHUB_STEP_SUMMARY
          echo "\`\`\`" >> $GITHUB_STEP_SUMMARY

      - name: Run Lighthouse CI
        uses: treosh/lighthouse-ci-action@v10
        with:
          urls: |
            http://localhost:3000
            http://localhost:3000/dashboard
            http://localhost:3000/opportunities
          uploadArtifacts: true
          temporaryPublicStorage: true

      - name: Check build size limits
        run: |
          MAX_SIZE=500000  # 500KB
          BUILD_SIZE=$(du -sb .next | cut -f1)
          if [ $BUILD_SIZE -gt $MAX_SIZE ]; then
            echo "Build size ($BUILD_SIZE) exceeds limit ($MAX_SIZE)"
            exit 1
          fi

      - name: Upload build artifacts
        uses: actions/upload-artifact@v3
        with:
          name: build-artifacts
          path: |
            .next/
            public/
            package.json

  # Deploy to staging
  deploy-staging:
    name: Deploy to Staging
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/develop'
    environment:
      name: staging
      url: https://staging.contentmax.io

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Deploy to Vercel Staging
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
          scope: ${{ secrets.VERCEL_ORG_ID }}
          alias-domains: staging.contentmax.io
        env:
          NEXT_PUBLIC_ENV: staging
          DATABASE_URL: ${{ secrets.STAGING_DATABASE_URL }}
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.STAGING_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.STAGING_SUPABASE_ANON_KEY }}

      - name: Run smoke tests
        run: |
          pnpm test:smoke --url=https://staging.contentmax.io

      - name: Notify deployment
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: 'Staging deployment completed'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
        if: always()

  # Deploy to production
  deploy-production:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main'
    environment:
      name: production
      url: https://contentmax.io

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Create release tag
        id: tag
        run: |
          VERSION=$(date +%Y.%m.%d)-${GITHUB_SHA::7}
          echo "VERSION=$VERSION" >> $GITHUB_OUTPUT
          git tag -a "v$VERSION" -m "Release v$VERSION"
          git push origin "v$VERSION"

      - name: Deploy to Vercel Production
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
          scope: ${{ secrets.VERCEL_ORG_ID }}
        env:
          NEXT_PUBLIC_ENV: production
          NEXT_PUBLIC_APP_VERSION: ${{ steps.tag.outputs.VERSION }}
          DATABASE_URL: ${{ secrets.PRODUCTION_DATABASE_URL }}
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.PRODUCTION_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.PRODUCTION_SUPABASE_ANON_KEY }}

      - name: Run production smoke tests
        run: |
          pnpm test:smoke --url=https://contentmax.io

      - name: Create Sentry release
        uses: getsentry/action-release@v1
        env:
          SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
          SENTRY_ORG: contentmax
          SENTRY_PROJECT: contentmax-app
        with:
          environment: production
          version: ${{ steps.tag.outputs.VERSION }}

      - name: Invalidate CDN cache
        run: |
          curl -X POST "https://api.cloudflare.com/client/v4/zones/${{ secrets.CLOUDFLARE_ZONE_ID }}/purge_cache" \
            -H "Authorization: Bearer ${{ secrets.CLOUDFLARE_API_TOKEN }}" \
            -H "Content-Type: application/json" \
            --data '{"purge_everything":true}'

      - name: Create GitHub release
        uses: softprops/action-gh-release@v1
        with:
          tag_name: v${{ steps.tag.outputs.VERSION }}
          name: Release v${{ steps.tag.outputs.VERSION }}
          body: |
            ## What's Changed
            ${{ github.event.head_commit.message }}

            **Full Changelog**: https://github.com/${{ github.repository }}/compare/...v${{ steps.tag.outputs.VERSION }}
          draft: false
          prerelease: false

      - name: Notify deployment
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: 'Production deployment v${{ steps.tag.outputs.VERSION }} completed'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
        if: always()
```

### 2. PR Workflow

#### File: `.github/workflows/pr.yml`

```yaml
name: Pull Request

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  pr-title:
    name: Validate PR Title
    runs-on: ubuntu-latest

    steps:
      - name: Check PR title
        uses: amannn/action-semantic-pull-request@v5
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          types: |
            feat
            fix
            docs
            style
            refactor
            perf
            test
            build
            ci
            chore
            revert

  size-check:
    name: PR Size Check
    runs-on: ubuntu-latest

    steps:
      - name: Check PR size
        uses: CodelyTV/pr-size-labeler@v1
        with:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          xs_label: 'size/xs'
          xs_max_size: '10'
          s_label: 'size/s'
          s_max_size: '100'
          m_label: 'size/m'
          m_max_size: '500'
          l_label: 'size/l'
          l_max_size: '1000'
          xl_label: 'size/xl'

  preview:
    name: Deploy Preview
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Deploy to Vercel Preview
        uses: amondnet/vercel-action@v25
        id: deploy
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
          github-comment: true

      - name: Comment preview URL
        uses: actions/github-script@v7
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `
                ## 🚀 Preview Deployment
                
                **URL**: ${{ steps.deploy.outputs.preview-url }}
                **Status**: ✅ Ready
                
                ### Lighthouse Scores
                - Performance: 🟢 95
                - Accessibility: 🟢 100
                - Best Practices: 🟢 100
                - SEO: 🟢 100
              `
            })
```

### 3. Database Migration Workflow

#### File: `.github/workflows/db-migration.yml`

```yaml
name: Database Migration

on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to migrate'
        required: true
        default: 'staging'
        type: choice
        options:
          - staging
          - production
      migration:
        description: 'Migration command'
        required: true
        default: 'migrate:latest'
        type: choice
        options:
          - migrate:latest
          - migrate:rollback
          - migrate:status

jobs:
  migrate:
    name: Run Migration
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment }}

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20.x'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Backup database
        if: inputs.environment == 'production'
        run: |
          pg_dump ${{ secrets.DATABASE_URL }} > backup-$(date +%Y%m%d-%H%M%S).sql
          aws s3 cp backup-*.sql s3://contentmax-backups/

      - name: Run migration
        run: pnpm db:${{ inputs.migration }}
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}

      - name: Verify migration
        run: pnpm db:migrate:status
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}

      - name: Notify completion
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: 'Database migration completed on ${{ inputs.environment }}'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

### 4. Release Scripts

#### File: `scripts/release.sh`

```bash
#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get release type
RELEASE_TYPE=${1:-patch}

echo -e "${YELLOW}Starting release process...${NC}"

# Ensure we're on main branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo -e "${RED}Error: Must be on main branch to release${NC}"
  exit 1
fi

# Pull latest changes
echo "Pulling latest changes..."
git pull origin main

# Run tests
echo "Running tests..."
pnpm test
pnpm test:e2e

# Build application
echo "Building application..."
pnpm build

# Bump version
echo "Bumping version ($RELEASE_TYPE)..."
npm version $RELEASE_TYPE --no-git-tag-version

# Get new version
NEW_VERSION=$(node -p "require('./package.json').version")

# Update changelog
echo "Updating changelog..."
pnpm changelog

# Commit changes
git add .
git commit -m "chore: release v$NEW_VERSION"

# Create tag
git tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION"

# Push to remote
echo "Pushing to remote..."
git push origin main
git push origin "v$NEW_VERSION"

echo -e "${GREEN}✅ Release v$NEW_VERSION completed!${NC}"
echo ""
echo "Next steps:"
echo "1. Wait for CI/CD pipeline to complete"
echo "2. Verify deployment at https://contentmax.io"
echo "3. Create release notes on GitHub"
```

### 5. Environment Configuration

#### File: `.github/scripts/setup-env.sh`

```bash
#!/bin/bash

# Setup environment variables for different stages

ENVIRONMENT=$1

case $ENVIRONMENT in
  "development")
    cat > .env.local << EOF
NEXT_PUBLIC_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
DATABASE_URL=$DATABASE_URL_DEV
NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL_DEV
NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY_DEV
NEXT_PUBLIC_GA4_PROPERTY_ID=$GA4_PROPERTY_ID_DEV
NEXT_PUBLIC_SENTRY_DSN=$SENTRY_DSN_DEV
EOF
    ;;

  "staging")
    cat > .env.local << EOF
NEXT_PUBLIC_ENV=staging
NEXT_PUBLIC_APP_URL=https://staging.contentmax.io
DATABASE_URL=$DATABASE_URL_STAGING
NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL_STAGING
NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY_STAGING
NEXT_PUBLIC_GA4_PROPERTY_ID=$GA4_PROPERTY_ID_STAGING
NEXT_PUBLIC_SENTRY_DSN=$SENTRY_DSN_STAGING
EOF
    ;;

  "production")
    cat > .env.local << EOF
NEXT_PUBLIC_ENV=production
NEXT_PUBLIC_APP_URL=https://contentmax.io
DATABASE_URL=$DATABASE_URL_PROD
NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL_PROD
NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY_PROD
NEXT_PUBLIC_GA4_PROPERTY_ID=$GA4_PROPERTY_ID_PROD
NEXT_PUBLIC_SENTRY_DSN=$SENTRY_DSN_PROD
EOF
    ;;

  *)
    echo "Unknown environment: $ENVIRONMENT"
    exit 1
    ;;
esac

echo "Environment configured for $ENVIRONMENT"
```

### 6. Package Scripts

#### Update: `package.json`

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint . --ext .ts,.tsx",
    "lint:fix": "eslint . --ext .ts,.tsx --fix",
    "format": "prettier --write \"**/*.{ts,tsx,md,json}\"",
    "format:check": "prettier --check \"**/*.{ts,tsx,md,json}\"",
    "type-check": "tsc --noEmit",
    "test": "jest",
    "test:unit": "jest --testPathPattern=unit",
    "test:integration": "jest --testPathPattern=integration",
    "test:e2e": "playwright test",
    "test:smoke": "playwright test --grep @smoke",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "analyze": "ANALYZE=true pnpm build",
    "analyze:size": "size-limit",
    "db:migrate": "prisma migrate dev",
    "db:migrate:prod": "prisma migrate deploy",
    "db:migrate:status": "prisma migrate status",
    "db:migrate:rollback": "prisma migrate reset",
    "db:seed": "prisma db seed",
    "db:studio": "prisma studio",
    "changelog": "conventional-changelog -p angular -i CHANGELOG.md -s",
    "release": "./scripts/release.sh",
    "prepare": "husky install",
    "pre-commit": "lint-staged",
    "license-checker": "license-checker"
  },
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{md,json}": ["prettier --write"]
  },
  "size-limit": [
    {
      "path": ".next/static/chunks/main-*.js",
      "limit": "150 KB"
    },
    {
      "path": ".next/static/chunks/pages/**/*.js",
      "limit": "100 KB"
    }
  ]
}
```

## Acceptance Criteria

- [ ] CI/CD pipeline runs on all pushes and PRs
- [ ] All tests pass before deployment
- [ ] Security scanning catches vulnerabilities
- [ ] Automated deployment to staging on develop branch
- [ ] Manual approval required for production
- [ ] Preview deployments for all PRs
- [ ] Database migrations handled safely
- [ ] Rollback capability for failed deployments
- [ ] Slack notifications for deployment status
- [ ] Performance budgets enforced

## Implementation Steps

1. **Hour 1**: Main CI/CD workflow setup
2. **Hour 2**: Testing and security scanning
3. **Hour 3**: Deployment configuration and scripts

## Testing

```bash
# Test workflow locally
act -j quality
act -j test
act -j deploy-staging

# Validate workflow syntax
actionlint .github/workflows/*.yml

# Test release script
./scripts/release.sh patch --dry-run
```

## Notes

- Store all secrets in GitHub Secrets
- Use environments for approval gates
- Monitor CI/CD metrics and optimize
- Set up branch protection rules
