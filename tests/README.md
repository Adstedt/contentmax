# ContentMax Test Suite

## Test Organization

Tests are organized by type and feature area for better maintainability and clarity.

### Directory Structure

```
tests/
├── unit/                      # Unit tests for isolated components/functions
│   ├── components/           # React component tests
│   │   └── import-ui.test.tsx
│   ├── hooks/               # Custom React hooks tests
│   └── lib/                 # Business logic tests
│       ├── processing.test.ts
│       ├── integrations/    # Third-party integration unit tests
│       │   └── analytics.test.ts
│       ├── matching/        # Matching algorithm tests
│       │   └── url-matcher.test.ts
│       ├── scraping/        # Scraping utilities tests
│       ├── sitemap/         # Sitemap parsing tests
│       │   └── sitemap-parser.test.ts
│       └── taxonomy/        # Taxonomy logic tests
│
├── integration/              # Integration tests for API endpoints and services
│   ├── api/                 # API endpoint tests
│   │   ├── batch-import.test.ts
│   │   └── product-feed.test.ts
│   ├── google/              # Google services integration
│   │   ├── google-integration.test.ts
│   │   └── google-oauth.test.ts
│   ├── jobs/                # Background job tests
│   │   └── metrics-sync.test.ts
│   ├── scraping/            # Scraping integration tests
│   │   └── scraping-integration.test.ts
│   └── sitemap/             # Sitemap integration tests
│       └── sitemap-integration.test.ts
│
├── e2e/                      # End-to-end tests
│   ├── auth/                # Authentication flows
│   ├── content/             # Content management flows
│   └── taxonomy/            # Taxonomy visualization tests
│       ├── deep-taxonomy-review.js
│       ├── review-taxonomy.js
│       ├── taxonomy-ux-review.js
│       ├── taxonomy-ux-test.js
│       ├── taxonomy-visual-test.js
│       └── test-focus-mode.js
│
├── migrations/              # Database migration tests
│   └── 009_node_centric_model.test.ts
│
├── fixtures/               # Test data and mocks
│
├── utils/                 # Test utilities and helpers
│
└── setup.ts              # Test configuration and setup
```

## Test Types

### Unit Tests
- Test individual functions, components, or modules in isolation
- Mock external dependencies
- Fast execution
- Located in `tests/unit/`

### Integration Tests
- Test interaction between multiple components/services
- May use real database connections (test database)
- Test API endpoints with actual HTTP requests
- Located in `tests/integration/`

### E2E Tests
- Test complete user workflows
- Run in browser environment
- Test the full application stack
- Located in `tests/e2e/`

## Running Tests

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run E2E tests
npm run test:e2e

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Writing Tests

### Naming Conventions
- Test files: `*.test.ts` or `*.test.tsx` for TypeScript/React
- Test descriptions: Use descriptive names that explain what is being tested
- Use `describe` blocks to group related tests

### Test Structure Example

```typescript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

describe('ComponentName', () => {
  beforeEach(() => {
    // Setup before each test
  });

  afterEach(() => {
    // Cleanup after each test
  });

  describe('methodName', () => {
    it('should handle normal case', () => {
      // Test implementation
      expect(result).toBe(expected);
    });

    it('should handle edge case', () => {
      // Test implementation
      expect(result).toBe(expected);
    });

    it('should throw error for invalid input', () => {
      // Test implementation
      expect(() => functionCall()).toThrow();
    });
  });
});
```

## Best Practices

1. **Isolation**: Each test should be independent and not rely on other tests
2. **Clarity**: Test names should clearly describe what is being tested
3. **Coverage**: Aim for high code coverage but focus on critical paths
4. **Mocking**: Mock external dependencies in unit tests
5. **Fixtures**: Use consistent test data stored in `fixtures/`
6. **Cleanup**: Always clean up after tests (database, files, etc.)
7. **Performance**: Keep unit tests fast (< 100ms per test)

## Test Data

### Fixtures
Store reusable test data in `tests/fixtures/`:
- `users.json` - Sample user data
- `content.json` - Sample content items
- `taxonomy.json` - Sample taxonomy data

### Mocks
Create mocks in test files or `tests/utils/mocks/`:
- API response mocks
- Service mocks
- Component mocks

## Continuous Integration

Tests run automatically on:
- Pull request creation
- Commits to main branch
- Pre-deployment

### CI Requirements
- All tests must pass
- Code coverage > 80%
- No console errors
- Linting passes

## Troubleshooting

### Common Issues

1. **Test Timeout**: Increase timeout for async operations
   ```typescript
   it('should handle async operation', async () => {
     // test code
   }, 10000); // 10 second timeout
   ```

2. **Database Connection**: Ensure test database is running
   ```bash
   npm run db:test:setup
   ```

3. **Environment Variables**: Use `.env.test` for test configuration

4. **Flaky Tests**: Use retry logic for network-dependent tests
   ```typescript
   it.retry(3)('should handle network request', async () => {
     // test code
   });
   ```

## Contributing

When adding new tests:
1. Place in appropriate directory based on test type
2. Follow naming conventions
3. Include descriptive comments for complex test logic
4. Update this README if adding new test categories