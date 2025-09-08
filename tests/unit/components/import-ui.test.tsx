import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

import ImportWizard from '@/components/import/ImportWizard';
import SitemapInput from '@/components/import/SitemapInput';
import ImportConfig from '@/components/import/ImportConfig';
import ImportSummary from '@/components/import/ImportSummary';
import ImportHistory from '@/components/import/ImportHistory';

// Mock fetch
global.fetch = jest.fn();

// Mock Next.js useRouter
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

// Mock Supabase client
jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    channel: () => ({
      on: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }),
    }),
  }),
}));

describe('ImportWizard', () => {
  const mockOnComplete = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (fetch as jest.MockedFunction<typeof fetch>).mockClear();
  });

  it('should render initial sitemap input step', () => {
    render(<ImportWizard onComplete={mockOnComplete} />);
    
    expect(screen.getByText('Enter Sitemap URL')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/https:\/\/example\.com\/sitemap\.xml/)).toBeInTheDocument();
  });

  it('should show progress indicator with correct steps', () => {
    render(<ImportWizard onComplete={mockOnComplete} />);
    
    expect(screen.getByText('Sitemap URL')).toBeInTheDocument();
    expect(screen.getByText('Configuration')).toBeInTheDocument();
    expect(screen.getByText('Processing')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
  });

  it('should disable next button initially', () => {
    render(<ImportWizard onComplete={mockOnComplete} />);
    
    const nextButton = screen.getByRole('button', { name: /next/i });
    expect(nextButton).toBeDisabled();
  });
});

describe('SitemapInput', () => {
  const mockOnNext = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (fetch as jest.MockedFunction<typeof fetch>).mockClear();
  });

  it('should render input field and validate button', () => {
    render(<SitemapInput onNext={mockOnNext} />);
    
    expect(screen.getByLabelText(/sitemap url/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /validate/i })).toBeInTheDocument();
  });

  it('should validate URL format', async () => {
    const user = userEvent.setup();
    render(<SitemapInput onNext={mockOnNext} />);
    
    const input = screen.getByLabelText(/sitemap url/i);
    const validateButton = screen.getByRole('button', { name: /validate/i });
    
    await user.type(input, 'invalid-url');
    await user.click(validateButton);
    
    expect(screen.getByText(/please enter a valid url/i)).toBeInTheDocument();
  });

  it('should call API to validate sitemap', async () => {
    const user = userEvent.setup();
    const mockPreview = {
      totalUrls: 1000,
      categories: { product: 500, category: 300, brand: 100, other: 100 },
      sampleUrls: ['https://example.com/product/1', 'https://example.com/category/1'],
    };

    (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ preview: mockPreview }),
    } as Response);

    render(<SitemapInput onNext={mockOnNext} />);
    
    const input = screen.getByLabelText(/sitemap url/i);
    const validateButton = screen.getByRole('button', { name: /validate/i });
    
    await user.type(input, 'https://example.com/sitemap.xml');
    await user.click(validateButton);
    
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/import/validate-sitemap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://example.com/sitemap.xml' }),
      });
    });

    expect(screen.getByText('Sitemap Validated Successfully')).toBeInTheDocument();
    expect(screen.getByText('1,000')).toBeInTheDocument();
  });

  it('should show error message on validation failure', async () => {
    const user = userEvent.setup();

    (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Sitemap not found' }),
    } as Response);

    render(<SitemapInput onNext={mockOnNext} />);
    
    const input = screen.getByLabelText(/sitemap url/i);
    const validateButton = screen.getByRole('button', { name: /validate/i });
    
    await user.type(input, 'https://example.com/nonexistent.xml');
    await user.click(validateButton);
    
    await waitFor(() => {
      expect(screen.getByText('Sitemap not found')).toBeInTheDocument();
    });
  });
});

describe('ImportConfig', () => {
  const mockSitemapData = {
    totalUrls: 1000,
    categories: { product: 500, category: 300, brand: 100, other: 100 },
    sampleUrls: ['https://example.com/product/1'],
  };

  const mockInitialConfig = {
    scrapeContent: true,
    rateLimit: 5,
    priority: 'normal' as const,
  };

  const mockOnNext = jest.fn();
  const mockOnBack = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render configuration options', () => {
    render(
      <ImportConfig
        sitemapData={mockSitemapData}
        initialConfig={mockInitialConfig}
        onNext={mockOnNext}
        onBack={mockOnBack}
      />
    );
    
    expect(screen.getByLabelText(/scrape page content/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/rate limit/i)).toBeInTheDocument();
    expect(screen.getByText(/processing priority/i)).toBeInTheDocument();
  });

  it('should show content scraping warning when enabled', () => {
    render(
      <ImportConfig
        sitemapData={mockSitemapData}
        initialConfig={{ ...mockInitialConfig, scrapeContent: true }}
        onNext={mockOnNext}
        onBack={mockOnBack}
      />
    );
    
    expect(screen.getByText(/content scraping will take longer/i)).toBeInTheDocument();
  });

  it('should update rate limit', async () => {
    const user = userEvent.setup();
    render(
      <ImportConfig
        sitemapData={mockSitemapData}
        initialConfig={mockInitialConfig}
        onNext={mockOnNext}
        onBack={mockOnBack}
      />
    );
    
    const rateSlider = screen.getByLabelText(/rate limit/i);
    await user.clear(rateSlider);
    await user.type(rateSlider, '10');
    
    expect(screen.getByDisplayValue('10')).toBeInTheDocument();
  });

  it('should handle form submission', async () => {
    const user = userEvent.setup();
    render(
      <ImportConfig
        sitemapData={mockSitemapData}
        initialConfig={mockInitialConfig}
        onNext={mockOnNext}
        onBack={mockOnBack}
      />
    );
    
    const startButton = screen.getByRole('button', { name: /start import/i });
    await user.click(startButton);
    
    expect(mockOnNext).toHaveBeenCalledWith(expect.objectContaining({
      scrapeContent: true,
      rateLimit: 5,
      priority: 'normal',
    }));
  });
});

describe('ImportSummary', () => {
  const mockSummary = {
    id: 'import-123',
    totalUrls: 1000,
    successfulUrls: 950,
    failedUrls: 50,
    skippedUrls: 0,
    categorizedUrls: {
      product: 500,
      category: 300,
      brand: 100,
      blog: 50,
      other: 50,
    },
    contentScraped: 900,
    duration: 300,
    errors: [
      {
        url: 'https://example.com/error',
        message: 'Failed to scrape',
        type: 'error' as const,
        retryable: true,
      },
    ],
    warnings: [],
    nextSteps: [
      'Review content gaps',
      'Generate missing content',
      'Optimize taxonomy structure',
    ],
  };

  const mockOnComplete = jest.fn();
  const mockOnRestart = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should display import statistics', () => {
    render(
      <ImportSummary
        summary={mockSummary}
        onComplete={mockOnComplete}
        onRestart={mockOnRestart}
      />
    );
    
    expect(screen.getByText('1,000')).toBeInTheDocument();
    expect(screen.getByText('95.0%')).toBeInTheDocument();
    expect(screen.getByText('900')).toBeInTheDocument();
    expect(screen.getByText('5m 0s')).toBeInTheDocument();
  });

  it('should show categories breakdown', async () => {
    const user = userEvent.setup();
    render(
      <ImportSummary
        summary={mockSummary}
        onComplete={mockOnComplete}
        onRestart={mockOnRestart}
      />
    );
    
    const categoriesTab = screen.getByRole('tab', { name: /categories/i });
    await user.click(categoriesTab);
    
    expect(screen.getByText('Product')).toBeInTheDocument();
    expect(screen.getByText('Category')).toBeInTheDocument();
  });

  it('should show errors and warnings', async () => {
    const user = userEvent.setup();
    render(
      <ImportSummary
        summary={mockSummary}
        onComplete={mockOnComplete}
        onRestart={mockOnRestart}
      />
    );
    
    const issuesTab = screen.getByRole('tab', { name: /issues/i });
    await user.click(issuesTab);
    
    expect(screen.getByText('https://example.com/error')).toBeInTheDocument();
    expect(screen.getByText('Failed to scrape')).toBeInTheDocument();
  });

  it('should show next steps', async () => {
    const user = userEvent.setup();
    render(
      <ImportSummary
        summary={mockSummary}
        onComplete={mockOnComplete}
        onRestart={mockOnRestart}
      />
    );
    
    const nextStepsTab = screen.getByRole('tab', { name: /next steps/i });
    await user.click(nextStepsTab);
    
    expect(screen.getByText('Review content gaps')).toBeInTheDocument();
    expect(screen.getByText('Generate missing content')).toBeInTheDocument();
  });

  it('should handle completion', async () => {
    const user = userEvent.setup();
    render(
      <ImportSummary
        summary={mockSummary}
        onComplete={mockOnComplete}
        onRestart={mockOnRestart}
      />
    );
    
    const completeButton = screen.getByRole('button', { name: /go to dashboard/i });
    await user.click(completeButton);
    
    expect(mockOnComplete).toHaveBeenCalled();
  });
});

describe('ImportHistory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock the useImportHistory hook
    jest.doMock('@/hooks/useImportHistory', () => ({
      __esModule: true,
      default: () => ({
        imports: [
          {
            id: 'import-1',
            startedAt: '2023-01-01T10:00:00Z',
            completedAt: '2023-01-01T10:05:00Z',
            status: 'completed',
            totalUrls: 1000,
            successfulUrls: 950,
            failedUrls: 50,
            sitemapUrl: 'https://example.com/sitemap.xml',
            triggeredBy: 'user@example.com',
          },
          {
            id: 'import-2',
            startedAt: '2023-01-02T10:00:00Z',
            status: 'running',
            totalUrls: 500,
            successfulUrls: 0,
            failedUrls: 0,
            sitemapUrl: 'https://example.com/sitemap2.xml',
            triggeredBy: 'user@example.com',
          },
        ],
        loading: false,
        error: null,
        refreshImports: jest.fn(),
        deleteImport: jest.fn(),
        retryImport: jest.fn(),
      }),
    }));
  });

  it('should display import history table', () => {
    render(<ImportHistory />);
    
    expect(screen.getByText('2 imports found')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('Running')).toBeInTheDocument();
  });

  it('should show loading state', () => {
    jest.doMock('@/hooks/useImportHistory', () => ({
      __esModule: true,
      default: () => ({
        imports: [],
        loading: true,
        error: null,
        refreshImports: jest.fn(),
        deleteImport: jest.fn(),
        retryImport: jest.fn(),
      }),
    }));

    render(<ImportHistory />);
    
    // Loading spinner should be present
    const loadingElement = screen.getByRole('status', { hidden: true });
    expect(loadingElement).toBeInTheDocument();
  });

  it('should show error state', () => {
    jest.doMock('@/hooks/useImportHistory', () => ({
      __esModule: true,
      default: () => ({
        imports: [],
        loading: false,
        error: 'Failed to load imports',
        refreshImports: jest.fn(),
        deleteImport: jest.fn(),
        retryImport: jest.fn(),
      }),
    }));

    render(<ImportHistory />);
    
    expect(screen.getByText('Failed to load imports')).toBeInTheDocument();
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });
});