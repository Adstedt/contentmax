'use client';

import { useState, useEffect } from 'react';
import { TaxonomyVisualization } from '@/components/taxonomy/TaxonomyVisualization';
import { DataImportModal } from '@/components/onboarding/DataImportModal';
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
  const [taxonomyData, setTaxonomyData] = useState<{ nodes: TaxonomyNode[], links: TaxonomyLink[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasData, setHasData] = useState(false);

  useEffect(() => {
    loadTaxonomyData();
  }, [projectId]);

  const loadTaxonomyData = async () => {
    setLoading(true);
    try {
      // Check if user has taxonomy data in database
      const response = await fetch(`/api/taxonomy/data?projectId=${projectId || ''}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.nodes && data.nodes.length > 0) {
          setTaxonomyData(data);
          setHasData(true);
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
    } finally {
      setLoading(false);
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
        status: ['optimized', 'outdated', 'missing', 'noContent'][Math.floor(Math.random() * 4)] as any,
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
        <div className="text-center space-y-2">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Loading taxonomy data...</p>
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
              variant={hasData ? "outline" : "default"}
            >
              <Upload className="mr-2 h-4 w-4" />
              {hasData ? 'Import New Data' : 'Import Products'}
            </Button>
            
            {hasData && (
              <Button
                onClick={loadTaxonomyData}
                variant="outline"
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
              >
                <Database className="mr-2 h-4 w-4" />
                Use Demo Data
              </Button>
            )}
          </div>
          
          {hasData && taxonomyData && (
            <div className="text-sm text-muted-foreground">
              {taxonomyData.nodes.length} categories • {taxonomyData.links.length} connections
            </div>
          )}
        </div>

        {/* Info Alert for New Users */}
        {!hasData && !taxonomyData && (
          <Alert>
            <AlertDescription>
              <strong>Welcome!</strong> Import your product catalog to visualize your taxonomy. 
              You can use a product feed URL, upload a file, or connect to Google Merchant Center.
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

      {/* Import Modal */}
      <DataImportModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={handleImportSuccess}
        projectId={projectId}
      />
    </>
  );
}