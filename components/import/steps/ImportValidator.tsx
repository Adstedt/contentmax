'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  Database,
  Zap,
  TrendingUp,
  Loader2,
} from 'lucide-react';

interface ImportValidatorProps {
  data: any;
  allData: any;
  onDataChange: (data: any) => void;
  onValidation: (isValid: boolean) => void;
}

interface ValidationResult {
  isValid: boolean;
  dataQuality: number;
  totalProducts: number;
  validProducts: number;
  warnings: string[];
  errors: string[];
  preview: any[];
}

export function ImportValidator({
  data,
  allData,
  onDataChange,
  onValidation,
}: ImportValidatorProps) {
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(
    data.validationResult || null
  );
  const [validationProgress, setValidationProgress] = useState(0);

  useEffect(() => {
    if (!validationResult && allData['source-selection']) {
      startValidation();
    }
  }, []);

  const startValidation = async () => {
    setIsValidating(true);
    setValidationProgress(0);

    // Simulate validation steps
    const steps = [
      { progress: 20, message: 'Connecting to source...' },
      { progress: 40, message: 'Analyzing data structure...' },
      { progress: 60, message: 'Validating product fields...' },
      { progress: 80, message: 'Checking data quality...' },
      { progress: 100, message: 'Validation complete!' },
    ];

    for (const step of steps) {
      setValidationProgress(step.progress);
      await new Promise((resolve) => setTimeout(resolve, 800));
    }

    // Mock validation result
    const result: ValidationResult = {
      isValid: true,
      dataQuality: 85,
      totalProducts: 14232,
      validProducts: 14100,
      warnings: [
        '132 products missing images',
        'Some products have incomplete descriptions',
        '45 products without brand information',
      ],
      errors: [],
      preview: [
        { id: '1', title: 'Office Chair', category: 'Furniture', price: 299.99 },
        { id: '2', title: 'Desk Lamp', category: 'Lighting', price: 49.99 },
        { id: '3', title: 'Notebook', category: 'Stationery', price: 12.99 },
      ],
    };

    setValidationResult(result);
    onDataChange({ validationResult: result });
    onValidation(result.isValid);
    setIsValidating(false);
  };

  const getQualityColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getQualityLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Poor';
  };

  if (isValidating) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-[#10a37f] mb-4" />
          <h3 className="text-lg font-semibold mb-2">Validating Your Data</h3>
          <p className="text-[#999] text-sm mb-6">Analyzing data quality and structure...</p>
          <Progress value={validationProgress} className="max-w-md mx-auto h-2 bg-[#1a1a1a]" />
          <p className="text-xs text-[#666] mt-2">{validationProgress}% complete</p>
        </div>
      </div>
    );
  }

  if (!validationResult) {
    return (
      <div className="text-center py-12">
        <Button onClick={startValidation} className="bg-[#10a37f] hover:bg-[#0e8a6b]">
          Start Validation
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quality Score */}
      <Card className="p-6 bg-[#1a1a1a] border-[#2a2a2a]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Data Quality Score</h3>
          <div className={`text-3xl font-bold ${getQualityColor(validationResult.dataQuality)}`}>
            {validationResult.dataQuality}%
          </div>
        </div>
        <Progress value={validationResult.dataQuality} className="h-3 bg-[#0a0a0a]" />
        <p className="text-sm text-[#999] mt-2">
          Quality:{' '}
          <span className={getQualityColor(validationResult.dataQuality)}>
            {getQualityLabel(validationResult.dataQuality)}
          </span>
        </p>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 bg-[#1a1a1a] border-[#2a2a2a]">
          <div className="flex items-center gap-3">
            <Database className="h-8 w-8 text-[#10a37f]" />
            <div>
              <p className="text-2xl font-bold">
                {validationResult.totalProducts.toLocaleString()}
              </p>
              <p className="text-xs text-[#999]">Total Products</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-[#1a1a1a] border-[#2a2a2a]">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold">
                {validationResult.validProducts.toLocaleString()}
              </p>
              <p className="text-xs text-[#999]">Valid Products</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-[#1a1a1a] border-[#2a2a2a]">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-8 w-8 text-yellow-500" />
            <div>
              <p className="text-2xl font-bold">{validationResult.warnings.length}</p>
              <p className="text-xs text-[#999]">Warnings</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Warnings */}
      {validationResult.warnings.length > 0 && (
        <Card className="p-6 bg-[#1a1a1a] border-[#2a2a2a]">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-yellow-500" />
            Data Quality Warnings
          </h4>
          <div className="space-y-2">
            {validationResult.warnings.map((warning, index) => (
              <Alert key={index} className="bg-[#0a0a0a] border-yellow-500/20">
                <AlertDescription className="text-[#999] text-sm">{warning}</AlertDescription>
              </Alert>
            ))}
          </div>
        </Card>
      )}

      {/* Preview */}
      <Card className="p-6 bg-[#1a1a1a] border-[#2a2a2a]">
        <h4 className="text-sm font-semibold mb-3">Sample Data Preview</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2a2a2a]">
                <th className="text-left py-2 px-3 text-[#666]">Product</th>
                <th className="text-left py-2 px-3 text-[#666]">Category</th>
                <th className="text-right py-2 px-3 text-[#666]">Price</th>
              </tr>
            </thead>
            <tbody>
              {validationResult.preview.map((product) => (
                <tr key={product.id} className="border-b border-[#2a2a2a]">
                  <td className="py-2 px-3">{product.title}</td>
                  <td className="py-2 px-3 text-[#999]">{product.category}</td>
                  <td className="py-2 px-3 text-right">${product.price}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-[#666] mt-3">
          Showing first 3 of {validationResult.totalProducts.toLocaleString()} products
        </p>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <Button
          variant="outline"
          onClick={startValidation}
          className="bg-[#0a0a0a] hover:bg-[#1a1a1a] border-[#2a2a2a]"
        >
          Re-validate
        </Button>
        {validationResult.warnings.length > 0 && (
          <Button variant="ghost" className="text-yellow-500 hover:bg-[#1a1a1a]">
            Fix Warnings
          </Button>
        )}
      </div>
    </div>
  );
}
