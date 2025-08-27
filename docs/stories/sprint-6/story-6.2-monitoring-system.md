# Story 6.2: Production Monitoring System

## User Story
As a system administrator,
I want comprehensive monitoring of the production system,
So that I can proactively identify and resolve issues before they impact users.

## Size & Priority
- **Size**: M (6 hours)
- **Priority**: P0 - Critical
- **Sprint**: 6
- **Dependencies**: Task 6.1

## Description
Implement a comprehensive monitoring system with real-time metrics, logging aggregation, error tracking, performance monitoring, and alerting capabilities across all system components.

## Implementation Steps

1. **Application performance monitoring**
   ```typescript
   // lib/monitoring/apm.ts
   import { trace, context, SpanStatusCode } from '@opentelemetry/api';
   import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
   import { Resource } from '@opentelemetry/resources';
   import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
   
   class ApplicationPerformanceMonitor {
     private tracer: Tracer;
     private metrics: MetricsCollector;
     
     constructor() {
       this.initializeTracing();
       this.metrics = new MetricsCollector();
     }
     
     private initializeTracing() {
       const provider = new NodeTracerProvider({
         resource: new Resource({
           [SemanticResourceAttributes.SERVICE_NAME]: 'contentmax',
           [SemanticResourceAttributes.SERVICE_VERSION]: process.env.VERSION,
           [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV
         })
       });
       
       // Add exporters
       provider.addSpanProcessor(new BatchSpanProcessor(new OTLPTraceExporter({
         url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT
       })));
       
       provider.register();
       this.tracer = trace.getTracer('contentmax');
     }
     
     // Trace async operations
     async traceAsync<T>(
       name: string,
       operation: () => Promise<T>,
       attributes?: Record<string, any>
     ): Promise<T> {
       const span = this.tracer.startSpan(name, { attributes });
       
       try {
         const result = await operation();
         span.setStatus({ code: SpanStatusCode.OK });
         return result;
       } catch (error) {
         span.recordException(error as Error);
         span.setStatus({
           code: SpanStatusCode.ERROR,
           message: error.message
         });
         throw error;
       } finally {
         span.end();
       }
     }
     
     // Track API endpoints
     trackEndpoint(endpoint: string, method: string) {
       return async (req: Request, res: Response, next: NextFunction) => {
         const span = this.tracer.startSpan(`${method} ${endpoint}`, {
           attributes: {
             'http.method': method,
             'http.url': endpoint,
             'http.target': req.path,
             'http.host': req.hostname,
             'user.id': req.user?.id
           }
         });
         
         const startTime = Date.now();
         
         // Track response
         const originalSend = res.send;
         res.send = function(data) {
           span.setAttributes({
             'http.status_code': res.statusCode,
             'http.response_time': Date.now() - startTime
           });
           
           // Record metrics
           this.metrics.record('api.requests', {
             endpoint,
             method,
             status: res.statusCode,
             duration: Date.now() - startTime
           });
           
           span.end();
           return originalSend.call(this, data);
         };
         
         context.with(trace.setSpan(context.active(), span), () => {
           next();
         });
       };
     }
     
     // Track database queries
     trackDatabaseQuery(query: string, params?: any[]) {
       const span = this.tracer.startSpan('db.query', {
         attributes: {
           'db.system': 'postgresql',
           'db.statement': query.substring(0, 100),
           'db.operation': query.split(' ')[0].toUpperCase()
         }
       });
       
       return {
         end: (error?: Error) => {
           if (error) {
             span.recordException(error);
             span.setStatus({ code: SpanStatusCode.ERROR });
           }
           span.end();
         }
       };
     }
     
     // Track external API calls
     trackExternalAPI(service: string, endpoint: string) {
       return this.tracer.startSpan(`external.${service}`, {
         attributes: {
           'http.url': endpoint,
           'peer.service': service
         }
       });
     }
   }
   ```

2. **Metrics collection and aggregation**
   ```typescript
   // lib/monitoring/metrics.ts
   import { MeterProvider } from '@opentelemetry/sdk-metrics';
   import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
   
   interface Metric {
     name: string;
     value: number;
     labels: Record<string, string>;
     timestamp: Date;
   }
   
   class MetricsCollector {
     private meter: Meter;
     private counters = new Map<string, Counter>();
     private histograms = new Map<string, Histogram>();
     private gauges = new Map<string, ObservableGauge>();
     private buffer: Metric[] = [];
     
     constructor() {
       this.initializeMetrics();
       this.startPeriodicFlush();
     }
     
     private initializeMetrics() {
       const meterProvider = new MeterProvider({
         exporter: new PrometheusExporter({
           port: 9090,
           endpoint: '/metrics'
         })
       });
       
       this.meter = meterProvider.getMeter('contentmax');
       this.registerDefaultMetrics();
     }
     
     private registerDefaultMetrics() {
       // Request counter
       this.counters.set('requests_total', this.meter.createCounter('requests_total', {
         description: 'Total number of requests'
       }));
       
       // Response time histogram
       this.histograms.set('response_time', this.meter.createHistogram('response_time', {
         description: 'Response time in milliseconds',
         unit: 'ms'
       }));
       
       // Active users gauge
       this.gauges.set('active_users', this.meter.createObservableGauge('active_users', {
         description: 'Number of active users'
       }));
       
       // Content generation metrics
       this.counters.set('content_generated', this.meter.createCounter('content_generated', {
         description: 'Total content pieces generated'
       }));
       
       this.histograms.set('generation_time', this.meter.createHistogram('generation_time', {
         description: 'Content generation time',
         unit: 's'
       }));
       
       // System metrics
       this.gauges.set('memory_usage', this.meter.createObservableGauge('memory_usage', {
         description: 'Memory usage in MB'
       }, async (observableResult) => {
         const usage = process.memoryUsage();
         observableResult.observe(usage.heapUsed / 1024 / 1024, { type: 'heap' });
         observableResult.observe(usage.rss / 1024 / 1024, { type: 'rss' });
       }));
       
       this.gauges.set('cpu_usage', this.meter.createObservableGauge('cpu_usage', {
         description: 'CPU usage percentage'
       }, async (observableResult) => {
         const usage = await this.getCPUUsage();
         observableResult.observe(usage);
       }));
     }
     
     record(metricName: string, data: any) {
       const metric: Metric = {
         name: metricName,
         value: data.value || 1,
         labels: data.labels || {},
         timestamp: new Date()
       };
       
       this.buffer.push(metric);
       
       // Update appropriate metric type
       if (this.counters.has(metricName)) {
         this.counters.get(metricName)!.add(metric.value, metric.labels);
       } else if (this.histograms.has(metricName)) {
         this.histograms.get(metricName)!.record(metric.value, metric.labels);
       }
       
       // Check for anomalies
       this.checkForAnomalies(metric);
     }
     
     private checkForAnomalies(metric: Metric) {
       // Simple anomaly detection
       const history = this.getMetricHistory(metric.name);
       const mean = this.calculateMean(history);
       const stdDev = this.calculateStdDev(history, mean);
       
       // Alert if value is more than 3 standard deviations from mean
       if (Math.abs(metric.value - mean) > 3 * stdDev) {
         this.triggerAnomaly({
           metric: metric.name,
           value: metric.value,
           expected: mean,
           deviation: (metric.value - mean) / stdDev
         });
       }
     }
     
     private async getCPUUsage(): Promise<number> {
       const cpus = os.cpus();
       const total = cpus.reduce((acc, cpu) => {
         const times = cpu.times;
         return acc + times.user + times.nice + times.sys + times.idle + times.irq;
       }, 0);
       
       const idle = cpus.reduce((acc, cpu) => acc + cpu.times.idle, 0);
       return ((total - idle) / total) * 100;
     }
     
     async getMetricsSummary(period: string): Promise<MetricsSummary> {
       const endTime = new Date();
       const startTime = this.getStartTime(period);
       
       const metrics = this.buffer.filter(
         m => m.timestamp >= startTime && m.timestamp <= endTime
       );
       
       return {
         period,
         requests: this.summarizeMetric(metrics, 'requests_total'),
         responseTime: this.summarizeMetric(metrics, 'response_time'),
         errorRate: this.calculateErrorRate(metrics),
         contentGenerated: this.summarizeMetric(metrics, 'content_generated'),
         activeUsers: this.getLatestValue(metrics, 'active_users'),
         systemHealth: this.calculateSystemHealth(metrics)
       };
     }
   }
   ```

3. **Error tracking and logging**
   ```typescript
   // lib/monitoring/error-tracker.ts
   import * as Sentry from '@sentry/nextjs';
   import winston from 'winston';
   import { ElasticsearchTransport } from 'winston-elasticsearch';
   
   class ErrorTracker {
     private logger: winston.Logger;
     private errorBuffer: ErrorEvent[] = [];
     
     constructor() {
       this.initializeSentry();
       this.initializeLogger();
     }
     
     private initializeSentry() {
       Sentry.init({
         dsn: process.env.SENTRY_DSN,
         environment: process.env.NODE_ENV,
         tracesSampleRate: 0.1,
         integrations: [
           new Sentry.Integrations.Http({ tracing: true }),
           new Sentry.Integrations.Postgres(),
           new Sentry.BrowserTracing()
         ],
         beforeSend: (event, hint) => {
           // Add custom context
           event.extra = {
             ...event.extra,
             serverTime: new Date().toISOString(),
             memoryUsage: process.memoryUsage()
           };
           
           // Filter sensitive data
           if (event.request) {
             delete event.request.cookies;
             delete event.request.headers?.authorization;
           }
           
           return event;
         }
       });
     }
     
     private initializeLogger() {
       const esTransport = new ElasticsearchTransport({
         level: 'info',
         clientOpts: {
           node: process.env.ELASTICSEARCH_URL,
           auth: {
             username: process.env.ELASTICSEARCH_USERNAME,
             password: process.env.ELASTICSEARCH_PASSWORD
           }
         },
         index: 'contentmax-logs'
       });
       
       this.logger = winston.createLogger({
         level: process.env.LOG_LEVEL || 'info',
         format: winston.format.combine(
           winston.format.timestamp(),
           winston.format.errors({ stack: true }),
           winston.format.json()
         ),
         defaultMeta: {
           service: 'contentmax',
           version: process.env.VERSION,
           environment: process.env.NODE_ENV
         },
         transports: [
           new winston.transports.Console({
             format: winston.format.combine(
               winston.format.colorize(),
               winston.format.simple()
             )
           }),
           new winston.transports.File({
             filename: 'logs/error.log',
             level: 'error'
           }),
           new winston.transports.File({
             filename: 'logs/combined.log'
           }),
           esTransport
         ]
       });
     }
     
     captureError(error: Error, context?: any) {
       // Send to Sentry
       const eventId = Sentry.captureException(error, {
         contexts: {
           custom: context
         }
       });
       
       // Log error
       this.logger.error('Error captured', {
         error: {
           message: error.message,
           stack: error.stack,
           name: error.name
         },
         context,
         eventId
       });
       
       // Add to buffer for analysis
       this.errorBuffer.push({
         timestamp: new Date(),
         error,
         context,
         eventId
       });
       
       // Check for error patterns
       this.analyzeErrorPatterns();
       
       return eventId;
     }
     
     private analyzeErrorPatterns() {
       const recentErrors = this.errorBuffer.filter(
         e => Date.now() - e.timestamp.getTime() < 300000 // Last 5 minutes
       );
       
       // Group errors by type
       const errorGroups = new Map<string, ErrorEvent[]>();
       recentErrors.forEach(e => {
         const key = e.error.name || 'Unknown';
         if (!errorGroups.has(key)) {
           errorGroups.set(key, []);
         }
         errorGroups.get(key)!.push(e);
       });
       
       // Check for error spikes
       errorGroups.forEach((errors, type) => {
         if (errors.length > 10) {
           this.triggerErrorSpike({
             type,
             count: errors.length,
             sample: errors[0],
             period: '5 minutes'
           });
         }
       });
       
       // Check for new error types
       const newErrorTypes = this.identifyNewErrorTypes(errorGroups);
       if (newErrorTypes.length > 0) {
         this.notifyNewErrorTypes(newErrorTypes);
       }
     }
     
     logActivity(level: string, message: string, meta?: any) {
       this.logger.log(level, message, meta);
       
       // Track important events
       if (level === 'error' || level === 'warn') {
         this.trackEvent({
           level,
           message,
           meta,
           timestamp: new Date()
         });
       }
     }
     
     async searchLogs(query: LogQuery): Promise<LogEntry[]> {
       const response = await fetch(`${process.env.ELASTICSEARCH_URL}/contentmax-logs/_search`, {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json',
           Authorization: `Basic ${Buffer.from(
             `${process.env.ELASTICSEARCH_USERNAME}:${process.env.ELASTICSEARCH_PASSWORD}`
           ).toString('base64')}`
         },
         body: JSON.stringify({
           query: {
             bool: {
               must: [
                 { range: { timestamp: { gte: query.startTime, lte: query.endTime } } },
                 ...(query.level ? [{ term: { level: query.level } }] : []),
                 ...(query.searchText ? [{ match: { message: query.searchText } }] : [])
               ]
             }
           },
           size: query.limit || 100,
           sort: [{ timestamp: 'desc' }]
         })
       });
       
       const data = await response.json();
       return data.hits.hits.map(hit => hit._source);
     }
   }
   ```

4. **Real-time dashboard**
   ```tsx
   // components/monitoring/MonitoringDashboard.tsx
   const MonitoringDashboard: React.FC = () => {
     const [metrics, setMetrics] = useState<SystemMetrics>();
     const [alerts, setAlerts] = useState<Alert[]>([]);
     const [logs, setLogs] = useState<LogEntry[]>([]);
     const [timeRange, setTimeRange] = useState('1h');
     
     useEffect(() => {
       // Connect to real-time metrics
       const ws = new WebSocket(process.env.NEXT_PUBLIC_METRICS_WS_URL!);
       
       ws.onmessage = (event) => {
         const data = JSON.parse(event.data);
         
         switch (data.type) {
           case 'metrics':
             setMetrics(data.metrics);
             break;
           case 'alert':
             setAlerts(prev => [data.alert, ...prev].slice(0, 50));
             break;
           case 'log':
             setLogs(prev => [data.log, ...prev].slice(0, 100));
             break;
         }
       };
       
       // Load initial data
       loadDashboardData();
       
       return () => ws.close();
     }, [timeRange]);
     
     return (
       <div className="monitoring-dashboard">
         <DashboardHeader
           timeRange={timeRange}
           onTimeRangeChange={setTimeRange}
           alerts={alerts.filter(a => a.severity === 'critical')}
         />
         
         <div className="metrics-grid">
           <SystemHealthCard health={metrics?.systemHealth} />
           
           <MetricCard
             title="Requests/sec"
             value={metrics?.requestsPerSecond || 0}
             sparkline={metrics?.requestHistory}
             threshold={{ warning: 1000, critical: 2000 }}
           />
           
           <MetricCard
             title="Avg Response Time"
             value={`${metrics?.avgResponseTime || 0}ms`}
             sparkline={metrics?.responseTimeHistory}
             threshold={{ warning: 500, critical: 1000 }}
           />
           
           <MetricCard
             title="Error Rate"
             value={`${metrics?.errorRate || 0}%`}
             sparkline={metrics?.errorRateHistory}
             threshold={{ warning: 1, critical: 5 }}
             inverse={true}
           />
           
           <MetricCard
             title="Active Users"
             value={metrics?.activeUsers || 0}
             sparkline={metrics?.userHistory}
           />
           
           <MetricCard
             title="CPU Usage"
             value={`${metrics?.cpuUsage || 0}%`}
             sparkline={metrics?.cpuHistory}
             threshold={{ warning: 70, critical: 90 }}
           />
           
           <MetricCard
             title="Memory Usage"
             value={`${metrics?.memoryUsage || 0}%`}
             sparkline={metrics?.memoryHistory}
             threshold={{ warning: 80, critical: 95 }}
           />
           
           <MetricCard
             title="Database Connections"
             value={`${metrics?.dbConnections || 0}/${metrics?.maxDbConnections || 100}`}
             sparkline={metrics?.dbConnectionHistory}
           />
         </div>
         
         <div className="monitoring-sections">
           <ServiceStatusGrid services={metrics?.services} />
           
           <AlertsList
             alerts={alerts}
             onAcknowledge={(id) => acknowledgeAlert(id)}
           />
           
           <LogViewer
             logs={logs}
             onSearch={(query) => searchLogs(query)}
           />
           
           <PerformanceTraces
             traces={metrics?.recentTraces}
             onViewTrace={(id) => viewTraceDetails(id)}
           />
         </div>
       </div>
     );
   };
   ```

5. **Alert management**
   ```typescript
   // lib/monitoring/alert-manager.ts
   class AlertManager {
     private rules: AlertRule[] = [];
     private activeAlerts = new Map<string, Alert>();
     private notificationChannels: NotificationChannel[] = [];
     
     constructor() {
       this.loadAlertRules();
       this.setupNotificationChannels();
       this.startMonitoring();
     }
     
     private loadAlertRules() {
       this.rules = [
         {
           id: 'high-error-rate',
           name: 'High Error Rate',
           condition: (metrics) => metrics.errorRate > 5,
           severity: 'critical',
           cooldown: 300000 // 5 minutes
         },
         {
           id: 'slow-response',
           name: 'Slow Response Time',
           condition: (metrics) => metrics.avgResponseTime > 1000,
           severity: 'warning',
           cooldown: 600000 // 10 minutes
         },
         {
           id: 'memory-leak',
           name: 'Potential Memory Leak',
           condition: (metrics) => {
             const trend = this.calculateTrend(metrics.memoryHistory);
             return trend > 0.1 && metrics.memoryUsage > 80;
           },
           severity: 'warning',
           cooldown: 1800000 // 30 minutes
         },
         {
           id: 'database-connection-pool',
           name: 'Database Connection Pool Exhausted',
           condition: (metrics) => metrics.dbConnections >= metrics.maxDbConnections * 0.9,
           severity: 'critical',
           cooldown: 300000
         },
         {
           id: 'api-rate-limit',
           name: 'API Rate Limit Approaching',
           condition: (metrics) => metrics.apiUsage >= metrics.apiLimit * 0.8,
           severity: 'warning',
           cooldown: 900000 // 15 minutes
         }
       ];
     }
     
     private setupNotificationChannels() {
       this.notificationChannels = [
         new SlackNotification({
           webhook: process.env.SLACK_WEBHOOK_URL,
           channel: '#alerts'
         }),
         new EmailNotification({
           smtp: process.env.SMTP_CONFIG,
           recipients: ['ops@contentmax.app']
         }),
         new PagerDutyNotification({
           apiKey: process.env.PAGERDUTY_API_KEY,
           serviceId: process.env.PAGERDUTY_SERVICE_ID
         })
       ];
     }
     
     private startMonitoring() {
       setInterval(async () => {
         const metrics = await this.collectMetrics();
         this.evaluateRules(metrics);
       }, 30000); // Check every 30 seconds
     }
     
     private evaluateRules(metrics: SystemMetrics) {
       this.rules.forEach(rule => {
         const shouldAlert = rule.condition(metrics);
         const existingAlert = this.activeAlerts.get(rule.id);
         
         if (shouldAlert && !existingAlert) {
           this.triggerAlert(rule, metrics);
         } else if (!shouldAlert && existingAlert) {
           this.resolveAlert(rule.id);
         }
       });
     }
     
     private async triggerAlert(rule: AlertRule, metrics: SystemMetrics) {
       const alert: Alert = {
         id: generateId(),
         ruleId: rule.id,
         name: rule.name,
         severity: rule.severity,
         triggeredAt: new Date(),
         metrics: this.extractRelevantMetrics(metrics, rule),
         status: 'active'
       };
       
       this.activeAlerts.set(rule.id, alert);
       
       // Send notifications based on severity
       await this.sendNotifications(alert);
       
       // Log alert
       logger.warn('Alert triggered', alert);
       
       // Store in database
       await this.storeAlert(alert);
     }
     
     private async sendNotifications(alert: Alert) {
       const channels = this.notificationChannels.filter(channel => {
         if (alert.severity === 'critical') return true;
         if (alert.severity === 'warning' && channel.supportsWarnings) return true;
         return false;
       });
       
       await Promise.all(
         channels.map(channel => channel.send(alert))
       );
     }
   }
   ```

## Files to Create

- `lib/monitoring/apm.ts` - Application performance monitoring
- `lib/monitoring/metrics.ts` - Metrics collection
- `lib/monitoring/error-tracker.ts` - Error tracking
- `lib/monitoring/alert-manager.ts` - Alert management
- `lib/monitoring/log-aggregator.ts` - Log aggregation
- `components/monitoring/MonitoringDashboard.tsx` - Dashboard UI
- `components/monitoring/AlertsList.tsx` - Alerts display
- `components/monitoring/MetricsChart.tsx` - Metrics visualization
- `api/monitoring/health.ts` - Health check endpoints

## Acceptance Criteria

- [ ] Real-time metrics collection
- [ ] Error tracking with Sentry
- [ ] Log aggregation with Elasticsearch
- [ ] Custom alerts and thresholds
- [ ] Performance tracing
- [ ] Dashboard with live updates
- [ ] Notification integrations
- [ ] Historical data retention

## Monitoring Metrics

- Response time (p50, p95, p99)
- Request rate
- Error rate
- CPU and memory usage
- Database connection pool
- API rate limits
- Content generation metrics
- User activity

## Testing Requirements

- [ ] Test metric collection accuracy
- [ ] Test alert trigger conditions
- [ ] Test notification delivery
- [ ] Test dashboard real-time updates
- [ ] Test log search functionality
- [ ] Load test monitoring system
- [ ] Test data retention policies

## Definition of Done

- [ ] Code complete and committed
- [ ] Monitoring operational
- [ ] Dashboard functional
- [ ] Alerts configured
- [ ] Notifications working
- [ ] Documentation complete
- [ ] Team trained on dashboard
- [ ] Runbook created