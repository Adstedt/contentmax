'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/Label';
import { Switch } from '@/components/ui/Switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/RadioGroup';
import { Textarea } from '@/components/ui/Textarea';
import { Card } from '@/components/ui/Card';
import { ImportConfiguration, SitemapPreview } from './ImportWizard';
import { Settings, Zap, Filter, AlertCircle } from 'lucide-react';

interface ImportConfigProps {
  sitemapData: SitemapPreview;
  initialConfig: ImportConfiguration;
  onNext: (config: ImportConfiguration) => void;
  onBack: () => void;
}

function ImportConfig({
  sitemapData,
  initialConfig,
  onNext,
  onBack,
}: ImportConfigProps) {
  const [config, setConfig] = useState<ImportConfiguration>(initialConfig);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext(config);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* URL Categories */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-blue-500" />
          <h3 className="text-lg font-semibold">URL Categories</h3>
        </div>
        
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Product Pages:</span>
            <span className="font-semibold">{sitemapData.categories.product}</span>
          </div>
          <div className="flex justify-between">
            <span>Category Pages:</span>
            <span className="font-semibold">{sitemapData.categories.category}</span>
          </div>
          <div className="flex justify-between">
            <span>Brand Pages:</span>
            <span className="font-semibold">{sitemapData.categories.brand}</span>
          </div>
          <div className="flex justify-between">
            <span>Other Pages:</span>
            <span className="font-semibold">{sitemapData.categories.other}</span>
          </div>
        </div>
      </Card>

      {/* Processing Options */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-5 h-5 text-green-500" />
          <h3 className="text-lg font-semibold">Processing Options</h3>
        </div>
        
        <div className="space-y-4">
          {/* Scrape Content */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="scrapeContent">Scrape Page Content</Label>
              <p className="text-sm text-gray-500">
                Extract content from each URL (slower but more complete)
              </p>
            </div>
            <Switch
              id="scrapeContent"
              checked={config.scrapeContent}
              onCheckedChange={(checked) =>
                setConfig({ ...config, scrapeContent: checked })
              }
            />
          </div>

          {/* Extract Metadata */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="extractMetadata">Extract Metadata</Label>
              <p className="text-sm text-gray-500">
                Extract title, description, and keywords from pages
              </p>
            </div>
            <Switch
              id="extractMetadata"
              checked={config.extractMetadata}
              onCheckedChange={(checked) =>
                setConfig({ ...config, extractMetadata: checked })
              }
            />
          </div>

          {/* Detect SKUs */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="detectSkus">Detect SKUs</Label>
              <p className="text-sm text-gray-500">
                Automatically detect product SKUs on pages
              </p>
            </div>
            <Switch
              id="detectSkus"
              checked={config.detectSkus}
              onCheckedChange={(checked) =>
                setConfig({ ...config, detectSkus: checked })
              }
            />
          </div>

          {/* Build Hierarchy */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="buildHierarchy">Build Taxonomy Hierarchy</Label>
              <p className="text-sm text-gray-500">
                Automatically organize URLs into a hierarchical structure
              </p>
            </div>
            <Switch
              id="buildHierarchy"
              checked={config.buildHierarchy}
              onCheckedChange={(checked) =>
                setConfig({ ...config, buildHierarchy: checked })
              }
            />
          </div>
        </div>
      </Card>

      {/* Performance Settings */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-5 h-5 text-yellow-500" />
          <h3 className="text-lg font-semibold">Performance Settings</h3>
        </div>
        
        <div className="space-y-4">
          {/* Rate Limit */}
          <div className="space-y-2">
            <Label htmlFor="rateLimit">
              Rate Limit (requests per second): {config.rateLimit}
            </Label>
            <input
              type="range"
              id="rateLimit"
              min="1"
              max="20"
              value={config.rateLimit}
              onChange={(e) =>
                setConfig({ ...config, rateLimit: Number(e.target.value) })
              }
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>Slower (1/s)</span>
              <span>Faster (20/s)</span>
            </div>
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <Label>Processing Priority</Label>
            <RadioGroup
              value={config.priority}
              onValueChange={(value: 'low' | 'normal' | 'high') =>
                setConfig({ ...config, priority: value })
              }
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="low" id="low" />
                <Label htmlFor="low" className="font-normal">
                  Low - Background processing
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="normal" id="normal" />
                <Label htmlFor="normal" className="font-normal">
                  Normal - Standard processing
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="high" id="high" />
                <Label htmlFor="high" className="font-normal">
                  High - Priority processing
                </Label>
              </div>
            </RadioGroup>
          </div>
        </div>
      </Card>

      {/* Exclusion Rules */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Exclusion Rules</h3>
        <div className="space-y-2">
          <Label htmlFor="excludePatterns">
            Exclude URL Patterns (one per line)
          </Label>
          <Textarea
            id="excludePatterns"
            placeholder={`/admin/*\n*.pdf\n/private/*`}
            value={config.excludePatterns?.join('\n') || ''}
            onChange={(e) =>
              setConfig({
                ...config,
                excludePatterns: e.target.value
                  .split('\n')
                  .filter(Boolean),
              })
            }
            className="h-24"
          />
        </div>
      </Card>

      {/* Warning */}
      {config.scrapeContent && (
        <div className="flex items-start gap-2 p-4 bg-yellow-50 rounded-lg">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-yellow-900">
              Content scraping will take longer
            </p>
            <p className="text-yellow-700">
              Processing {sitemapData.totalUrls} URLs with content scraping
              enabled may take{' '}
              {Math.round((sitemapData.totalUrls / config.rateLimit / 60))} minutes
              or more.
            </p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button type="submit">
          Start Import
        </Button>
      </div>
    </form>
  );
}

export default ImportConfig;