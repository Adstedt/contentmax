'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowRight,
  CheckCircle2,
  Info,
  Sparkles,
  AlertCircle,
  RefreshCw,
  Settings,
  Eye,
  Wand2,
} from 'lucide-react';
import { ProcessedFileData } from './FileUploadHandler';

interface SmartFieldMapperProps {
  fileData: ProcessedFileData;
  onMappingComplete: (mapping: FieldMapping) => void;
  onValidation: (isValid: boolean) => void;
}

export interface FieldMapping {
  mappings: Record<string, MappingConfig>;
  transformations: Record<string, TransformationType>;
  customFields: CustomField[];
}

interface MappingConfig {
  sourceField: string;
  confidence: number;
  suggested: boolean;
  dataType?: string;
  sampleValues?: string[];
}

type TransformationType = 'none' | 'lowercase' | 'uppercase' | 'trim' | 'number' | 'date' | 'custom';

interface CustomField {
  name: string;
  formula: string;
  type: string;
}

const PRODUCT_SCHEMA = [
  { key: 'id', label: 'Product ID', required: true, dataType: 'string', description: 'Unique identifier for the product' },
  { key: 'title', label: 'Product Title', required: true, dataType: 'string', description: 'Name of the product' },
  { key: 'description', label: 'Description', required: false, dataType: 'text', description: 'Detailed product description' },
  { key: 'category', label: 'Category', required: true, dataType: 'string', description: 'Product category or type' },
  { key: 'price', label: 'Price', required: true, dataType: 'number', description: 'Product price' },
  { key: 'currency', label: 'Currency', required: false, dataType: 'string', description: 'Price currency (e.g., USD)' },
  { key: 'brand', label: 'Brand', required: false, dataType: 'string', description: 'Product brand or manufacturer' },
  { key: 'sku', label: 'SKU', required: false, dataType: 'string', description: 'Stock keeping unit' },
  { key: 'gtin', label: 'GTIN/EAN/UPC', required: false, dataType: 'string', description: 'Global trade item number' },
  { key: 'image_url', label: 'Image URL', required: false, dataType: 'url', description: 'Product image URL' },
  { key: 'availability', label: 'Availability', required: false, dataType: 'string', description: 'Stock availability' },
  { key: 'condition', label: 'Condition', required: false, dataType: 'string', description: 'Product condition (new/used)' },
  { key: 'link', label: 'Product URL', required: false, dataType: 'url', description: 'Product page URL' },
];

export function SmartFieldMapper({ fileData, onMappingComplete, onValidation }: SmartFieldMapperProps) {
  const [mappings, setMappings] = useState<Record<string, MappingConfig>>({});
  const [transformations, setTransformations] = useState<Record<string, TransformationType>>({});
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [activeTab, setActiveTab] = useState('mapping');
  const [showPreview, setShowPreview] = useState(false);
  const [autoMappingDone, setAutoMappingDone] = useState(false);

  useEffect(() => {
    if (!autoMappingDone && fileData) {
      performSmartMapping();
    }
  }, [fileData]);

  useEffect(() => {
    // Validate mappings
    const requiredFieldsMapped = PRODUCT_SCHEMA
      .filter(field => field.required)
      .every(field => mappings[field.key]?.sourceField);

    onValidation(requiredFieldsMapped);
    onMappingComplete({
      mappings,
      transformations,
      customFields,
    });
  }, [mappings, transformations, customFields]);

  const performSmartMapping = () => {
    const smartMappings: Record<string, MappingConfig> = {};
    const headers = fileData.headers;
    const preview = fileData.preview;

    // Mapping confidence rules
    const mappingRules: Record<string, { patterns: string[], analyzer?: (values: string[]) => number }> = {
      id: {
        patterns: ['id', 'product_id', 'item_id', 'sku', 'code', 'identifier'],
        analyzer: (values) => values.every(v => v && v.length > 0) ? 100 : 50,
      },
      title: {
        patterns: ['title', 'name', 'product_name', 'item_name', 'description_short'],
        analyzer: (values) => {
          const avgLength = values.reduce((sum, v) => sum + (v?.length || 0), 0) / values.length;
          return avgLength > 10 && avgLength < 100 ? 95 : 70;
        },
      },
      description: {
        patterns: ['description', 'desc', 'details', 'product_description', 'long_description'],
        analyzer: (values) => {
          const avgLength = values.reduce((sum, v) => sum + (v?.length || 0), 0) / values.length;
          return avgLength > 50 ? 90 : 60;
        },
      },
      category: {
        patterns: ['category', 'product_type', 'type', 'department', 'collection'],
      },
      price: {
        patterns: ['price', 'cost', 'amount', 'value', 'sale_price'],
        analyzer: (values) => {
          const isNumeric = values.every(v => !isNaN(parseFloat(v?.replace(/[^0-9.-]/g, ''))));
          return isNumeric ? 100 : 30;
        },
      },
      brand: {
        patterns: ['brand', 'manufacturer', 'vendor', 'maker', 'brand_name'],
      },
      sku: {
        patterns: ['sku', 'stock_code', 'item_code', 'product_code'],
      },
      gtin: {
        patterns: ['gtin', 'ean', 'upc', 'barcode', 'isbn'],
      },
      image_url: {
        patterns: ['image', 'image_url', 'image_link', 'picture', 'photo'],
        analyzer: (values) => {
          const hasUrls = values.some(v => v?.includes('http') || v?.includes('.jpg') || v?.includes('.png'));
          return hasUrls ? 95 : 40;
        },
      },
      availability: {
        patterns: ['availability', 'stock', 'in_stock', 'inventory'],
      },
      condition: {
        patterns: ['condition', 'item_condition', 'state'],
      },
      link: {
        patterns: ['link', 'url', 'product_url', 'product_link'],
        analyzer: (values) => {
          const hasUrls = values.every(v => v?.includes('http'));
          return hasUrls ? 100 : 20;
        },
      },
    };

    // Perform intelligent mapping
    PRODUCT_SCHEMA.forEach(targetField => {
      const rules = mappingRules[targetField.key];
      if (!rules) return;

      let bestMatch = null;
      let bestConfidence = 0;

      headers.forEach(header => {
        const headerLower = header.toLowerCase();
        let confidence = 0;

        // Check pattern matching
        const patternMatch = rules.patterns.some(pattern => 
          headerLower.includes(pattern.toLowerCase())
        );

        if (patternMatch) {
          confidence = 70;

          // Exact match gets higher confidence
          if (rules.patterns.some(pattern => headerLower === pattern.toLowerCase())) {
            confidence = 90;
          }

          // Run data analyzer if available
          if (rules.analyzer && preview.length > 0) {
            const sampleValues = preview.map(row => row[header]);
            const dataConfidence = rules.analyzer(sampleValues);
            confidence = Math.min(100, (confidence + dataConfidence) / 2);
          }

          if (confidence > bestConfidence) {
            bestConfidence = confidence;
            bestMatch = header;
          }
        }
      });

      if (bestMatch) {
        smartMappings[targetField.key] = {
          sourceField: bestMatch,
          confidence: bestConfidence,
          suggested: true,
          dataType: targetField.dataType,
          sampleValues: preview.slice(0, 3).map(row => row[bestMatch]),
        };

        // Auto-set transformation based on data type
        if (targetField.dataType === 'number') {
          setTransformations(prev => ({ ...prev, [targetField.key]: 'number' }));
        } else if (targetField.dataType === 'url') {
          setTransformations(prev => ({ ...prev, [targetField.key]: 'trim' }));
        }
      }
    });

    setMappings(smartMappings);
    setAutoMappingDone(true);
  };

  const handleMappingChange = (targetField: string, sourceField: string) => {
    setMappings(prev => ({
      ...prev,
      [targetField]: {
        ...prev[targetField],
        sourceField,
        suggested: false,
      },
    }));
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 90) return { color: 'bg-green-500/20 text-green-500', label: 'High' };
    if (confidence >= 70) return { color: 'bg-yellow-500/20 text-yellow-500', label: 'Medium' };
    return { color: 'bg-orange-500/20 text-orange-500', label: 'Low' };
  };

  const getUnmappedFields = () => {
    const mappedSourceFields = Object.values(mappings).map(m => m.sourceField).filter(Boolean);
    return fileData.headers.filter(h => !mappedSourceFields.includes(h));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold mb-2">Smart Field Mapping</h3>
          <p className="text-[#999] text-sm">
            We've analyzed your data and suggested the best mappings. Review and adjust as needed.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={performSmartMapping}
          className="bg-[#0a0a0a] hover:bg-[#1a1a1a] border-[#2a2a2a]"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Re-analyze
        </Button>
      </div>

      {autoMappingDone && (
        <Alert className="bg-[#0a0a0a] border-[#10a37f]/20">
          <Wand2 className="h-4 w-4 text-[#10a37f]" />
          <AlertDescription className="text-[#999]">
            <strong className="text-white">AI Mapping Complete:</strong> We've automatically mapped{' '}
            {Object.keys(mappings).length} fields based on your data patterns with high confidence.
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 bg-[#1a1a1a] border-[#2a2a2a]">
          <TabsTrigger value="mapping" className="data-[state=active]:bg-[#2a2a2a]">
            <Sparkles className="w-4 h-4 mr-2" />
            Field Mapping
          </TabsTrigger>
          <TabsTrigger value="transform" className="data-[state=active]:bg-[#2a2a2a]">
            <Settings className="w-4 h-4 mr-2" />
            Transformations
          </TabsTrigger>
          <TabsTrigger value="preview" className="data-[state=active]:bg-[#2a2a2a]">
            <Eye className="w-4 h-4 mr-2" />
            Preview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mapping" className="space-y-4 mt-6">
          <Card className="p-6 bg-[#1a1a1a] border-[#2a2a2a]">
            <div className="space-y-4">
              {PRODUCT_SCHEMA.map((field) => {
                const mapping = mappings[field.key];
                const confidence = mapping?.confidence || 0;
                const confidenceBadge = getConfidenceBadge(confidence);

                return (
                  <div key={field.key} className="space-y-2">
                    <div className="flex items-start gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <label className="text-sm font-medium">
                            {field.label}
                          </label>
                          {field.required && <span className="text-red-500 text-xs">Required</span>}
                          {mapping?.suggested && (
                            <Badge variant="outline" className={confidenceBadge.color}>
                              {confidenceBadge.label} Match
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-[#666]">{field.description}</p>
                      </div>

                      <ArrowRight className="h-4 w-4 text-[#666] mt-2" />

                      <div className="flex-1">
                        <Select
                          value={mapping?.sourceField || ''}
                          onValueChange={(value) => handleMappingChange(field.key, value)}
                        >
                          <SelectTrigger className="bg-[#0a0a0a] border-[#2a2a2a]">
                            <SelectValue placeholder="Select source field" />
                          </SelectTrigger>
                          <SelectContent className="bg-[#0a0a0a] border-[#2a2a2a]">
                            <SelectItem value="">None</SelectItem>
                            {fileData.headers.map((header) => (
                              <SelectItem key={header} value={header}>
                                {header}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {mapping?.sampleValues && (
                          <div className="mt-2 text-xs text-[#666]">
                            Sample: {mapping.sampleValues.slice(0, 2).join(', ')}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Unmapped Fields */}
          {getUnmappedFields().length > 0 && (
            <Alert className="bg-[#0a0a0a] border-[#2a2a2a]">
              <Info className="h-4 w-4 text-[#666]" />
              <AlertDescription className="text-[#999]">
                <strong className="text-white">Unmapped columns:</strong>{' '}
                {getUnmappedFields().join(', ')}. These will be ignored during import.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="transform" className="space-y-4 mt-6">
          <Card className="p-6 bg-[#1a1a1a] border-[#2a2a2a]">
            <h4 className="font-medium mb-4">Data Transformations</h4>
            <div className="space-y-4">
              {Object.entries(mappings).map(([field, mapping]) => (
                <div key={field} className="flex items-center gap-4">
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {PRODUCT_SCHEMA.find(f => f.key === field)?.label}
                    </p>
                    <p className="text-xs text-[#666]">{mapping.sourceField}</p>
                  </div>
                  <Select
                    value={transformations[field] || 'none'}
                    onValueChange={(value) => 
                      setTransformations(prev => ({ ...prev, [field]: value as TransformationType }))
                    }
                  >
                    <SelectTrigger className="w-48 bg-[#0a0a0a] border-[#2a2a2a]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0a0a0a] border-[#2a2a2a]">
                      <SelectItem value="none">No transformation</SelectItem>
                      <SelectItem value="trim">Trim whitespace</SelectItem>
                      <SelectItem value="lowercase">Convert to lowercase</SelectItem>
                      <SelectItem value="uppercase">Convert to uppercase</SelectItem>
                      <SelectItem value="number">Parse as number</SelectItem>
                      <SelectItem value="date">Parse as date</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="preview" className="space-y-4 mt-6">
          <Card className="p-6 bg-[#1a1a1a] border-[#2a2a2a] overflow-x-auto">
            <h4 className="font-medium mb-4">Data Preview (First 5 rows)</h4>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a2a2a]">
                  {PRODUCT_SCHEMA.filter(f => mappings[f.key]?.sourceField).map(field => (
                    <th key={field.key} className="text-left p-2 text-[#666]">
                      {field.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fileData.preview.slice(0, 5).map((row, index) => (
                  <tr key={index} className="border-b border-[#2a2a2a]">
                    {PRODUCT_SCHEMA.filter(f => mappings[f.key]?.sourceField).map(field => {
                      const sourceField = mappings[field.key]?.sourceField;
                      const value = sourceField ? row[sourceField] : '';
                      return (
                        <td key={field.key} className="p-2 text-white">
                          {value || '-'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}