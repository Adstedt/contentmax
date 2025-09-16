'use client';

import { useState, useEffect } from 'react';
import { TaxonomyVisualization } from '@/components/taxonomy/TaxonomyVisualization';
import { DataImportModal } from '@/components/onboarding/DataImportModal';
import { ImportWizardV2 } from '@/components/import/ImportWizardV2';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, RefreshCw, Database } from 'lucide-react';
import type { TaxonomyNode, TaxonomyLink } from '@/components/taxonomy/D3Visualization';

interface TaxonomyClientProps {
  initialData?: any;
  projectId?: string;
  userId: string;
}

export function TaxonomyClient({ initialData, projectId, userId }: TaxonomyClientProps) {
  const [showImportModal, setShowImportModal] = useState(false);
  const [taxonomyData, setTaxonomyData] = useState<{
    nodes: TaxonomyNode[];
    links: TaxonomyLink[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasData, setHasData] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('Initializing...');

  useEffect(() => {
    loadTaxonomyData();
  }, [projectId]);

  const loadTaxonomyData = async () => {
    setLoading(true);
    setLoadingProgress(10);
    setLoadingMessage('Connecting to database...');

    try {
      // Check if user has taxonomy data in database
      setLoadingProgress(30);
      setLoadingMessage('Fetching taxonomy nodes...');

      const response = await fetch(`/api/taxonomy/data?projectId=${projectId || ''}`);

      setLoadingProgress(60);
      setLoadingMessage('Processing taxonomy structure...');

      if (response.ok) {
        const data = await response.json();

        setLoadingProgress(80);
        setLoadingMessage(`Building visualization for ${data.nodes?.length || 0} categories...`);

        if (data.nodes && data.nodes.length > 0) {
          // Add a small delay for very large datasets to prevent UI freeze
          if (data.nodes.length > 1000) {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          setTaxonomyData(data);
          setHasData(true);
          setLoadingProgress(100);
          setLoadingMessage('Complete!');
        } else {
          // No data - show onboarding
          setHasData(false);
          if (!taxonomyData) {
            setShowImportModal(true);
          }
        }
      } else if (response.status === 404) {
        // No data found
        setHasData(false);
        setShowImportModal(true);
      }
    } catch (error) {
      console.error('Failed to load taxonomy data:', error);
      setHasData(false);
      setLoadingMessage('Failed to load data');
    } finally {
      // Small delay before hiding loading for smooth transition
      setTimeout(() => setLoading(false), 300);
    }
  };

  const handleImportSuccess = async (importData: any) => {
    // Transform imported data to visualization format
    const { taxonomy } = importData;

    // Reload data from database
    await loadTaxonomyData();
    setShowImportModal(false);
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

  if (loading) {
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
              variant={hasData ? 'outline' : 'default'}
              className={
                hasData
                  ? 'bg-[#0a0a0a] hover:bg-[#1a1a1a] text-white border-[#2a2a2a]'
                  : 'bg-[#10a37f] hover:bg-[#0e8a6b] text-white'
              }
            >
              <Upload className="mr-2 h-4 w-4" />
              {hasData ? 'Import New Data' : 'Import Products'}
            </Button>

            {hasData && (
              <Button
                onClick={loadTaxonomyData}
                variant="outline"
                className="bg-[#0a0a0a] hover:bg-[#1a1a1a] text-white border-[#2a2a2a]"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            )}

            {!hasData && (
              <Button
                onClick={() => {
                  const demoData = generateDemoData();
                  setTaxonomyData(demoData);
                  setHasData(true);
                }}
                variant="ghost"
                className="hover:bg-[#1a1a1a] text-[#999]"
              >
                <Database className="mr-2 h-4 w-4" />
                Use Demo Data
              </Button>
            )}
          </div>

          {hasData && taxonomyData && (
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
            </div>
          )}
        </div>

        {/* Info Alert for New Users */}
        {!hasData && !taxonomyData && (
          <Alert>
            <AlertDescription>
              <strong>Welcome!</strong> Import your product catalog to visualize your taxonomy. You
              can use a product feed URL, upload a file, or connect to Google Merchant Center.
            </AlertDescription>
          </Alert>
        )}

        {/* Visualization */}
        {taxonomyData && (
          <TaxonomyVisualization
            data={taxonomyData}
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
