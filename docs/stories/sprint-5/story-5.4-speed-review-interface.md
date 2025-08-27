# Story 5.4: Speed Review Interface

## User Story

As a content reviewer,
I want a streamlined interface for quickly reviewing and approving generated content,
So that I can process large volumes of content efficiently.

## Size & Priority

- **Size**: M (6 hours)
- **Priority**: P0 - Critical
- **Sprint**: 5
- **Dependencies**: Task 4.4

## Description

Create an optimized review interface with keyboard shortcuts, quick actions, bulk operations, and side-by-side comparison views to enable rapid content review and approval workflows.

## Implementation Steps

1. **Speed review layout**

   ```tsx
   interface SpeedReviewProps {
     items: GeneratedContent[];
     onApprove: (id: string, edits?: ContentEdits) => void;
     onReject: (id: string, reason: string) => void;
     onRequestRevision: (id: string, feedback: string) => void;
   }

   const SpeedReviewInterface: React.FC<SpeedReviewProps> = ({
     items,
     onApprove,
     onReject,
     onRequestRevision,
   }) => {
     const [currentIndex, setCurrentIndex] = useState(0);
     const [viewMode, setViewMode] = useState<'single' | 'split' | 'grid'>('single');
     const [editMode, setEditMode] = useState(false);
     const [edits, setEdits] = useState<Map<string, ContentEdits>>(new Map());
     const [filters, setFilters] = useState<ReviewFilters>({});

     const filteredItems = useMemo(() => applyFilters(items, filters), [items, filters]);

     const currentItem = filteredItems[currentIndex];

     // Keyboard navigation
     useKeyboardShortcuts({
       ArrowRight: () => navigateNext(),
       ArrowLeft: () => navigatePrevious(),
       a: () => approveCurrentItem(),
       r: () => showRejectDialog(),
       e: () => toggleEditMode(),
       f: () => toggleFullscreen(),
       '1': () => setViewMode('single'),
       '2': () => setViewMode('split'),
       '3': () => setViewMode('grid'),
       'cmd+a': () => selectAll(),
       'cmd+Enter': () => bulkApprove(),
     });

     const navigateNext = () => {
       if (currentIndex < filteredItems.length - 1) {
         setCurrentIndex(currentIndex + 1);
       }
     };

     const navigatePrevious = () => {
       if (currentIndex > 0) {
         setCurrentIndex(currentIndex - 1);
       }
     };

     const approveCurrentItem = () => {
       const itemEdits = edits.get(currentItem.id);
       onApprove(currentItem.id, itemEdits);

       // Auto-advance to next item
       if (currentIndex < filteredItems.length - 1) {
         setCurrentIndex(currentIndex + 1);
       }
     };

     return (
       <div className="speed-review-interface">
         <ReviewToolbar
           currentIndex={currentIndex}
           totalItems={filteredItems.length}
           viewMode={viewMode}
           onViewModeChange={setViewMode}
           onFilterChange={setFilters}
         />

         <div className="review-content">
           {viewMode === 'single' && (
             <SingleItemView
               item={currentItem}
               editMode={editMode}
               onEdit={(changes) => {
                 setEdits((prev) => new Map(prev).set(currentItem.id, changes));
               }}
             />
           )}

           {viewMode === 'split' && (
             <SplitView
               leftItem={currentItem}
               rightItem={filteredItems[currentIndex + 1]}
               editMode={editMode}
             />
           )}

           {viewMode === 'grid' && (
             <GridView
               items={filteredItems.slice(currentIndex, currentIndex + 6)}
               selectedIndex={0}
               onSelect={(index) => setCurrentIndex(currentIndex + index)}
             />
           )}
         </div>

         <ReviewActionBar
           onApprove={approveCurrentItem}
           onReject={() => showRejectDialog()}
           onRequestRevision={() => showRevisionDialog()}
           onSkip={navigateNext}
         />

         <ReviewProgress
           reviewed={currentIndex}
           total={filteredItems.length}
           approved={getApprovedCount()}
           rejected={getRejectedCount()}
         />
       </div>
     );
   };
   ```

2. **Content preview component**

   ```tsx
   interface ContentPreviewProps {
     content: GeneratedContent;
     editMode: boolean;
     onEdit: (changes: ContentEdits) => void;
     highlightKeywords?: string[];
   }

   const ContentPreview: React.FC<ContentPreviewProps> = ({
     content,
     editMode,
     onEdit,
     highlightKeywords = [],
   }) => {
     const [activeTab, setActiveTab] = useState<'preview' | 'html' | 'json'>('preview');
     const [localEdits, setLocalEdits] = useState<ContentEdits>({});

     const handleInlineEdit = (field: string, value: string) => {
       const newEdits = { ...localEdits, [field]: value };
       setLocalEdits(newEdits);
       onEdit(newEdits);
     };

     const highlightText = (text: string): string => {
       if (highlightKeywords.length === 0) return text;

       let highlighted = text;
       highlightKeywords.forEach((keyword) => {
         const regex = new RegExp(`(${keyword})`, 'gi');
         highlighted = highlighted.replace(regex, '<mark class="keyword-highlight">$1</mark>');
       });
       return highlighted;
     };

     return (
       <div className="content-preview">
         <div className="preview-tabs">
           <button
             className={activeTab === 'preview' ? 'active' : ''}
             onClick={() => setActiveTab('preview')}
           >
             Preview
           </button>
           <button
             className={activeTab === 'html' ? 'active' : ''}
             onClick={() => setActiveTab('html')}
           >
             HTML
           </button>
           <button
             className={activeTab === 'json' ? 'active' : ''}
             onClick={() => setActiveTab('json')}
           >
             JSON
           </button>
         </div>

         <div className="preview-content">
           {activeTab === 'preview' && (
             <div className="rendered-preview">
               <div className="content-meta">
                 <span className="content-type">{content.type}</span>
                 <span className="content-language">{content.language}</span>
                 <span className="word-count">{content.wordCount} words</span>
               </div>

               {content.components.map((component, index) => (
                 <div key={index} className="component-preview">
                   <h4>{component.type}</h4>
                   {editMode ? (
                     <ContentEditable
                       html={highlightText(component.html)}
                       onChange={(e) =>
                         handleInlineEdit(`components.${index}.html`, e.target.value)
                       }
                       className="editable-content"
                     />
                   ) : (
                     <div
                       className="static-content"
                       dangerouslySetInnerHTML={{
                         __html: highlightText(component.html),
                       }}
                     />
                   )}
                 </div>
               ))}

               <div className="seo-preview">
                 <h4>SEO Preview</h4>
                 <div className="google-preview">
                   <div className="preview-title">
                     {editMode ? (
                       <input
                         type="text"
                         value={localEdits.title || content.seo.title}
                         onChange={(e) => handleInlineEdit('title', e.target.value)}
                         maxLength={60}
                       />
                     ) : (
                       <span>{content.seo.title}</span>
                     )}
                   </div>
                   <div className="preview-url">{content.url}</div>
                   <div className="preview-description">
                     {editMode ? (
                       <textarea
                         value={localEdits.description || content.seo.description}
                         onChange={(e) => handleInlineEdit('description', e.target.value)}
                         maxLength={160}
                       />
                     ) : (
                       <span>{content.seo.description}</span>
                     )}
                   </div>
                 </div>
               </div>
             </div>
           )}

           {activeTab === 'html' && (
             <div className="html-view">
               <pre>
                 <code className="language-html">{content.html}</code>
               </pre>
             </div>
           )}

           {activeTab === 'json' && (
             <div className="json-view">
               <pre>
                 <code className="language-json">{JSON.stringify(content, null, 2)}</code>
               </pre>
             </div>
           )}
         </div>

         <ContentQualityIndicators content={content} />
       </div>
     );
   };
   ```

3. **Quick action system**

   ```typescript
   class QuickActionManager {
     private actions: Map<string, QuickAction> = new Map();
     private history: ActionHistory[] = [];
     private shortcuts: Map<string, string> = new Map();

     constructor() {
       this.registerDefaultActions();
     }

     private registerDefaultActions() {
       this.registerAction({
         id: 'approve',
         name: 'Approve',
         icon: 'check',
         shortcut: 'a',
         execute: async (item) => {
           await this.approveContent(item);
         },
       });

       this.registerAction({
         id: 'approve-with-edits',
         name: 'Approve with Edits',
         icon: 'edit-check',
         shortcut: 'shift+a',
         execute: async (item, edits) => {
           await this.approveWithEdits(item, edits);
         },
       });

       this.registerAction({
         id: 'reject',
         name: 'Reject',
         icon: 'x',
         shortcut: 'r',
         execute: async (item, reason) => {
           await this.rejectContent(item, reason);
         },
       });

       this.registerAction({
         id: 'request-revision',
         name: 'Request Revision',
         icon: 'refresh',
         shortcut: 'v',
         execute: async (item, feedback) => {
           await this.requestRevision(item, feedback);
         },
       });

       this.registerAction({
         id: 'flag-for-review',
         name: 'Flag for Review',
         icon: 'flag',
         shortcut: 'f',
         execute: async (item, notes) => {
           await this.flagForReview(item, notes);
         },
       });

       this.registerAction({
         id: 'auto-fix',
         name: 'Auto-fix Issues',
         icon: 'wand',
         shortcut: 'cmd+f',
         execute: async (item) => {
           await this.autoFixIssues(item);
         },
       });
     }

     registerAction(action: QuickAction) {
       this.actions.set(action.id, action);
       if (action.shortcut) {
         this.shortcuts.set(action.shortcut, action.id);
       }
     }

     async executeAction(
       actionId: string,
       item: GeneratedContent,
       params?: any
     ): Promise<ActionResult> {
       const action = this.actions.get(actionId);
       if (!action) {
         throw new Error(`Unknown action: ${actionId}`);
       }

       const startTime = Date.now();

       try {
         const result = await action.execute(item, params);

         this.history.push({
           actionId,
           itemId: item.id,
           timestamp: new Date(),
           duration: Date.now() - startTime,
           success: true,
           result,
         });

         return { success: true, result };
       } catch (error) {
         this.history.push({
           actionId,
           itemId: item.id,
           timestamp: new Date(),
           duration: Date.now() - startTime,
           success: false,
           error: error.message,
         });

         return { success: false, error: error.message };
       }
     }

     async executeBulkAction(
       actionId: string,
       items: GeneratedContent[],
       params?: any
     ): Promise<BulkActionResult> {
       const results = await Promise.allSettled(
         items.map((item) => this.executeAction(actionId, item, params))
       );

       const succeeded = results.filter((r) => r.status === 'fulfilled').length;
       const failed = results.filter((r) => r.status === 'rejected').length;

       return {
         total: items.length,
         succeeded,
         failed,
         results,
       };
     }

     private async autoFixIssues(item: GeneratedContent): Promise<GeneratedContent> {
       const issues = this.detectIssues(item);
       let fixed = { ...item };

       for (const issue of issues) {
         switch (issue.type) {
           case 'spelling':
             fixed = await this.fixSpelling(fixed);
             break;
           case 'grammar':
             fixed = await this.fixGrammar(fixed);
             break;
           case 'seo-title-length':
             fixed = this.fixTitleLength(fixed);
             break;
           case 'missing-keywords':
             fixed = await this.addMissingKeywords(fixed);
             break;
           case 'duplicate-content':
             fixed = await this.removeDuplicates(fixed);
             break;
         }
       }

       return fixed;
     }

     private detectIssues(item: GeneratedContent): ContentIssue[] {
       const issues: ContentIssue[] = [];

       // Check SEO title length
       if (item.seo.title.length > 60) {
         issues.push({
           type: 'seo-title-length',
           severity: 'warning',
           message: 'Title exceeds 60 characters',
         });
       }

       // Check keyword presence
       const missingKeywords = item.targetKeywords.filter(
         (keyword) => !item.html.toLowerCase().includes(keyword.toLowerCase())
       );

       if (missingKeywords.length > 0) {
         issues.push({
           type: 'missing-keywords',
           severity: 'warning',
           message: `Missing keywords: ${missingKeywords.join(', ')}`,
         });
       }

       return issues;
     }
   }
   ```

4. **Comparison view component**

   ```tsx
   const ComparisonView: React.FC<{
     original: GeneratedContent;
     revised: GeneratedContent;
     onSelectVersion: (version: 'original' | 'revised') => void;
   }> = ({ original, revised, onSelectVersion }) => {
     const [syncScroll, setSyncScroll] = useState(true);
     const [highlightDifferences, setHighlightDifferences] = useState(true);
     const leftRef = useRef<HTMLDivElement>(null);
     const rightRef = useRef<HTMLDivElement>(null);

     const differences = useMemo(
       () => calculateDifferences(original, revised),
       [original, revised]
     );

     const handleScroll = (source: 'left' | 'right') => {
       if (!syncScroll) return;

       const sourceEl = source === 'left' ? leftRef.current : rightRef.current;
       const targetEl = source === 'left' ? rightRef.current : leftRef.current;

       if (sourceEl && targetEl) {
         targetEl.scrollTop = sourceEl.scrollTop;
       }
     };

     return (
       <div className="comparison-view">
         <div className="comparison-header">
           <div className="comparison-controls">
             <label>
               <input
                 type="checkbox"
                 checked={syncScroll}
                 onChange={(e) => setSyncScroll(e.target.checked)}
               />
               Sync Scroll
             </label>
             <label>
               <input
                 type="checkbox"
                 checked={highlightDifferences}
                 onChange={(e) => setHighlightDifferences(e.target.checked)}
               />
               Highlight Differences
             </label>
           </div>
           <div className="difference-summary">
             <span className="additions">+{differences.additions} additions</span>
             <span className="deletions">-{differences.deletions} deletions</span>
             <span className="modifications">~{differences.modifications} changes</span>
           </div>
         </div>

         <div className="comparison-content">
           <div className="comparison-pane left">
             <div className="pane-header">
               <h3>Original</h3>
               <button className="select-btn" onClick={() => onSelectVersion('original')}>
                 Use This Version
               </button>
             </div>
             <div ref={leftRef} className="pane-content" onScroll={() => handleScroll('left')}>
               <DiffContent
                 content={original}
                 differences={differences}
                 side="original"
                 highlight={highlightDifferences}
               />
             </div>
             <ContentStats content={original} />
           </div>

           <div className="comparison-pane right">
             <div className="pane-header">
               <h3>Revised</h3>
               <button className="select-btn primary" onClick={() => onSelectVersion('revised')}>
                 Use This Version
               </button>
             </div>
             <div ref={rightRef} className="pane-content" onScroll={() => handleScroll('right')}>
               <DiffContent
                 content={revised}
                 differences={differences}
                 side="revised"
                 highlight={highlightDifferences}
               />
             </div>
             <ContentStats content={revised} />
           </div>
         </div>

         <DifferenceNavigator
           differences={differences}
           onNavigate={(diff) => {
             // Scroll to difference
             const element = document.querySelector(`[data-diff-id="${diff.id}"]`);
             element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
           }}
         />
       </div>
     );
   };
   ```

5. **Review analytics dashboard**
   ```tsx
   const ReviewAnalytics: React.FC = () => {
     const [stats, setStats] = useState<ReviewStats>();
     const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month'>('today');

     useEffect(() => {
       loadReviewStats(timeRange).then(setStats);
     }, [timeRange]);

     return (
       <div className="review-analytics">
         <div className="analytics-header">
           <h3>Review Performance</h3>
           <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
         </div>

         <div className="metrics-grid">
           <MetricCard
             title="Items Reviewed"
             value={stats?.totalReviewed || 0}
             change={stats?.reviewedChange}
             icon="document-check"
           />
           <MetricCard
             title="Approval Rate"
             value={`${stats?.approvalRate || 0}%`}
             change={stats?.approvalRateChange}
             icon="thumbs-up"
           />
           <MetricCard
             title="Avg Review Time"
             value={formatDuration(stats?.avgReviewTime || 0)}
             change={stats?.reviewTimeChange}
             icon="clock"
           />
           <MetricCard
             title="Items/Hour"
             value={stats?.throughput || 0}
             change={stats?.throughputChange}
             icon="lightning"
           />
         </div>

         <div className="charts-row">
           <div className="chart-container">
             <h4>Review Velocity</h4>
             <LineChart data={stats?.velocityData} xKey="time" yKey="count" height={200} />
           </div>

           <div className="chart-container">
             <h4>Decision Distribution</h4>
             <PieChart data={stats?.decisionData} dataKey="count" nameKey="decision" height={200} />
           </div>
         </div>

         <div className="reviewer-leaderboard">
           <h4>Top Reviewers</h4>
           <table>
             <thead>
               <tr>
                 <th>Reviewer</th>
                 <th>Items</th>
                 <th>Avg Time</th>
                 <th>Accuracy</th>
               </tr>
             </thead>
             <tbody>
               {stats?.topReviewers.map((reviewer) => (
                 <tr key={reviewer.id}>
                   <td>{reviewer.name}</td>
                   <td>{reviewer.itemsReviewed}</td>
                   <td>{formatDuration(reviewer.avgTime)}</td>
                   <td>{reviewer.accuracy}%</td>
                 </tr>
               ))}
             </tbody>
           </table>
         </div>
       </div>
     );
   };
   ```

## Files to Create

- `components/review/SpeedReviewInterface.tsx` - Main review interface
- `components/review/ContentPreview.tsx` - Content preview component
- `components/review/ComparisonView.tsx` - Side-by-side comparison
- `components/review/QuickActionBar.tsx` - Quick action buttons
- `components/review/ReviewAnalytics.tsx` - Analytics dashboard
- `lib/review/QuickActionManager.ts` - Action execution logic
- `lib/review/ContentDiffer.ts` - Content comparison logic
- `lib/review/ReviewShortcuts.ts` - Keyboard shortcut handler
- `hooks/useReviewWorkflow.ts` - Review workflow hook
- `types/review.types.ts` - Review TypeScript types

## Acceptance Criteria

- [ ] Keyboard shortcuts for all actions
- [ ] Auto-advance after approval
- [ ] Inline editing capability
- [ ] Side-by-side comparison view
- [ ] Bulk approval/rejection
- [ ] Review time tracking
- [ ] Auto-fix common issues
- [ ] Analytics dashboard functional

## Performance Targets

- Review action: < 200ms
- Content switching: < 100ms
- Inline edit save: < 500ms
- Comparison calculation: < 1s
- Support 100+ items in queue

## Testing Requirements

- [ ] Test keyboard shortcuts
- [ ] Test auto-advance logic
- [ ] Test inline editing
- [ ] Test comparison accuracy
- [ ] Test bulk operations
- [ ] Test analytics calculations
- [ ] Test auto-fix functionality
- [ ] Cross-browser compatibility

## Definition of Done

- [ ] Code complete and committed
- [ ] All review modes working
- [ ] Keyboard shortcuts functional
- [ ] Comparison view accurate
- [ ] Analytics tracking active
- [ ] Performance targets met
- [ ] Tests written and passing
- [ ] Documentation complete
- [ ] Peer review completed
