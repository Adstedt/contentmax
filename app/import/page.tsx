'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
// import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import ImportWizard from '@/components/import/ImportWizard';
import ImportHistory from '@/components/import/ImportHistory';
import { Upload, History, FileText } from 'lucide-react';

export default function ImportPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');

  const handleImportComplete = (importId: string) => {
    router.push(`/import/${importId}/summary`);
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Import Site Data</h1>
        <p className="text-gray-600">
          Import your site structure and content from sitemaps or Google Search Console
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'new' | 'history')}>
        <TabsList className="mb-6">
          <TabsTrigger value="new" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            New Import
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Import History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="new">
          <Card>
            <CardHeader>
              <CardTitle>Start New Import</CardTitle>
              <CardDescription>
                Follow the steps below to import your site data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ImportWizard onComplete={handleImportComplete} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Previous Imports</CardTitle>
              <CardDescription>
                View and manage your import history
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ImportHistory />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <FileText className="h-8 w-8 text-blue-600 mb-2" />
            <CardTitle className="text-lg">Sitemap Import</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Import your site structure from XML sitemaps
            </p>
            <ul className="text-sm space-y-1">
              <li>✓ Automatic URL discovery</li>
              <li>✓ Priority detection</li>
              <li>✓ Last modified dates</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Upload className="h-8 w-8 text-green-600 mb-2" />
            <CardTitle className="text-lg">Google Search Console</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Import performance data from GSC
            </p>
            <ul className="text-sm space-y-1">
              <li>✓ Search impressions</li>
              <li>✓ Click-through rates</li>
              <li>✓ Ranking positions</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <History className="h-8 w-8 text-purple-600 mb-2" />
            <CardTitle className="text-lg">Incremental Updates</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Keep your data up-to-date automatically
            </p>
            <ul className="text-sm space-y-1">
              <li>✓ Detect new pages</li>
              <li>✓ Update existing content</li>
              <li>✓ Track changes over time</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}