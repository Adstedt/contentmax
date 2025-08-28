'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { Card } from '@/components/ui/Card';
import { SitemapPreview } from './ImportWizard';
import { Globe, FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface SitemapInputProps {
  onNext: (sitemapUrl: string, preview: SitemapPreview) => void;
}

export default function SitemapInput({ onNext }: SitemapInputProps) {
  const [sitemapUrl, setSitemapUrl] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<SitemapPreview | null>(null);

  const validateUrl = (url: string): boolean => {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const handleValidate = async () => {
    setError(null);
    
    if (!sitemapUrl) {
      setError('Please enter a sitemap URL');
      return;
    }

    if (!validateUrl(sitemapUrl)) {
      setError('Please enter a valid URL starting with http:// or https://');
      return;
    }

    setIsValidating(true);

    try {
      const response = await fetch('/api/import/validate-sitemap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: sitemapUrl }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to validate sitemap');
      }

      const data = await response.json();
      setPreview(data.preview);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to validate sitemap');
    } finally {
      setIsValidating(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (preview) {
      onNext(sitemapUrl, preview);
    } else {
      handleValidate();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2">Enter Sitemap URL</h2>
        <p className="text-gray-600">
          Provide the URL to your XML sitemap. We&apos;ll analyze it to understand your site structure.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="sitemap-url">Sitemap URL</Label>
          <div className="flex gap-2 mt-1">
            <Input
              id="sitemap-url"
              type="url"
              placeholder="https://example.com/sitemap.xml"
              value={sitemapUrl}
              onChange={(e) => {
                setSitemapUrl(e.target.value);
                setPreview(null);
                setError(null);
              }}
              className="flex-1"
              required
            />
            <Button
              type="button"
              onClick={handleValidate}
              disabled={isValidating || !sitemapUrl}
            >
              {isValidating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Validating
                </>
              ) : (
                <>
                  <Globe className="mr-2 h-4 w-4" />
                  Validate
                </>
              )}
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {preview && (
          <Card className="p-6 bg-green-50 border-green-200">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-green-900 mb-3">Sitemap Validated Successfully</h3>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-white p-3 rounded border border-green-200">
                    <p className="text-sm text-gray-600">Total URLs</p>
                    <p className="text-2xl font-bold text-gray-900">{preview.totalUrls.toLocaleString()}</p>
                  </div>
                  <div className="bg-white p-3 rounded border border-green-200">
                    <p className="text-sm text-gray-600">Categories Found</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {Object.values(preview.categories).filter(v => v > 0).length}
                    </p>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <p className="text-sm font-medium text-gray-700">URL Categories:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(preview.categories).map(([category, count]) => (
                      <div key={category} className="flex justify-between text-sm">
                        <span className="capitalize text-gray-600">{category}:</span>
                        <span className="font-medium">{count.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {preview.sampleUrls.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700">Sample URLs:</p>
                    <div className="bg-white p-2 rounded border border-green-200 max-h-32 overflow-y-auto">
                      {preview.sampleUrls.map((url, index) => (
                        <p key={index} className="text-xs text-gray-600 truncate">
                          {url}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}
      </div>

      <div className="bg-blue-50 p-4 rounded-lg">
        <div className="flex gap-3">
          <FileText className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-medium mb-1">Supported Formats:</p>
            <ul className="space-y-1">
              <li>• XML Sitemaps (sitemap.xml)</li>
              <li>• Sitemap Index files (sitemap_index.xml)</li>
              <li>• Gzipped sitemaps (.xml.gz)</li>
            </ul>
          </div>
        </div>
      </div>

      {preview && (
        <div className="flex justify-end">
          <Button type="submit" size="lg">
            Continue to Configuration
          </Button>
        </div>
      )}
    </form>
  );
}