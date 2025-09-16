'use client';

import { useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  CheckCircle2,
  Package,
  FolderTree,
  AlertCircle,
  X,
  Download,
  Calendar,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';

interface ImportResultsProps {
  data: any;
  allData: any;
  onDataChange: (data: any) => void;
  onValidation: (isValid: boolean) => void;
}

export function ImportResults({ data, allData, onDataChange, onValidation }: ImportResultsProps) {
  console.log('ImportResults component rendered with data:', { data, allData });

  // Get summary from the processing step data
  const summary = allData['processing']?.summary ||
    data?.summary || {
      totalProducts: allData['processing']?.totalProducts || 0,
      processedProducts: allData['processing']?.processedProducts || 0,
      categoriesCreated: allData['processing']?.categoriesCreated || 0,
      errors: allData['processing']?.errors || 0,
      warnings: allData['processing']?.warnings || 0,
    };

  console.log('Using summary:', summary);

  useEffect(() => {
    onValidation(true);
  }, [onValidation]);

  const successRate = (
    ((summary.processedProducts - summary.errors) / summary.totalProducts) *
    100
  ).toFixed(1);

  return (
    <div className="space-y-6">
      {/* Success Message */}
      <div className="text-center py-6">
        <CheckCircle2 className="h-16 w-16 text-[#10a37f] mx-auto mb-4" />
        <h3 className="text-2xl font-bold mb-2">Import Complete!</h3>
        <p className="text-[#999]">
          Successfully imported {summary.processedProducts.toLocaleString()} products
        </p>
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-[#1a1a1a] border-[#2a2a2a]">
          <div className="flex items-center gap-3">
            <Package className="h-8 w-8 text-[#10a37f]" />
            <div>
              <p className="text-2xl font-bold">{summary.processedProducts.toLocaleString()}</p>
              <p className="text-xs text-[#666]">Products Imported</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-[#1a1a1a] border-[#2a2a2a]">
          <div className="flex items-center gap-3">
            <FolderTree className="h-8 w-8 text-[#10a37f]" />
            <div>
              <p className="text-2xl font-bold">{summary.categoriesCreated}</p>
              <p className="text-xs text-[#666]">Categories Created</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-[#1a1a1a] border-[#2a2a2a]">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{successRate}%</p>
              <p className="text-xs text-[#666]">Success Rate</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-[#1a1a1a] border-[#2a2a2a]">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-8 w-8 text-yellow-500" />
            <div>
              <p className="text-2xl font-bold">{summary.warnings}</p>
              <p className="text-xs text-[#666]">Warnings</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Import Details */}
      <Card className="p-6 bg-[#1a1a1a] border-[#2a2a2a]">
        <h4 className="text-sm font-semibold mb-4">Import Details</h4>
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-[#666]">Import ID</span>
            <span className="font-mono">IMP-{Date.now().toString(36).toUpperCase()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#666]">Source Type</span>
            <span>{allData['source-selection']?.sourceType || 'URL Feed'}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#666]">Duration</span>
            <span>2m 34s</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#666]">Completed At</span>
            <span>{new Date().toLocaleString()}</span>
          </div>
        </div>
      </Card>

      {/* Warnings */}
      {summary.warnings > 0 && (
        <Card className="p-6 bg-[#1a1a1a] border-yellow-500/20">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-yellow-500" />
            Import Warnings ({summary.warnings})
          </h4>
          <div className="space-y-2">
            <Alert className="bg-[#0a0a0a] border-[#2a2a2a]">
              <AlertDescription className="text-[#999] text-sm">
                132 products imported without images
              </AlertDescription>
            </Alert>
            <Alert className="bg-[#0a0a0a] border-[#2a2a2a]">
              <AlertDescription className="text-[#999] text-sm">
                45 products missing brand information
              </AlertDescription>
            </Alert>
          </div>
        </Card>
      )}

      {/* Next Steps */}
      <Card className="p-6 bg-[#1a1a1a] border-[#2a2a2a]">
        <h4 className="text-sm font-semibold mb-4">Recommended Next Steps</h4>
        <div className="space-y-3">
          <Button
            variant="outline"
            className="w-full justify-between bg-[#0a0a0a] hover:bg-[#1a1a1a] border-[#2a2a2a]"
          >
            <span className="flex items-center gap-2">
              <FolderTree className="h-4 w-4" />
              View Taxonomy Visualization
            </span>
            <ArrowRight className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            className="w-full justify-between bg-[#0a0a0a] hover:bg-[#1a1a1a] border-[#2a2a2a]"
          >
            <span className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Schedule Regular Updates
            </span>
            <ArrowRight className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            className="w-full justify-between bg-[#0a0a0a] hover:bg-[#1a1a1a] border-[#2a2a2a]"
          >
            <span className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Download Import Report
            </span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      {/* Success Alert */}
      <Alert className="bg-[#10a37f]/10 border-[#10a37f]/20">
        <CheckCircle2 className="h-4 w-4 text-[#10a37f]" />
        <AlertDescription className="text-white">
          <strong>Great job!</strong> Your product taxonomy is now ready. The AI has automatically
          organized your products into {summary.categoriesCreated} categories for optimal navigation
          and SEO performance.
        </AlertDescription>
      </Alert>
    </div>
  );
}
