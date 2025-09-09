'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info, Zap, Shield, RefreshCw } from 'lucide-react';

interface ImportOptionsProps {
  data: any;
  onDataChange: (data: any) => void;
  onValidation: (isValid: boolean) => void;
}

export function ImportOptions({ data, onDataChange, onValidation }: ImportOptionsProps) {
  const [options, setOptions] = useState({
    mergeStrategy: data.mergeStrategy || 'update',
    detectDuplicates: data.detectDuplicates ?? true,
    enrichWithAI: data.enrichWithAI ?? true,
    generateTaxonomy: data.generateTaxonomy ?? true,
    batchSize: data.batchSize || 100,
    rateLimit: data.rateLimit || 10,
    scheduleImport: data.scheduleImport || false,
    scheduleFrequency: data.scheduleFrequency || 'daily',
    ...data,
  });

  useEffect(() => {
    onDataChange(options);
    onValidation(true); // Options are always valid since they have defaults
  }, [options, onDataChange, onValidation]);

  const updateOption = (key: string, value: any) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Configure Import Options</h3>
        <p className="text-[#999] text-sm">
          Customize how your products are imported and processed.
        </p>
      </div>

      {/* Import Strategy */}
      <Card className="p-6 bg-[#1a1a1a] border-[#2a2a2a]">
        <h4 className="text-sm font-semibold mb-4">Import Strategy</h4>
        <div className="space-y-4">
          <div>
            <Label htmlFor="merge-strategy">Merge Strategy</Label>
            <Select
              value={options.mergeStrategy}
              onValueChange={(value) => updateOption('mergeStrategy', value)}
            >
              <SelectTrigger className="mt-2 bg-[#0a0a0a] border-[#2a2a2a]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#0a0a0a] border-[#2a2a2a]">
                <SelectItem value="update">Update Existing</SelectItem>
                <SelectItem value="replace">Replace All</SelectItem>
                <SelectItem value="append">Append Only</SelectItem>
                <SelectItem value="skip">Skip Duplicates</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-[#666] mt-2">
              How to handle products that already exist in your catalog
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="detect-duplicates">Detect Duplicates</Label>
              <p className="text-xs text-[#666] mt-1">Use AI to identify duplicate products</p>
            </div>
            <Switch
              id="detect-duplicates"
              checked={options.detectDuplicates}
              onCheckedChange={(checked) => updateOption('detectDuplicates', checked)}
            />
          </div>
        </div>
      </Card>

      {/* AI Enhancement */}
      <Card className="p-6 bg-[#1a1a1a] border-[#2a2a2a]">
        <h4 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <Zap className="h-4 w-4 text-[#10a37f]" />
          AI Enhancement
        </h4>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="enrich-ai">Enrich Product Data</Label>
              <p className="text-xs text-[#666] mt-1">
                Improve descriptions and add missing attributes
              </p>
            </div>
            <Switch
              id="enrich-ai"
              checked={options.enrichWithAI}
              onCheckedChange={(checked) => updateOption('enrichWithAI', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="generate-taxonomy">Auto-generate Taxonomy</Label>
              <p className="text-xs text-[#666] mt-1">
                Create category hierarchy from product data
              </p>
            </div>
            <Switch
              id="generate-taxonomy"
              checked={options.generateTaxonomy}
              onCheckedChange={(checked) => updateOption('generateTaxonomy', checked)}
            />
          </div>
        </div>
      </Card>

      {/* Performance */}
      <Card className="p-6 bg-[#1a1a1a] border-[#2a2a2a]">
        <h4 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <Shield className="h-4 w-4 text-[#10a37f]" />
          Performance & Limits
        </h4>
        <div className="space-y-4">
          <div>
            <Label htmlFor="batch-size">Batch Size: {options.batchSize}</Label>
            <Slider
              id="batch-size"
              value={[options.batchSize]}
              onValueChange={([value]) => updateOption('batchSize', value)}
              min={10}
              max={500}
              step={10}
              className="mt-2"
            />
            <p className="text-xs text-[#666] mt-2">Number of products to process at once</p>
          </div>

          <div>
            <Label htmlFor="rate-limit">Rate Limit: {options.rateLimit}/sec</Label>
            <Slider
              id="rate-limit"
              value={[options.rateLimit]}
              onValueChange={([value]) => updateOption('rateLimit', value)}
              min={1}
              max={50}
              step={1}
              className="mt-2"
            />
            <p className="text-xs text-[#666] mt-2">Maximum requests per second</p>
          </div>
        </div>
      </Card>

      {/* Scheduling */}
      <Card className="p-6 bg-[#1a1a1a] border-[#2a2a2a]">
        <h4 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-[#10a37f]" />
          Scheduled Import
        </h4>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="schedule-import">Enable Scheduled Import</Label>
              <p className="text-xs text-[#666] mt-1">Automatically sync your catalog</p>
            </div>
            <Switch
              id="schedule-import"
              checked={options.scheduleImport}
              onCheckedChange={(checked) => updateOption('scheduleImport', checked)}
            />
          </div>

          {options.scheduleImport && (
            <div>
              <Label htmlFor="schedule-frequency">Frequency</Label>
              <Select
                value={options.scheduleFrequency}
                onValueChange={(value) => updateOption('scheduleFrequency', value)}
              >
                <SelectTrigger className="mt-2 bg-[#0a0a0a] border-[#2a2a2a]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0a0a0a] border-[#2a2a2a]">
                  <SelectItem value="hourly">Every Hour</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </Card>

      <Alert className="bg-[#0a0a0a] border-[#2a2a2a]">
        <Info className="h-4 w-4 text-[#10a37f]" />
        <AlertDescription className="text-[#999]">
          <strong className="text-white">Recommended:</strong> Enable AI enhancement for better
          category detection and product enrichment. This typically improves taxonomy quality by
          40%.
        </AlertDescription>
      </Alert>
    </div>
  );
}
