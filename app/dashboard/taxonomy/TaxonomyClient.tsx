'use client';

import { useState, useEffect } from 'react';
import { TaxonomyVisualization } from '@/components/taxonomy/TaxonomyVisualization';
import { ImportWizardV2 } from '@/components/import/ImportWizardV2';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, RefreshCw, Database, AlertCircle } from 'lucide-react';
import type { TaxonomyNode, TaxonomyLink } from '@/components/taxonomy/D3Visualization';
import { useTaxonomyData } from '@/hooks/useTaxonomyData';

interface TaxonomyClientProps {
  initialData?: any;
  projectId?: string;
  userId: string;
}

export function TaxonomyClient({ initialData, projectId, userId }: TaxonomyClientProps) {
  const [showImportModal, setShowImportModal] = useState(false);
  const [showDemoData, setShowDemoData] = useState(false);

  // Use SWR for data fetching with caching
  const {
    data: taxonomyData,
    error,
    isLoading,
    isRefreshing,
    hasData,
    isEmpty,
    refresh,
    mutate,
  } = useTaxonomyData({
    projectId,
    fallbackData: initialData,
  });

  // Show import modal if no data on first load
  useEffect(() => {
    if (!isLoading && isEmpty && !showDemoData) {
      setShowImportModal(true);
    }
  }, [isLoading, isEmpty, showDemoData]);

  // Calculate loading progress for smooth UX
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('Initializing...');

  useEffect(() => {
    if (isLoading) {
      // Smooth progress animation
      setLoadingProgress(10);
      setLoadingMessage('Connecting to database...');

      const timer1 = setTimeout(() => {
        setLoadingProgress(40);
        setLoadingMessage('Loading taxonomy nodes...');
      }, 200);

      const timer2 = setTimeout(() => {
        setLoadingProgress(70);
        setLoadingMessage('Processing relationships...');
      }, 400);

      const timer3 = setTimeout(() => {
        setLoadingProgress(90);
        setLoadingMessage('Building visualization...');
      }, 600);

      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
      };
    } else if (taxonomyData) {
      setLoadingProgress(100);
      setLoadingMessage('Complete!');
    }
  }, [isLoading, taxonomyData]);

  const handleImportSuccess = async (importData: any) => {
    // Use SWR mutate to refresh the data
    await mutate();
    setShowImportModal(false);

    // Clear any demo data
    setShowDemoData(false);
  };

  const generateDemoData = () => {
    // Use the existing demo data generator for testing
    const nodes: TaxonomyNode[] = [];
    const links: TaxonomyLink[] = [];

    // Create root node
    nodes.push({
      id: 'root',
      url: '/',
      title: 'Home',
      children: [],
      depth: 0,
      skuCount: 100,
      traffic: 10000,
      revenue: 50000,
      status: 'optimized',
    });

    // Create category nodes
    const categories = ['Electronics', 'Clothing', 'Books', 'Sports', 'Home'];
    categories.forEach((category, i) => {
      const categoryId = `category-${i}`;
      nodes.push({
        id: categoryId,
        url: `/${category.toLowerCase()}`,
        title: category,
        children: [],
        depth: 1,
        skuCount: Math.floor(Math.random() * 50) + 10,
        traffic: Math.floor(Math.random() * 5000) + 1000,
        revenue: Math.floor(Math.random() * 20000) + 5000,
        status: ['optimized', 'outdated', 'missing', 'noContent'][
          Math.floor(Math.random() * 4)
        ] as any,
      });

      links.push({
        source: 'root',
        target: categoryId,
        strength: 0.8,
      });
    });

    return { nodes, links };
  };

  // Show loading only on initial load, not on refresh
  if (isLoading && !taxonomyData) {
    return (
      <div className="flex items-center justify-center h-[600px]">
        <div className="text-center space-y-4 max-w-md">
          <RefreshCw className="h-12 w-12 animate-spin mx-auto text-[#10a37f]" />
          <div className="space-y-2">
            <p className="text-lg font-medium">{loadingMessage}</p>
            <div className="w-full bg-[#1a1a1a] rounded-full h-2 overflow-hidden">
              <div
                className="bg-[#10a37f] h-full rounded-full transition-all duration-300 ease-out"
                style={{ width: `${loadingProgress}%` }}
              />
            </div>
            <p className="text-xs text-[#666]">{loadingProgress}% complete</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Action Bar */}
        <div className="flex justify-between items-center">
          <div className="flex gap-2">
            <Button
              onClick={() => setShowImportModal(true)}
              variant={hasData || showDemoData ? 'outline' : 'default'}
              className={
                hasData || showDemoData
                  ? 'bg-[#0a0a0a] hover:bg-[#1a1a1a] text-white border-[#2a2a2a]'
                  : 'bg-[#10a37f] hover:bg-[#0e8a6b] text-white'
              }
            >
              <Upload className="mr-2 h-4 w-4" />
              {hasData || showDemoData ? 'Import New Data' : 'Import Products'}
            </Button>

            {(hasData || showDemoData) && (
              <Button
                onClick={refresh}
                variant="outline"
                disabled={isRefreshing}
                className="bg-[#0a0a0a] hover:bg-[#1a1a1a] text-white border-[#2a2a2a] disabled:opacity-50"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'Refreshing...' : 'Refresh'}
              </Button>
            )}

            {!hasData && !showDemoData && (
              <Button
                onClick={() => {
                  const demoData = generateDemoData();
                  mutate(demoData, false); // Update cache with demo data
                  setShowDemoData(true);
                }}
                variant="ghost"
                className="hover:bg-[#1a1a1a] text-[#999]"
              >
                <Database className="mr-2 h-4 w-4" />
                Use Demo Data
              </Button>
            )}
          </div>

          {(hasData || showDemoData) && taxonomyData && (
            <div className="flex items-center gap-4 text-sm">
              <div className="text-muted-foreground">
                {taxonomyData.nodes.length.toLocaleString()} categories •{' '}
                {taxonomyData.links.length.toLocaleString()} connections
              </div>
              {taxonomyData.nodes.length > 500 && (
                <span className="px-2 py-1 bg-yellow-500/10 text-yellow-500 rounded text-xs font-medium">
                  Large Dataset - Performance Mode
                </span>
              )}
              {isRefreshing && (
                <span className="px-2 py-1 bg-blue-500/10 text-blue-500 rounded text-xs font-medium animate-pulse">
                  Updating...
                </span>
              )}
            </div>
          )}
        </div>

        {/* Error handling */}
        {error && (
          <Alert className="bg-[#0a0a0a] border-red-500/20">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <AlertDescription className="text-[#999]">
              Failed to load taxonomy data. Please try refreshing the page.
            </AlertDescription>
          </Alert>
        )}

        {/* Info Alert for New Users */}
        {!hasData && !showDemoData && !isLoading && (
          <Alert>
            <AlertDescription>
              <strong>Welcome!</strong> Import your product catalog to visualize your taxonomy. You
              can use a product feed URL, upload a file, or connect to Google Merchant Center.
            </AlertDescription>
          </Alert>
        )}

        {/* Visualization */}
        {(taxonomyData || showDemoData) && (
          <TaxonomyVisualization
            data={taxonomyData || generateDemoData()}
            onNodeClick={(node) => console.log('Node clicked:', node)}
          />
        )}
      </div>

      {/* Import Modal - Using new ImportWizardV2 */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm">
          <div className="fixed inset-4 md:inset-8 lg:inset-12 bg-[#0a0a0a] rounded-lg shadow-2xl overflow-hidden">
            <ImportWizardV2
              onClose={() => setShowImportModal(false)}
              onComplete={(data) => {
                console.log('Import complete:', data);
                handleImportSuccess(data);
                setShowImportModal(false);
              }}
              projectId={projectId}
            />
          </div>
        </div>
      )}
    </>
  );
}
