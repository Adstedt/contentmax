'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Link,
  Upload,
  ShoppingBag,
  Globe,
  FileSpreadsheet,
  Database,
  Info,
  Sparkles,
} from 'lucide-react';

interface ImportSourceSelectorProps {
  data: any;
  onDataChange: (data: any) => void;
  onValidation: (isValid: boolean) => void;
}

export function ImportSourceSelector({
  data,
  onDataChange,
  onValidation,
}: ImportSourceSelectorProps) {
  const [sourceType, setSourceType] = useState(data.sourceType || 'url');
  const [sourceUrl, setSourceUrl] = useState(data.sourceUrl || '');
  const [file, setFile] = useState<File | null>(data.file || null);
  const [connectionString, setConnectionString] = useState(data.connectionString || '');

  useEffect(() => {
    // Validate based on source type
    let isValid = false;

    switch (sourceType) {
      case 'url':
        isValid = !!sourceUrl && isValidUrl(sourceUrl);
        break;
      case 'file':
        isValid = !!file;
        break;
      case 'google':
        isValid = false; // Will be valid after OAuth
        break;
      case 'database':
        isValid = !!connectionString;
        break;
      case 'api':
        isValid = !!sourceUrl && isValidUrl(sourceUrl);
        break;
    }

    onValidation(isValid);
    onDataChange({
      sourceType,
      sourceUrl,
      file,
      connectionString,
    });
  }, [sourceType, sourceUrl, file, connectionString, onDataChange, onValidation]);

  const isValidUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const detectSourceType = (url: string) => {
    if (!url) return;

    // Auto-detect common feed patterns
    if (url.includes('feed') || url.includes('.xml') || url.includes('.rss')) {
      setSourceType('url');
    } else if (url.includes('api')) {
      setSourceType('api');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Choose Your Data Source</h3>
        <p className="text-[#999] text-sm">
          Select how you want to import your product catalog. We support multiple formats and
          sources.
        </p>
      </div>

      <Tabs value={sourceType} onValueChange={setSourceType} className="w-full">
        <TabsList className="grid w-full grid-cols-5 bg-[#1a1a1a] border-[#2a2a2a]">
          <TabsTrigger value="url" className="data-[state=active]:bg-[#2a2a2a]">
            <Link className="w-4 h-4 mr-2" />
            Feed URL
          </TabsTrigger>
          <TabsTrigger value="file" className="data-[state=active]:bg-[#2a2a2a]">
            <Upload className="w-4 h-4 mr-2" />
            Upload
          </TabsTrigger>
          <TabsTrigger value="google" className="data-[state=active]:bg-[#2a2a2a]">
            <ShoppingBag className="w-4 h-4 mr-2" />
            Google
          </TabsTrigger>
          <TabsTrigger value="api" className="data-[state=active]:bg-[#2a2a2a]">
            <Globe className="w-4 h-4 mr-2" />
            API
          </TabsTrigger>
          <TabsTrigger value="database" className="data-[state=active]:bg-[#2a2a2a]">
            <Database className="w-4 h-4 mr-2" />
            Database
          </TabsTrigger>
        </TabsList>

        <TabsContent value="url" className="space-y-4 mt-6">
          <Card className="p-6 bg-[#1a1a1a] border-[#2a2a2a]">
            <div className="space-y-4">
              <div>
                <Label htmlFor="feed-url">Product Feed URL</Label>
                <Input
                  id="feed-url"
                  type="url"
                  placeholder="https://example.com/products.xml"
                  value={sourceUrl}
                  onChange={(e) => {
                    setSourceUrl(e.target.value);
                    detectSourceType(e.target.value);
                  }}
                  className="mt-2 bg-[#0a0a0a] border-[#2a2a2a] text-white"
                />
                <p className="text-xs text-[#666] mt-2">Supports XML, JSON, CSV, RSS feeds</p>
              </div>

              <Alert className="bg-[#0a0a0a] border-[#2a2a2a]">
                <Sparkles className="h-4 w-4 text-[#10a37f]" />
                <AlertDescription className="text-[#999]">
                  <strong className="text-white">Smart Detection:</strong> We'll automatically
                  detect your feed format and structure.
                </AlertDescription>
              </Alert>

              <div className="pt-2">
                <p className="text-xs text-[#666] mb-3">Popular feed formats:</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="justify-start bg-[#0a0a0a] hover:bg-[#1a1a1a] border-[#2a2a2a] text-xs"
                    onClick={() => setSourceUrl('https://example.com/google-merchant.xml')}
                  >
                    <FileSpreadsheet className="w-3 h-3 mr-2" />
                    Google Shopping Feed
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="justify-start bg-[#0a0a0a] hover:bg-[#1a1a1a] border-[#2a2a2a] text-xs"
                    onClick={() => setSourceUrl('https://example.com/products.json')}
                  >
                    <FileSpreadsheet className="w-3 h-3 mr-2" />
                    JSON Product Array
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="file" className="space-y-4 mt-6">
          <Card className="p-6 bg-[#1a1a1a] border-[#2a2a2a]">
            <div className="space-y-4">
              <div>
                <Label htmlFor="file-upload">Upload Product File</Label>
                <div className="mt-2">
                  <Input
                    id="file-upload"
                    type="file"
                    accept=".json,.xml,.csv,.xlsx,.xls"
                    onChange={handleFileChange}
                    className="bg-[#0a0a0a] border-[#2a2a2a] text-white file:bg-[#2a2a2a] file:text-white"
                  />
                </div>
                {file && (
                  <div className="mt-3 p-3 bg-[#0a0a0a] rounded-lg border border-[#2a2a2a]">
                    <p className="text-sm text-white">{file.name}</p>
                    <p className="text-xs text-[#666]">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                )}
              </div>

              <Alert className="bg-[#0a0a0a] border-[#2a2a2a]">
                <Info className="h-4 w-4 text-[#10a37f]" />
                <AlertDescription className="text-[#999]">
                  Maximum file size: 100MB. For larger files, use URL or API import.
                </AlertDescription>
              </Alert>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="google" className="space-y-4 mt-6">
          <Card className="p-6 bg-[#1a1a1a] border-[#2a2a2a]">
            <div className="space-y-4 text-center">
              <ShoppingBag className="w-12 h-12 mx-auto text-[#10a37f]" />
              <h4 className="text-lg font-semibold">Connect Google Merchant Center</h4>
              <p className="text-[#999] text-sm max-w-md mx-auto">
                Import products directly from your Google Merchant Center account with automatic
                updates.
              </p>
              <Button className="bg-[#10a37f] hover:bg-[#0e8a6b] text-white">
                <ShoppingBag className="w-4 h-4 mr-2" />
                Connect Google Account
              </Button>
              <p className="text-xs text-[#666]">Requires Google Merchant Center access</p>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="api" className="space-y-4 mt-6">
          <Card className="p-6 bg-[#1a1a1a] border-[#2a2a2a]">
            <div className="space-y-4">
              <div>
                <Label htmlFor="api-url">API Endpoint</Label>
                <Input
                  id="api-url"
                  type="url"
                  placeholder="https://api.example.com/products"
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  className="mt-2 bg-[#0a0a0a] border-[#2a2a2a] text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="api-key">API Key (Optional)</Label>
                  <Input
                    id="api-key"
                    type="password"
                    placeholder="Your API key"
                    className="mt-2 bg-[#0a0a0a] border-[#2a2a2a] text-white"
                  />
                </div>
                <div>
                  <Label htmlFor="api-secret">API Secret (Optional)</Label>
                  <Input
                    id="api-secret"
                    type="password"
                    placeholder="Your API secret"
                    className="mt-2 bg-[#0a0a0a] border-[#2a2a2a] text-white"
                  />
                </div>
              </div>

              <Alert className="bg-[#0a0a0a] border-[#2a2a2a]">
                <Info className="h-4 w-4 text-[#10a37f]" />
                <AlertDescription className="text-[#999]">
                  We support REST APIs with JSON responses. Pagination is handled automatically.
                </AlertDescription>
              </Alert>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="database" className="space-y-4 mt-6">
          <Card className="p-6 bg-[#1a1a1a] border-[#2a2a2a]">
            <div className="space-y-4">
              <div>
                <Label htmlFor="connection-string">Database Connection String</Label>
                <Input
                  id="connection-string"
                  type="text"
                  placeholder="postgresql://user:password@host:port/database"
                  value={connectionString}
                  onChange={(e) => setConnectionString(e.target.value)}
                  className="mt-2 bg-[#0a0a0a] border-[#2a2a2a] text-white font-mono text-sm"
                />
                <p className="text-xs text-[#666] mt-2">
                  Supports PostgreSQL, MySQL, MongoDB, SQL Server
                </p>
              </div>

              <div>
                <Label htmlFor="query">SQL Query (Optional)</Label>
                <textarea
                  id="query"
                  placeholder="SELECT * FROM products"
                  className="mt-2 w-full h-24 bg-[#0a0a0a] border border-[#2a2a2a] text-white rounded-md p-3 font-mono text-sm"
                />
              </div>

              <Alert className="bg-[#0a0a0a] border-[#2a2a2a]">
                <Info className="h-4 w-4 text-yellow-500" />
                <AlertDescription className="text-[#999]">
                  <strong className="text-white">Security:</strong> Connection is encrypted and
                  credentials are never stored.
                </AlertDescription>
              </Alert>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
