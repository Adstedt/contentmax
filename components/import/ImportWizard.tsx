'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Progress } from '@/components/ui/Progress';
import SitemapInput from './SitemapInput';
import ImportConfig from './ImportConfig';
import ProgressTracker from './ProgressTracker';
import ImportSummaryComponent from './ImportSummary';
import { ChevronLeft } from 'lucide-react';

export enum ImportStep {
  SITEMAP_INPUT = 'sitemap_input',
  CONFIGURATION = 'configuration',
  PROCESSING = 'processing',
  REVIEW = 'review',
}

export interface ImportConfiguration {
  sitemapUrl?: string;
  sitemapData?: SitemapPreview;
  scrapeContent?: boolean;
  rateLimit?: number;
  includePatterns?: string[];
  excludePatterns?: string[];
  maxPages?: number;
  priority?: 'high' | 'normal' | 'low';
  extractMetadata?: boolean;
  detectSkus?: boolean;
  buildHierarchy?: boolean;
}

export interface SitemapPreview {
  totalUrls: number;
  categories: {
    product: number;
    category: number;
    brand: number;
    other: number;
  };
  sampleUrls: string[];
}

export interface ImportSummary {
  id: string;
  totalUrls: number;
  successfulUrls: number;
  failedUrls: number;
  skippedUrls: number;
  categorizedUrls: Record<string, number>;
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
}

interface ImportWizardProps {
  onComplete: (importId: string) => void;
}

const STEPS = [
  {
    id: ImportStep.SITEMAP_INPUT,
    label: 'Sitemap URL',
    description: 'Enter your sitemap location',
  },
  {
    id: ImportStep.CONFIGURATION,
    label: 'Configuration',
    description: 'Configure import settings',
  },
  { id: ImportStep.PROCESSING, label: 'Processing', description: 'Importing your data' },
  { id: ImportStep.REVIEW, label: 'Review', description: 'Review import results' },
];

export default function ImportWizard({ onComplete }: ImportWizardProps) {
  const [currentStep, setCurrentStep] = useState<ImportStep>(ImportStep.SITEMAP_INPUT);
  const [importConfig, setImportConfig] = useState<ImportConfiguration>({
    scrapeContent: true,
    rateLimit: 5,
    priority: 'normal',
  });
  const [importId, setImportId] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);

  const currentStepIndex = STEPS.findIndex((step) => step.id === currentStep);
  const progressPercentage = ((currentStepIndex + 1) / STEPS.length) * 100;

  const handleSitemapNext = (sitemapUrl: string, preview: SitemapPreview) => {
    setImportConfig((prev) => ({ ...prev, sitemapUrl, sitemapData: preview }));
    setCurrentStep(ImportStep.CONFIGURATION);
  };

  const handleConfigNext = async (config: ImportConfiguration) => {
    setImportConfig(config);

    try {
      const response = await fetch('/api/import/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (!response.ok) throw new Error('Failed to start import');

      const { importId: newImportId } = await response.json();
      setImportId(newImportId);
      setCurrentStep(ImportStep.PROCESSING);
    } catch (error) {
      console.error('Failed to start import:', error);
    }
  };

  const handleProcessingComplete = (summary: ImportSummary) => {
    setImportSummary(summary);
    setCurrentStep(ImportStep.REVIEW);
  };

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex].id);
    }
  };

  const handleRestart = () => {
    setCurrentStep(ImportStep.SITEMAP_INPUT);
    setImportConfig({
      scrapeContent: true,
      rateLimit: 5,
      priority: 'normal',
    });
    setImportId(null);
    setImportSummary(null);
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          {STEPS.map((step, index) => (
            <div
              key={step.id}
              className={`flex-1 text-center ${index < STEPS.length - 1 ? 'relative' : ''}`}
            >
              <div
                className={`inline-flex items-center justify-center w-10 h-10 rounded-full border-2 mb-2 ${
                  index <= currentStepIndex
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-white border-gray-300 text-gray-500'
                }`}
              >
                {index + 1}
              </div>
              <p
                className={`text-sm font-medium ${
                  index <= currentStepIndex ? 'text-gray-900' : 'text-gray-500'
                }`}
              >
                {step.label}
              </p>
              <p className="text-xs text-gray-500">{step.description}</p>
              {index < STEPS.length - 1 && (
                <div
                  className={`absolute top-5 left-1/2 w-full h-0.5 ${
                    index < currentStepIndex ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                  style={{ width: 'calc(100% - 2.5rem)', left: 'calc(50% + 1.25rem)' }}
                />
              )}
            </div>
          ))}
        </div>
        <Progress value={progressPercentage} className="h-2" />
      </div>

      <Card>
        <CardContent className="p-6">
          {currentStep === ImportStep.SITEMAP_INPUT && <SitemapInput onNext={handleSitemapNext} />}

          {currentStep === ImportStep.CONFIGURATION && importConfig.sitemapData && (
            <ImportConfig
              sitemapData={importConfig.sitemapData}
              initialConfig={importConfig}
              onNext={handleConfigNext}
              onBack={handleBack}
            />
          )}

          {currentStep === ImportStep.PROCESSING && importId && (
            <ProgressTracker importId={importId} onComplete={handleProcessingComplete} onCancel={() => setCurrentStep(ImportStep.CONFIGURATION)} />
          )}

          {currentStep === ImportStep.REVIEW && importSummary && (
            <ImportSummaryComponent
              summary={{
                ...importSummary,
                categorizedUrls: {
                  product: (importSummary.categorizedUrls as any)?.product || 0,
                  category: (importSummary.categorizedUrls as any)?.category || 0,
                  brand: (importSummary.categorizedUrls as any)?.brand || 0,
                  blog: (importSummary.categorizedUrls as any)?.blog || 0,
                  other: (importSummary.categorizedUrls as any)?.other || 0,
                }
              }}
              onComplete={() => onComplete(importId!)}
              onRestart={handleRestart}
            />
          )}
        </CardContent>
      </Card>

      {currentStep !== ImportStep.PROCESSING && currentStep !== ImportStep.REVIEW && (
        <div className="flex justify-between mt-6">
          <Button onClick={handleBack} disabled={currentStepIndex === 0} variant="outline">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>
      )}
    </div>
  );
}
