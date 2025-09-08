'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Link, Upload, ShoppingBag, AlertCircle, CheckCircle2, ExternalLink } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface DataImportModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (data: any) => void;
  projectId?: string;
}

export function DataImportModal({ open, onClose, onSuccess, projectId }: DataImportModalProps) {
  const [importing, setImporting] = useState(false);
  const [feedUrl, setFeedUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [importStats, setImportStats] = useState<any>(null);
  const { toast } = useToast();

  const handleUrlImport = async () => {
    if (!feedUrl) {
      setError('Please enter a feed URL');
      return;
    }

    setImporting(true);
    setError(null);

    try {
      const response = await fetch('/api/taxonomy/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'url',
          url: feedUrl,
          projectId,
          options: {
            mergeSimilar: true,
            persistToDatabase: true,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Import failed');
      }

      setImportStats(data);
      toast({
        title: 'Import Successful',
        description: `Imported ${data.taxonomy.stats.totalProducts} products into ${data.taxonomy.nodes} categories`,
      });

      // Wait a moment to show success, then close
      setTimeout(() => {
        onSuccess(data);
        onClose();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      toast({
        title: 'Import Failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setError(null);

    try {
      const text = await file.text();
      let products = [];

      // Try to parse the file
      if (file.name.endsWith('.json')) {
        const data = JSON.parse(text);
        products = Array.isArray(data) ? data : data.products || data.items || [];
      } else {
        throw new Error('Please upload a JSON file');
      }

      const response = await fetch('/api/taxonomy/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'products',
          products,
          options: {
            mergeSimilar: true,
            persistToDatabase: true,
          },
          projectId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Import failed');
      }

      setImportStats(data);
      toast({
        title: 'Import Successful',
        description: `Imported ${products.length} products`,
      });

      setTimeout(() => {
        onSuccess(data);
        onClose();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'File upload failed');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Your Product Data</DialogTitle>
          <DialogDescription>
            Connect your product catalog to build your taxonomy visualization
          </DialogDescription>
        </DialogHeader>

        {importStats ? (
          <div className="space-y-4 py-4">
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                Successfully imported {importStats.taxonomy.stats.totalProducts} products!
              </AlertDescription>
            </Alert>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Categories Created</p>
                <p className="text-2xl font-semibold">{importStats.taxonomy.nodes}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Max Depth</p>
                <p className="text-2xl font-semibold">{importStats.taxonomy.stats.maxDepth}</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Top Categories:</p>
              {importStats.taxonomy.topCategories?.slice(0, 5).map((cat: any) => (
                <div key={cat.id} className="flex justify-between text-sm">
                  <span>{cat.title}</span>
                  <span className="text-muted-foreground">{cat.product_count} products</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <Tabs defaultValue="url" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="url">Feed URL</TabsTrigger>
              <TabsTrigger value="file">Upload File</TabsTrigger>
              <TabsTrigger value="google">Google Merchant</TabsTrigger>
            </TabsList>

            <TabsContent value="url" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="feed-url">Product Feed URL</Label>
                <Input
                  id="feed-url"
                  type="url"
                  placeholder="https://example.com/products.xml"
                  value={feedUrl}
                  onChange={(e) => setFeedUrl(e.target.value)}
                  disabled={importing}
                />
                <p className="text-xs text-muted-foreground">
                  Enter your Google Shopping feed, product XML, JSON, or CSV feed URL
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Supported formats:</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Google Shopping XML feeds</li>
                  <li>• JSON product arrays</li>
                  <li>• CSV/TSV product exports</li>
                  <li>• RSS 2.0 product feeds</li>
                </ul>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button 
                onClick={handleUrlImport} 
                disabled={importing || !feedUrl}
                className="w-full"
              >
                {importing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Link className="mr-2 h-4 w-4" />
                    Import from URL
                  </>
                )}
              </Button>

              <div className="pt-2">
                <p className="text-xs text-muted-foreground mb-2">Try with a sample feed:</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => setFeedUrl('https://www.kontorab.se/GoogleProductFeed/index?marketId=SWE&language=sv-SE')}
                >
                  <ExternalLink className="mr-1 h-3 w-3" />
                  Swedish Office Supplies (14k products)
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="file" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="file-upload">Upload Product File</Label>
                <Input
                  id="file-upload"
                  type="file"
                  accept=".json,.xml,.csv"
                  onChange={handleFileUpload}
                  disabled={importing}
                />
                <p className="text-xs text-muted-foreground">
                  Upload a JSON, XML, or CSV file containing your products
                </p>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </TabsContent>

            <TabsContent value="google" className="space-y-4">
              <Alert>
                <ShoppingBag className="h-4 w-4" />
                <AlertDescription>
                  Google Merchant Center integration coming soon! For now, use your Google Shopping feed URL in the Feed URL tab.
                </AlertDescription>
              </Alert>
              
              <div className="space-y-2">
                <p className="text-sm font-medium">How to get your Google feed URL:</p>
                <ol className="text-xs text-muted-foreground space-y-1">
                  <li>1. Log into Google Merchant Center</li>
                  <li>2. Go to Products → Feeds</li>
                  <li>3. Click on your primary feed</li>
                  <li>4. Copy the "Feed URL" or "Download URL"</li>
                  <li>5. Paste it in the Feed URL tab</li>
                </ol>
              </div>
            </TabsContent>
          </Tabs>
        )}

        {importing && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center rounded-lg">
            <div className="text-center space-y-2">
              <Loader2 className="h-8 w-8 animate-spin mx-auto" />
              <p className="text-sm">Importing your products...</p>
              <p className="text-xs text-muted-foreground">This may take a few moments</p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}