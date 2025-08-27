# Story 5.5: Review Analytics Dashboard

## User Story

As a content operations manager,
I want comprehensive analytics on content review performance,
So that I can optimize our review process and identify bottlenecks.

## Size & Priority

- **Size**: M (4 hours)
- **Priority**: P1 - High
- **Sprint**: 5
- **Dependencies**: Task 5.4

## Description

Build a comprehensive analytics dashboard for tracking review performance, identifying patterns, measuring team efficiency, and providing actionable insights to optimize the content review workflow.

## Implementation Steps

1. **Analytics data collection**

   ```typescript
   interface ReviewEvent {
     id: string;
     type: 'started' | 'completed' | 'approved' | 'rejected' | 'revised';
     contentId: string;
     contentType: string;
     reviewerId: string;
     timestamp: Date;
     duration?: number;
     metadata?: {
       editsM-v made?: number;
       issuesFound?: string[];
       autoFixed?: boolean;
       bulkAction?: boolean;
       revisionRequested?: boolean;
     };
   }

   class ReviewAnalyticsCollector {
     private events: ReviewEvent[] = [];
     private sessions = new Map<string, ReviewSession>();
     private storage: AnalyticsStorage;

     constructor() {
       this.storage = new AnalyticsStorage();
       this.startPeriodicFlush();
     }

     startReview(contentId: string, reviewerId: string) {
       const sessionId = generateSessionId();
       const session: ReviewSession = {
         id: sessionId,
         contentId,
         reviewerId,
         startTime: Date.now(),
         events: []
       };

       this.sessions.set(sessionId, session);

       this.recordEvent({
         type: 'started',
         contentId,
         reviewerId,
         timestamp: new Date()
       });

       return sessionId;
     }

     completeReview(
       sessionId: string,
       decision: 'approved' | 'rejected' | 'revised',
       metadata?: any
     ) {
       const session = this.sessions.get(sessionId);
       if (!session) return;

       const duration = Date.now() - session.startTime;

       this.recordEvent({
         type: 'completed',
         contentId: session.contentId,
         reviewerId: session.reviewerId,
         timestamp: new Date(),
         duration,
         metadata: {
           decision,
           ...metadata
         }
       });

       this.recordEvent({
         type: decision,
         contentId: session.contentId,
         reviewerId: session.reviewerId,
         timestamp: new Date()
       });

       // Store session data
       this.storage.storeSession({
         ...session,
         endTime: Date.now(),
         duration,
         decision,
         metadata
       });

       this.sessions.delete(sessionId);
     }

     recordEvent(event: Partial<ReviewEvent>) {
       const fullEvent: ReviewEvent = {
         id: generateId(),
         ...event,
         timestamp: event.timestamp || new Date()
       } as ReviewEvent;

       this.events.push(fullEvent);

       // Real-time analytics update
       this.updateRealTimeMetrics(fullEvent);
     }

     private updateRealTimeMetrics(event: ReviewEvent) {
       // Update live dashboard metrics
       switch (event.type) {
         case 'completed':
           this.updateCompletionMetrics(event);
           break;
         case 'approved':
           this.updateApprovalRate(event);
           break;
         case 'rejected':
           this.updateRejectionReasons(event);
           break;
       }
     }

     private startPeriodicFlush() {
       setInterval(() => {
         this.flushEvents();
       }, 30000); // Flush every 30 seconds
     }

     private async flushEvents() {
       if (this.events.length === 0) return;

       const eventsToFlush = [...this.events];
       this.events = [];

       await this.storage.batchStore(eventsToFlush);
     }

     async getMetrics(timeRange: TimeRange): Promise<ReviewMetrics> {
       const events = await this.storage.getEvents(timeRange);

       return {
         totalReviews: this.calculateTotalReviews(events),
         approvalRate: this.calculateApprovalRate(events),
         averageReviewTime: this.calculateAverageTime(events),
         throughput: this.calculateThroughput(events),
         reviewerPerformance: this.calculateReviewerPerformance(events),
         contentTypeBreakdown: this.calculateContentTypeBreakdown(events),
         timeDistribution: this.calculateTimeDistribution(events),
         issuePatterns: this.identifyIssuePatterns(events)
       };
     }

     private calculateThroughput(events: ReviewEvent[]): number {
       const completed = events.filter(e => e.type === 'completed');
       const timeSpan = this.getTimeSpan(events);
       const hours = timeSpan / (1000 * 60 * 60);

       return completed.length / hours;
     }

     private identifyIssuePatterns(events: ReviewEvent[]): IssuePattern[] {
       const issues = new Map<string, number>();

       events.forEach(event => {
         if (event.metadata?.issuesFound) {
           event.metadata.issuesFound.forEach(issue => {
             issues.set(issue, (issues.get(issue) || 0) + 1);
           });
         }
       });

       return Array.from(issues.entries())
         .map(([issue, count]) => ({ issue, count, percentage: 0 }))
         .sort((a, b) => b.count - a.count);
     }
   }
   ```

2. **Performance metrics calculator**

   ```typescript
   class PerformanceMetricsCalculator {
     calculateReviewerMetrics(events: ReviewEvent[], reviewerId: string): ReviewerMetrics {
       const reviewerEvents = events.filter((e) => e.reviewerId === reviewerId);

       const completed = reviewerEvents.filter((e) => e.type === 'completed');
       const approved = reviewerEvents.filter((e) => e.type === 'approved');
       const rejected = reviewerEvents.filter((e) => e.type === 'rejected');

       const totalTime = completed.reduce((sum, e) => sum + (e.duration || 0), 0);
       const avgTime = completed.length > 0 ? totalTime / completed.length : 0;

       // Calculate consistency score
       const times = completed.map((e) => e.duration || 0);
       const consistency = this.calculateConsistency(times);

       // Calculate quality score
       const quality = this.calculateQualityScore(reviewerEvents);

       // Calculate efficiency trend
       const trend = this.calculateEfficiencyTrend(completed);

       return {
         reviewerId,
         totalReviews: completed.length,
         approvalRate: (approved.length / completed.length) * 100,
         averageTime: avgTime,
         consistency,
         quality,
         trend,
         fastestReview: Math.min(...times),
         slowestReview: Math.max(...times),
         medianTime: this.calculateMedian(times),
       };
     }

     private calculateConsistency(times: number[]): number {
       if (times.length < 2) return 100;

       const mean = times.reduce((a, b) => a + b, 0) / times.length;
       const variance =
         times.reduce((sum, time) => {
           return sum + Math.pow(time - mean, 2);
         }, 0) / times.length;

       const stdDev = Math.sqrt(variance);
       const coefficientOfVariation = (stdDev / mean) * 100;

       // Lower CV means higher consistency
       return Math.max(0, 100 - coefficientOfVariation);
     }

     private calculateQualityScore(events: ReviewEvent[]): number {
       let score = 100;

       // Deduct points for revisions requested
       const revisions = events.filter((e) => e.type === 'revised');
       score -= revisions.length * 5;

       // Deduct points for issues that weren't auto-fixed
       const manualFixes = events.filter((e) => e.metadata?.issuesFound && !e.metadata?.autoFixed);
       score -= manualFixes.length * 2;

       // Add points for thoroughness (finding issues)
       const issuesFound = events.filter((e) => e.metadata?.issuesFound?.length > 0);
       score += issuesFound.length * 1;

       return Math.max(0, Math.min(100, score));
     }

     private calculateEfficiencyTrend(events: ReviewEvent[]): 'improving' | 'stable' | 'declining' {
       if (events.length < 10) return 'stable';

       // Split into first half and second half
       const midpoint = Math.floor(events.length / 2);
       const firstHalf = events.slice(0, midpoint);
       const secondHalf = events.slice(midpoint);

       const firstAvg = this.averageDuration(firstHalf);
       const secondAvg = this.averageDuration(secondHalf);

       const change = ((firstAvg - secondAvg) / firstAvg) * 100;

       if (change > 10) return 'improving';
       if (change < -10) return 'declining';
       return 'stable';
     }

     calculateContentTypeMetrics(events: ReviewEvent[]): ContentTypeMetrics[] {
       const byType = new Map<string, ReviewEvent[]>();

       events.forEach((event) => {
         const type = event.contentType;
         if (!byType.has(type)) {
           byType.set(type, []);
         }
         byType.get(type)!.push(event);
       });

       return Array.from(byType.entries()).map(([type, typeEvents]) => {
         const completed = typeEvents.filter((e) => e.type === 'completed');
         const approved = typeEvents.filter((e) => e.type === 'approved');

         return {
           contentType: type,
           count: completed.length,
           approvalRate: (approved.length / completed.length) * 100,
           averageTime: this.averageDuration(completed),
           complexity: this.calculateComplexity(typeEvents),
         };
       });
     }

     private calculateComplexity(events: ReviewEvent[]): 'low' | 'medium' | 'high' {
       const avgTime = this.averageDuration(events.filter((e) => e.type === 'completed'));
       const issueRate = this.calculateIssueRate(events);

       const complexityScore = (avgTime / 60000) * 0.5 + issueRate * 0.5;

       if (complexityScore < 0.3) return 'low';
       if (complexityScore < 0.7) return 'medium';
       return 'high';
     }
   }
   ```

3. **Analytics dashboard component**

   ```tsx
   const ReviewAnalyticsDashboard: React.FC = () => {
     const [timeRange, setTimeRange] = useState<TimeRange>('last7days');
     const [metrics, setMetrics] = useState<ReviewMetrics>();
     const [selectedReviewer, setSelectedReviewer] = useState<string | null>(null);
     const [loading, setLoading] = useState(true);

     useEffect(() => {
       loadMetrics();
     }, [timeRange]);

     const loadMetrics = async () => {
       setLoading(true);
       const collector = new ReviewAnalyticsCollector();
       const data = await collector.getMetrics(timeRange);
       setMetrics(data);
       setLoading(false);
     };

     if (loading) return <LoadingSpinner />;

     return (
       <div className="analytics-dashboard">
         <DashboardHeader
           title="Review Analytics"
           timeRange={timeRange}
           onTimeRangeChange={setTimeRange}
         />

         <div className="metrics-overview">
           <MetricCard
             title="Total Reviews"
             value={metrics?.totalReviews || 0}
             trend={metrics?.reviewTrend}
             sparkline={metrics?.reviewHistory}
           />
           <MetricCard
             title="Approval Rate"
             value={`${metrics?.approvalRate.toFixed(1)}%`}
             trend={metrics?.approvalTrend}
             color={getApprovalRateColor(metrics?.approvalRate)}
           />
           <MetricCard
             title="Avg Review Time"
             value={formatDuration(metrics?.averageReviewTime || 0)}
             trend={metrics?.timeTrend}
             target="< 5 min"
           />
           <MetricCard
             title="Throughput"
             value={`${metrics?.throughput.toFixed(1)}/hr`}
             trend={metrics?.throughputTrend}
             icon="lightning"
           />
         </div>

         <div className="dashboard-grid">
           <div className="chart-section">
             <ChartCard title="Review Volume Over Time">
               <AreaChart
                 data={metrics?.timeDistribution}
                 xKey="date"
                 yKey="count"
                 color="#3b82f6"
                 height={250}
               />
             </ChartCard>
           </div>

           <div className="chart-section">
             <ChartCard title="Decision Distribution">
               <DonutChart
                 data={[
                   { name: 'Approved', value: metrics?.approvedCount || 0, color: '#10b981' },
                   { name: 'Rejected', value: metrics?.rejectedCount || 0, color: '#ef4444' },
                   { name: 'Revised', value: metrics?.revisedCount || 0, color: '#f59e0b' },
                 ]}
                 height={250}
               />
             </ChartCard>
           </div>

           <div className="chart-section full-width">
             <ChartCard title="Content Type Performance">
               <BarChart
                 data={metrics?.contentTypeBreakdown}
                 xKey="contentType"
                 yKeys={['count', 'averageTime']}
                 colors={['#6366f1', '#8b5cf6']}
                 height={250}
               />
             </ChartCard>
           </div>

           <div className="reviewer-performance">
             <h3>Reviewer Performance</h3>
             <ReviewerTable
               reviewers={metrics?.reviewerPerformance || []}
               onSelectReviewer={setSelectedReviewer}
             />
           </div>

           <div className="issue-patterns">
             <h3>Common Issues</h3>
             <IssuePatternList patterns={metrics?.issuePatterns || []} />
           </div>
         </div>

         {selectedReviewer && (
           <ReviewerDetailModal
             reviewerId={selectedReviewer}
             timeRange={timeRange}
             onClose={() => setSelectedReviewer(null)}
           />
         )}
       </div>
     );
   };
   ```

4. **Insights and recommendations engine**

   ```typescript
   class InsightsEngine {
     generateInsights(metrics: ReviewMetrics): Insight[] {
       const insights: Insight[] = [];

       // Bottleneck detection
       const bottleneck = this.detectBottleneck(metrics);
       if (bottleneck) {
         insights.push({
           type: 'warning',
           title: 'Review Bottleneck Detected',
           description: bottleneck.description,
           recommendation: bottleneck.recommendation,
           impact: 'high',
           metrics: bottleneck.metrics,
         });
       }

       // Efficiency opportunities
       const efficiencyOps = this.findEfficiencyOpportunities(metrics);
       efficiencyOps.forEach((op) => insights.push(op));

       // Quality concerns
       const qualityIssues = this.identifyQualityIssues(metrics);
       qualityIssues.forEach((issue) => insights.push(issue));

       // Positive trends
       const achievements = this.identifyAchievements(metrics);
       achievements.forEach((achievement) => insights.push(achievement));

       return insights.sort((a, b) => {
         const impactOrder = { high: 0, medium: 1, low: 2 };
         return impactOrder[a.impact] - impactOrder[b.impact];
       });
     }

     private detectBottleneck(metrics: ReviewMetrics): Bottleneck | null {
       // Check for growing queue
       if (metrics.queueGrowthRate > 0.2) {
         return {
           type: 'queue-growth',
           description: `Review queue growing at ${(metrics.queueGrowthRate * 100).toFixed(0)}% per day`,
           recommendation:
             'Consider adding reviewers or implementing auto-approval for low-risk content',
           metrics: {
             currentQueue: metrics.currentQueueSize,
             growthRate: metrics.queueGrowthRate,
             estimatedClearTime: metrics.estimatedClearTime,
           },
         };
       }

       // Check for reviewer imbalance
       const reviewerLoads = metrics.reviewerPerformance.map((r) => r.totalReviews);
       const maxLoad = Math.max(...reviewerLoads);
       const minLoad = Math.min(...reviewerLoads);

       if (maxLoad > minLoad * 3) {
         return {
           type: 'load-imbalance',
           description: 'Significant imbalance in reviewer workload',
           recommendation: 'Redistribute assignments or provide training to slower reviewers',
           metrics: {
             maxLoad,
             minLoad,
             averageLoad: reviewerLoads.reduce((a, b) => a + b, 0) / reviewerLoads.length,
           },
         };
       }

       return null;
     }

     private findEfficiencyOpportunities(metrics: ReviewMetrics): Insight[] {
       const opportunities: Insight[] = [];

       // Check for auto-approval candidates
       const highApprovalTypes = metrics.contentTypeBreakdown.filter(
         (type) => type.approvalRate > 95 && type.count > 20
       );

       if (highApprovalTypes.length > 0) {
         opportunities.push({
           type: 'success',
           title: 'Auto-approval Opportunity',
           description: `${highApprovalTypes.length} content types have >95% approval rate`,
           recommendation: `Consider auto-approving: ${highApprovalTypes.map((t) => t.contentType).join(', ')}`,
           impact: 'medium',
           potentialTimeSaving: this.estimateTimeSaving(highApprovalTypes),
         });
       }

       // Check for bulk action opportunities
       if (metrics.averageReviewTime < 30000 && metrics.bulkActionUsage < 0.1) {
         opportunities.push({
           type: 'info',
           title: 'Bulk Actions Underutilized',
           description: 'Quick reviews could benefit from bulk operations',
           recommendation: 'Train reviewers on bulk approval shortcuts',
           impact: 'low',
         });
       }

       return opportunities;
     }

     private identifyQualityIssues(metrics: ReviewMetrics): Insight[] {
       const issues: Insight[] = [];

       // Check for high revision rate
       if (metrics.revisionRate > 0.15) {
         issues.push({
           type: 'warning',
           title: 'High Revision Rate',
           description: `${(metrics.revisionRate * 100).toFixed(1)}% of content requires revision`,
           recommendation: 'Review generation prompts and consider additional quality checks',
           impact: 'high',
         });
       }

       // Check for rushed reviews
       const rushThreshold = 10000; // 10 seconds
       const rushedReviewers = metrics.reviewerPerformance.filter(
         (r) => r.medianTime < rushThreshold
       );

       if (rushedReviewers.length > 0) {
         issues.push({
           type: 'warning',
           title: 'Potentially Rushed Reviews',
           description: `${rushedReviewers.length} reviewers averaging <10 seconds per review`,
           recommendation: 'Audit quick approvals for quality concerns',
           impact: 'medium',
           affectedReviewers: rushedReviewers.map((r) => r.reviewerId),
         });
       }

       return issues;
     }
   }
   ```

5. **Real-time monitoring**
   ```tsx
   const RealTimeMonitor: React.FC = () => {
     const [liveMetrics, setLiveMetrics] = useState<LiveMetrics>();
     const [activeReviews, setActiveReviews] = useState<ActiveReview[]>([]);

     useEffect(() => {
       const ws = new WebSocket(process.env.NEXT_PUBLIC_WS_URL!);

       ws.onmessage = (event) => {
         const data = JSON.parse(event.data);

         switch (data.type) {
           case 'metrics-update':
             setLiveMetrics(data.metrics);
             break;
           case 'review-started':
             setActiveReviews((prev) => [...prev, data.review]);
             break;
           case 'review-completed':
             setActiveReviews((prev) => prev.filter((r) => r.id !== data.reviewId));
             break;
         }
       };

       return () => ws.close();
     }, []);

     return (
       <div className="realtime-monitor">
         <div className="live-metrics">
           <LiveMetric label="Active Reviews" value={activeReviews.length} pulse={true} />
           <LiveMetric
             label="Queue Size"
             value={liveMetrics?.queueSize || 0}
             trend={liveMetrics?.queueTrend}
           />
           <LiveMetric
             label="Current Throughput"
             value={`${liveMetrics?.currentThroughput || 0}/hr`}
           />
           <LiveMetric
             label="Avg Wait Time"
             value={formatDuration(liveMetrics?.avgWaitTime || 0)}
           />
         </div>

         <div className="active-reviews-list">
           <h4>Active Reviews</h4>
           {activeReviews.map((review) => (
             <ActiveReviewItem
               key={review.id}
               review={review}
               elapsed={Date.now() - review.startTime}
             />
           ))}
         </div>

         <div className="activity-feed">
           <h4>Recent Activity</h4>
           <ActivityFeed limit={20} />
         </div>
       </div>
     );
   };
   ```

## Files to Create

- `lib/analytics/ReviewAnalyticsCollector.ts` - Event collection
- `lib/analytics/PerformanceMetricsCalculator.ts` - Metrics calculation
- `lib/analytics/InsightsEngine.ts` - Insights generation
- `lib/analytics/AnalyticsStorage.ts` - Data persistence
- `components/analytics/ReviewAnalyticsDashboard.tsx` - Main dashboard
- `components/analytics/RealTimeMonitor.tsx` - Live monitoring
- `components/analytics/ReviewerPerformance.tsx` - Reviewer metrics
- `components/analytics/InsightsPanel.tsx` - Insights display
- `types/analytics.types.ts` - Analytics types

## Acceptance Criteria

- [ ] Real-time metrics collection
- [ ] Historical data analysis
- [ ] Reviewer performance tracking
- [ ] Issue pattern identification
- [ ] Bottleneck detection
- [ ] Actionable insights generation
- [ ] Time-based filtering
- [ ] Export capabilities

## Testing Requirements

- [ ] Test metric calculations
- [ ] Test event collection
- [ ] Test insight generation
- [ ] Test real-time updates
- [ ] Test data persistence
- [ ] Test chart rendering
- [ ] Test performance with large datasets
- [ ] Test export functionality

## Definition of Done

- [ ] Code complete and committed
- [ ] Analytics collection working
- [ ] Dashboard displaying metrics
- [ ] Insights being generated
- [ ] Real-time updates functional
- [ ] Tests written and passing
- [ ] Documentation complete
- [ ] Peer review completed
