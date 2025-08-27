# Story 2.6: Import UI & Progress Tracking

## User Story
As a content manager,
I want a clear interface to import my site data with real-time progress updates,
So that I can understand what's happening during the import process.

## Size & Priority
- **Size**: M (4 hours)
- **Priority**: P1 - High
- **Sprint**: 2
- **Dependencies**: Tasks 2.2-2.5

## Description
Create a multi-step import wizard with real-time progress tracking, error reporting, and import history management.

## Implementation Steps

1. **Create import wizard component**
   ```typescript
   interface ImportWizardProps {
     onComplete: (importId: string) => void;
   }
   
   enum ImportStep {
     SITEMAP_INPUT = 'sitemap_input',
     CONFIGURATION = 'configuration',
     PROCESSING = 'processing',
     REVIEW = 'review'
   }
   
   const ImportWizard: React.FC<ImportWizardProps> = () => {
     const [currentStep, setCurrentStep] = useState(ImportStep.SITEMAP_INPUT);
     const [importConfig, setImportConfig] = useState<ImportConfig>({});
     
     // Step components
     // Navigation logic
     // Progress tracking
   };
   ```

2. **Sitemap input step**
   ```typescript
   interface SitemapInputProps {
     onNext: (sitemapUrl: string) => void;
   }
   
   const SitemapInput: React.FC<SitemapInputProps> = ({ onNext }) => {
     // URL input field
     // Validation (check URL format, accessibility)
     // Preview sitemap structure
     // Support for multiple sitemaps
   };
   ```

3. **Configuration step**
   ```typescript
   interface ImportConfigProps {
     sitemapData: SitemapPreview;
     onNext: (config: ImportConfig) => void;
   }
   
   interface ImportConfig {
     scrapeContent: boolean;
     rateLimit: number;       // Requests per second
     includePatterns: string[];
     excludePatterns: string[];
     maxPages?: number;
     priority: 'high' | 'normal' | 'low';
   }
   ```

4. **Real-time progress tracking**
   ```typescript
   interface ProgressTrackerProps {
     importId: string;
   }
   
   const ProgressTracker: React.FC<ProgressTrackerProps> = ({ importId }) => {
     const { data, loading } = useRealtimeProgress(importId);
     
     return (
       <div>
         <ProgressBar value={data.percentage} />
         <StageIndicator currentStage={data.stage} />
         <MetricCards metrics={data.metrics} />
         <LogStream logs={data.recentLogs} />
       </div>
     );
   };
   
   // Custom hook for real-time updates
   function useRealtimeProgress(importId: string) {
     const [progress, setProgress] = useState<ImportProgress>();
     
     useEffect(() => {
       const subscription = supabase
         .channel(`import:${importId}`)
         .on('postgres_changes', {
           event: 'UPDATE',
           schema: 'public',
           table: 'import_jobs',
           filter: `id=eq.${importId}`
         }, (payload) => {
           setProgress(payload.new);
         })
         .subscribe();
       
       return () => subscription.unsubscribe();
     }, [importId]);
     
     return progress;
   }
   ```

5. **Import review and summary**
   ```typescript
   interface ImportSummary {
     totalUrls: number;
     categorizedUrls: {
       product: number;
       category: number;
       brand: number;
       other: number;
     };
     contentScraped: number;
     errors: ImportError[];
     duration: number;
     nextSteps: string[];
   }
   ```

## Files to Create

- `app/import/page.tsx` - Main import page
- `components/import/ImportWizard.tsx` - Multi-step wizard
- `components/import/SitemapInput.tsx` - URL input step
- `components/import/ImportConfig.tsx` - Configuration step
- `components/import/ProgressTracker.tsx` - Progress display
- `components/import/ImportSummary.tsx` - Results summary
- `components/import/ImportHistory.tsx` - Previous imports
- `hooks/useImportProgress.ts` - Real-time progress hook
- `hooks/useImportHistory.ts` - Import history hook

## UI Components

### Progress Visualization
```typescript
interface ProgressVisualization {
  // Overall progress bar
  overallProgress: number; // 0-100
  
  // Stage indicators
  stages: {
    name: string;
    status: 'pending' | 'active' | 'complete' | 'error';
    startTime?: Date;
    endTime?: Date;
  }[];
  
  // Real-time metrics
  metrics: {
    urlsDiscovered: number;
    pagesScraped: number;
    errorsEncountered: number;
    estimatedTimeRemaining: number;
  };
  
  // Activity feed
  recentActivity: {
    timestamp: Date;
    message: string;
    type: 'info' | 'warning' | 'error' | 'success';
  }[];
}
```

### Import History Table
```typescript
interface ImportHistoryItem {
  id: string;
  startedAt: Date;
  completedAt?: Date;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  urlsImported: number;
  duration: number;
  triggeredBy: string;
  actions: {
    view: () => void;
    rerun: () => void;
    delete: () => void;
  };
}
```

## Visual Design

```typescript
// Progress bar with stages
<div className="space-y-4">
  <div className="flex justify-between text-sm">
    <span>Importing site data...</span>
    <span>{progress}%</span>
  </div>
  <div className="w-full bg-gray-200 rounded-full h-2">
    <div 
      className="bg-blue-600 h-2 rounded-full transition-all"
      style={{ width: `${progress}%` }}
    />
  </div>
  <div className="flex justify-between">
    {stages.map(stage => (
      <StageIndicator key={stage.name} {...stage} />
    ))}
  </div>
</div>
```

## Error Handling UI

```typescript
interface ErrorDisplay {
  level: 'warning' | 'error';
  message: string;
  details?: string;
  retryable: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

// Error recovery options
const ErrorRecovery: React.FC<{ errors: ImportError[] }> = ({ errors }) => {
  return (
    <Alert variant="warning">
      <h3>Some items couldn't be imported</h3>
      <ul>
        {errors.map(error => (
          <li key={error.url}>
            {error.url}: {error.message}
            {error.retryable && (
              <button onClick={() => retryImport(error.url)}>
                Retry
              </button>
            )}
          </li>
        ))}
      </ul>
    </Alert>
  );
};
```

## Acceptance Criteria

- [ ] Wizard guides through complete import process
- [ ] Real-time progress updates during import
- [ ] Clear visualization of import stages
- [ ] Error states clearly communicated
- [ ] Import history shows previous imports
- [ ] Can cancel running imports
- [ ] Can retry failed items
- [ ] Configuration options working
- [ ] Summary shows actionable next steps

## Performance Requirements

- Progress updates every 1-2 seconds
- UI remains responsive during import
- Handle imports of 10,000+ URLs
- Progress calculation accurate
- No memory leaks from subscriptions

## Accessibility Requirements

- [ ] Keyboard navigation through wizard
- [ ] Screen reader announcements for progress
- [ ] Focus management between steps
- [ ] Error messages read by screen readers
- [ ] Color not sole indicator of status

## Testing Requirements

- [ ] Test wizard flow completion
- [ ] Test real-time updates
- [ ] Test error handling
- [ ] Test cancellation
- [ ] Test retry mechanism
- [ ] Test with various import sizes
- [ ] Test responsive design
- [ ] Test accessibility

## Definition of Done

- [ ] Code complete and committed
- [ ] Wizard flow implemented
- [ ] Real-time progress working
- [ ] Error handling comprehensive
- [ ] Import history functional
- [ ] UI responsive and accessible
- [ ] Tests written and passing
- [ ] Documentation updated
- [ ] Peer review completed