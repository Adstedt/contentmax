'use client';

import { useEffect, useState } from 'react';
import { Progress } from '@/components/ui/Progress';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import useImportProgress from '@/hooks/useImportProgress';
import { ImportSummary } from './ImportWizard';
import { 
  CheckCircle, 
  XCircle, 
  Loader2, 
  AlertTriangle,
  Clock,
  Link,
  FileText,
  Zap
} from 'lucide-react';

interface ProgressTrackerProps {
  importId: string;
  onComplete: (summary: ImportSummary) => void;
  onCancel: () => void;
}

interface ProgressStep {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  message?: string;
  progress?: number;
}

function ProgressTracker({ importId, onComplete, onCancel }: ProgressTrackerProps) {
  const { progress, error, isComplete } = useImportProgress(importId);
  const [steps, setSteps] = useState<ProgressStep[]>([
    { name: 'Fetching sitemap', status: 'running' },
    { name: 'Parsing URLs', status: 'pending' },
    { name: 'Categorizing URLs', status: 'pending' },
    { name: 'Processing URLs', status: 'pending' },
    { name: 'Building taxonomy', status: 'pending' },
    { name: 'Analyzing gaps', status: 'pending' },
    { name: 'Generating report', status: 'pending' },
  ]);

  useEffect(() => {
    if (!progress) return;

    const newSteps = [...steps];
    
    // Update step statuses based on progress
    if (progress.stage === 'fetching') {
      newSteps[0] = { ...newSteps[0], status: 'running', progress: progress.percentage };
    } else if (progress.stage === 'parsing') {
      newSteps[0] = { ...newSteps[0], status: 'completed' };
      newSteps[1] = { ...newSteps[1], status: 'running', progress: progress.percentage };
    } else if (progress.stage === 'categorizing') {
      newSteps[0] = { ...newSteps[0], status: 'completed' };
      newSteps[1] = { ...newSteps[1], status: 'completed' };
      newSteps[2] = { ...newSteps[2], status: 'running', progress: progress.percentage };
    } else if (progress.stage === 'processing') {
      newSteps[0] = { ...newSteps[0], status: 'completed' };
      newSteps[1] = { ...newSteps[1], status: 'completed' };
      newSteps[2] = { ...newSteps[2], status: 'completed' };
      newSteps[3] = { ...newSteps[3], status: 'running', progress: progress.percentage };
    } else if (progress.stage === 'building-taxonomy') {
      newSteps[0] = { ...newSteps[0], status: 'completed' };
      newSteps[1] = { ...newSteps[1], status: 'completed' };
      newSteps[2] = { ...newSteps[2], status: 'completed' };
      newSteps[3] = { ...newSteps[3], status: 'completed' };
      newSteps[4] = { ...newSteps[4], status: 'running', progress: progress.percentage };
    } else if (progress.stage === 'analyzing') {
      newSteps[0] = { ...newSteps[0], status: 'completed' };
      newSteps[1] = { ...newSteps[1], status: 'completed' };
      newSteps[2] = { ...newSteps[2], status: 'completed' };
      newSteps[3] = { ...newSteps[3], status: 'completed' };
      newSteps[4] = { ...newSteps[4], status: 'completed' };
      newSteps[5] = { ...newSteps[5], status: 'running', progress: progress.percentage };
    } else if (progress.stage === 'generating-report') {
      newSteps[0] = { ...newSteps[0], status: 'completed' };
      newSteps[1] = { ...newSteps[1], status: 'completed' };
      newSteps[2] = { ...newSteps[2], status: 'completed' };
      newSteps[3] = { ...newSteps[3], status: 'completed' };
      newSteps[4] = { ...newSteps[4], status: 'completed' };
      newSteps[5] = { ...newSteps[5], status: 'completed' };
      newSteps[6] = { ...newSteps[6], status: 'running', progress: progress.percentage };
    }

    setSteps(newSteps);
  }, [progress]);

  useEffect(() => {
    if (isComplete && progress?.summary) {
      // Add nextSteps if missing
      const summaryWithNextSteps: ImportSummary = {
        ...progress.summary,
        nextSteps: progress.summary.nextSteps || [
          'Review imported content for accuracy',
          'Check content gaps and missing pages',
          'Generate content for high-priority pages',
          'Set up automated content monitoring'
        ]
      };
      onComplete(summaryWithNextSteps);
    }
  }, [isComplete, progress, onComplete]);

  const getStepIcon = (status: ProgressStep['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'running':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <div className="w-5 h-5 rounded-full border-2 border-gray-300" />;
    }
  };

  const getProgressIcon = (stage?: string) => {
    switch (stage) {
      case 'fetching':
      case 'parsing':
        return <FileText className="w-5 h-5" />;
      case 'categorizing':
        return <Link className="w-5 h-5" />;
      case 'processing':
        return <Zap className="w-5 h-5" />;
      default:
        return <Loader2 className="w-5 h-5 animate-spin" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Overall Progress */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Import Progress</h3>
            <span className="text-2xl font-bold">
              {progress?.percentage || 0}%
            </span>
          </div>
          
          <Progress value={progress?.percentage || 0} className="h-2" />
          
          {progress?.message && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              {getProgressIcon(progress.stage)}
              <span>{progress.message}</span>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4 pt-4 border-t">
            <div className="text-center">
              <div className="text-2xl font-semibold">
                {progress?.processed || 0}
              </div>
              <div className="text-sm text-gray-500">Processed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-semibold">
                {progress?.total || 0}
              </div>
              <div className="text-sm text-gray-500">Total URLs</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-semibold flex items-center justify-center gap-1">
                <Clock className="w-4 h-4" />
                {progress?.estimatedTime ? `${Math.round(progress.estimatedTime / 60)}m` : '--'}
              </div>
              <div className="text-sm text-gray-500">Est. Time</div>
            </div>
          </div>
        </div>
      </Card>

      {/* Processing Steps */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Processing Steps</h3>
        <div className="space-y-3">
          {steps.map((step, index) => (
            <div
              key={index}
              className="flex items-center gap-3"
            >
              {getStepIcon(step.status)}
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${
                    step.status === 'completed' ? 'text-gray-600' :
                    step.status === 'running' ? 'font-semibold' :
                    'text-gray-400'
                  }`}>
                    {step.name}
                  </span>
                  {step.progress !== undefined && step.status === 'running' && (
                    <span className="text-sm text-gray-500">
                      {step.progress}%
                    </span>
                  )}
                </div>
                {step.message && (
                  <p className="text-xs text-gray-500 mt-1">{step.message}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Recent Activity */}
      {progress?.recentActivity && progress.recentActivity.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {progress.recentActivity.map((activity, index) => (
              <div
                key={index}
                className="flex items-start gap-2 text-sm"
              >
                <span className="text-gray-400 text-xs">
                  {new Date(activity.timestamp).toLocaleTimeString()}
                </span>
                <span className="text-gray-600">{activity.message}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Errors */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Actions */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={isComplete}
        >
          Cancel Import
        </Button>
      </div>
    </div>
  );
}

export default ProgressTracker;