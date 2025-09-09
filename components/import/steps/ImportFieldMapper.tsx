'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowRight, CheckCircle2, Info } from 'lucide-react';

interface ImportFieldMapperProps {
  data: any;
  allData: any;
  onDataChange: (data: any) => void;
  onValidation: (isValid: boolean) => void;
}

const REQUIRED_FIELDS = [
  { key: 'id', label: 'Product ID', required: true },
  { key: 'title', label: 'Product Title', required: true },
  { key: 'category', label: 'Category', required: true },
  { key: 'price', label: 'Price', required: true },
  { key: 'description', label: 'Description', required: false },
  { key: 'image', label: 'Image URL', required: false },
  { key: 'brand', label: 'Brand', required: false },
  { key: 'sku', label: 'SKU', required: false },
];

export function ImportFieldMapper({
  data,
  allData,
  onDataChange,
  onValidation,
}: ImportFieldMapperProps) {
  const [mappings, setMappings] = useState<Record<string, string>>(data.mappings || {});
  const [autoMapped, setAutoMapped] = useState(false);

  // Mock source fields from the data
  const sourceFields = [
    'product_id',
    'name',
    'product_type',
    'price',
    'description',
    'image_link',
    'brand',
    'gtin',
    'availability',
    'condition',
  ];

  useEffect(() => {
    if (!autoMapped && Object.keys(mappings).length === 0) {
      autoMapFields();
    }
  }, []);

  useEffect(() => {
    // Validate that all required fields are mapped
    const requiredFieldsMapped = REQUIRED_FIELDS.filter((f) => f.required).every(
      (field) => mappings[field.key]
    );

    onValidation(requiredFieldsMapped);
    onDataChange({ mappings });
  }, [mappings, onDataChange, onValidation]);

  const autoMapFields = () => {
    const autoMappings: Record<string, string> = {};

    // Smart mapping based on common field names
    const mappingRules: Record<string, string[]> = {
      id: ['product_id', 'id', 'sku', 'gtin'],
      title: ['name', 'title', 'product_name'],
      category: ['product_type', 'category', 'product_category'],
      price: ['price', 'cost', 'amount'],
      description: ['description', 'desc', 'product_description'],
      image: ['image_link', 'image', 'image_url'],
      brand: ['brand', 'manufacturer', 'brand_name'],
      sku: ['gtin', 'sku', 'product_sku'],
    };

    Object.entries(mappingRules).forEach(([targetField, possibleSourceFields]) => {
      const match = sourceFields.find((sourceField) =>
        possibleSourceFields.some((possible) =>
          sourceField.toLowerCase().includes(possible.toLowerCase())
        )
      );
      if (match) {
        autoMappings[targetField] = match;
      }
    });

    setMappings(autoMappings);
    setAutoMapped(true);
  };

  const handleMappingChange = (targetField: string, sourceField: string) => {
    setMappings((prev) => ({
      ...prev,
      [targetField]: sourceField,
    }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Map Your Fields</h3>
        <p className="text-[#999] text-sm">
          Map your source data fields to our product schema. Required fields must be mapped to
          continue.
        </p>
      </div>

      {autoMapped && (
        <Alert className="bg-[#0a0a0a] border-[#10a37f]/20">
          <CheckCircle2 className="h-4 w-4 text-[#10a37f]" />
          <AlertDescription className="text-[#999]">
            We've automatically mapped your fields based on common patterns. Review and adjust as
            needed.
          </AlertDescription>
        </Alert>
      )}

      <Card className="p-6 bg-[#1a1a1a] border-[#2a2a2a]">
        <div className="space-y-4">
          {REQUIRED_FIELDS.map((field) => (
            <div key={field.key} className="flex items-center gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium flex items-center gap-2">
                  {field.label}
                  {field.required && <span className="text-red-500">*</span>}
                </label>
                {!field.required && <p className="text-xs text-[#666] mt-1">Optional</p>}
              </div>

              <ArrowRight className="h-4 w-4 text-[#666]" />

              <div className="flex-1">
                <Select
                  value={mappings[field.key] || ''}
                  onValueChange={(value) => handleMappingChange(field.key, value)}
                >
                  <SelectTrigger className="bg-[#0a0a0a] border-[#2a2a2a]">
                    <SelectValue placeholder="Select source field" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0a0a0a] border-[#2a2a2a]">
                    <SelectItem value="">None</SelectItem>
                    {sourceFields.map((sourceField) => (
                      <SelectItem key={sourceField} value={sourceField}>
                        {sourceField}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Alert className="bg-[#0a0a0a] border-[#2a2a2a]">
        <Info className="h-4 w-4 text-[#10a37f]" />
        <AlertDescription className="text-[#999]">
          <strong className="text-white">Tip:</strong> If your data doesn't have separate category
          fields, we'll extract categories from product URLs or generate them using AI.
        </AlertDescription>
      </Alert>

      <div className="flex gap-4">
        <Button
          variant="outline"
          onClick={autoMapFields}
          className="bg-[#0a0a0a] hover:bg-[#1a1a1a] border-[#2a2a2a]"
        >
          Auto-map Fields
        </Button>
      </div>
    </div>
  );
}
