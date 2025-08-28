'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { 
  CheckCircle, 
  AlertCircle, 
  XCircle, 
  FileText, 
  Globe, 
  Clock,
  TrendingUp,
  Download,
  RefreshCw
} from 'lucide-react';

interface ImportSummaryProps {
  summary: {
    id: string;
    totalUrls: number;
    successfulUrls: number;
    failedUrls: number;
    skippedUrls: number;
    categorizedUrls: {
      product: number;
      category: number;
      brand: number;
      blog: number;
      other: number;
    };
    contentScraped: number;
    duration: number;
    errors: Array<{
      url: string;
      message: string;
      type: 'error' | 'warning';
      retryable: boolean;
    }>;
    warnings: Array<{
      url: string;
      message: string;
    }>;
    nextSteps: string[];
  };
  onComplete: () => void;
  onRestart: () => void;
}

export default function ImportSummary({ summary, onComplete, onRestart }: ImportSummaryProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [isRetrying, setIsRetrying] = useState(false);

  const successRate = (summary.successfulUrls / summary.totalUrls) * 100;
  const hasErrors = summary.errors.length > 0;
  // const hasWarnings = summary.warnings.length > 0;

  const handleRetryErrors = async () => {
    setIsRetrying(true);
    try {
      const retryableErrors = summary.errors.filter(error => error.retryable);
      if (retryableErrors.length === 0) return;

      const response = await fetch(`/api/import/${summary.id}/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urls: retryableErrors.map(error => error.url),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to retry failed URLs');
      }

      // For now, just show a success message
      // In a real implementation, this might start a new import job
    } catch (error) {
      console.error('Retry failed:', error);
    } finally {
      setIsRetrying(false);
    }
  };

  const handleDownloadReport = () => {
    const report = {
      importId: summary.id,
      timestamp: new Date().toISOString(),
      summary: {
        totalUrls: summary.totalUrls,
        successfulUrls: summary.successfulUrls,
        failedUrls: summary.failedUrls,
        successRate: successRate.toFixed(2) + '%',
        duration: summary.duration,
      },
      categories: summary.categorizedUrls,
      errors: summary.errors,
      warnings: summary.warnings,
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `import-report-${summary.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="flex justify-center mb-4">
          {hasErrors ? (
            <AlertCircle className="h-16 w-16 text-orange-500" />
          ) : (
            <CheckCircle className="h-16 w-16 text-green-500" />
          )}
        </div>
        <h2 className="text-2xl font-semibold mb-2">
          Import {hasErrors ? 'Completed with Issues' : 'Completed Successfully'}
        </h2>
        <p className="text-gray-600">
          {hasErrors 
            ? `${summary.successfulUrls} of ${summary.totalUrls} URLs imported successfully`
            : `All ${summary.totalUrls} URLs imported successfully`
          }
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Globe className="h-5 w-5 text-blue-600" />
              Total URLs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{summary.totalUrls.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Success Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">
              {successRate.toFixed(1)}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-purple-600" />
              Content Scraped
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{summary.contentScraped.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-gray-600" />
              Duration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {Math.floor(summary.duration / 60)}m {summary.duration % 60}s
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="categories">
            Categories
            <Badge variant="secondary" className="ml-1">
              {Object.keys(summary.categorizedUrls).length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="errors">
            Issues
            <Badge variant={hasErrors ? 'destructive' : 'secondary'} className="ml-1">
              {summary.errors.length + summary.warnings.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="next-steps">Next Steps</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Import Results</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">{summary.successfulUrls}</p>
                  <p className="text-sm text-gray-600">Successful</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-600">{summary.failedUrls}</p>
                  <p className="text-sm text-gray-600">Failed</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-600">{summary.skippedUrls}</p>
                  <p className="text-sm text-gray-600">Skipped</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>URL Categories</CardTitle>
              <CardDescription>
                Breakdown of imported URLs by detected category
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(summary.categorizedUrls).map(([category, count]) => (
                  <div key={category} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                      <span className="capitalize font-medium">{category}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{count.toLocaleString()}</p>
                      <p className="text-xs text-gray-500">
                        {((count / summary.totalUrls) * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="errors" className="space-y-4">
          {summary.errors.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600">
                  <XCircle className="h-5 w-5" />
                  Errors ({summary.errors.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {summary.errors.map((error, index) => (
                    <Alert key={index} variant="destructive">
                      <AlertDescription>
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="font-medium truncate">{error.url}</p>
                            <p className="text-sm mt-1">{error.message}</p>
                          </div>
                          {error.retryable && (
                            <Badge variant="outline" className="ml-2">Retryable</Badge>
                          )}
                        </div>
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
                {summary.errors.some(e => e.retryable) && (
                  <div className="mt-4 pt-4 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRetryErrors}
                      disabled={isRetrying}
                    >
                      {isRetrying ? (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          Retrying...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Retry Failed Items
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {summary.warnings.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-600">
                  <AlertCircle className="h-5 w-5" />
                  Warnings ({summary.warnings.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {summary.warnings.map((warning, index) => (
                    <Alert key={index}>
                      <AlertDescription>
                        <p className="font-medium truncate">{warning.url}</p>
                        <p className="text-sm mt-1">{warning.message}</p>
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {summary.errors.length === 0 && summary.warnings.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center">
                <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-3" />
                <p className="text-lg font-medium">No Issues Found</p>
                <p className="text-gray-600">All URLs were imported successfully without any errors or warnings.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="next-steps" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Recommended Next Steps
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {summary.nextSteps.map((step, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full text-sm flex items-center justify-center">
                      {index + 1}
                    </span>
                    <p className="text-blue-900">{step}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDownloadReport}>
            <Download className="mr-2 h-4 w-4" />
            Download Report
          </Button>
          <Button variant="outline" onClick={onRestart}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Start New Import
          </Button>
        </div>
        <Button onClick={onComplete} size="lg">
          Go to Dashboard
        </Button>
      </div>
    </div>
  );
}