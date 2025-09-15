'use client';

import { useState, useCallback, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Download,
  Eye,
  Loader2,
  FileText,
  X,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileUploadHandlerProps {
  onFileProcessed: (data: ProcessedFileData) => void;
  onValidation: (isValid: boolean) => void;
}

export interface ProcessedFileData {
  file: File;
  headers: string[];
  preview: any[];
  totalRows: number;
  fileType: 'csv' | 'excel' | 'json';
  encoding?: string;
  delimiter?: string;
  hasHeaders: boolean;
}

export function FileUploadHandler({ onFileProcessed, onValidation }: FileUploadHandlerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedData, setProcessedData] = useState<ProcessedFileData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const acceptedFormats = {
    'text/csv': ['.csv'],
    'application/vnd.ms-excel': ['.xls'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    'application/json': ['.json'],
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFile(droppedFile);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFile(selectedFile);
    }
  };

  const handleFile = async (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);
    setIsProcessing(true);
    setUploadProgress(0);

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      // Process the file based on type
      const fileExtension = selectedFile.name.split('.').pop()?.toLowerCase();
      let data: ProcessedFileData;

      if (fileExtension === 'csv') {
        data = await processCSV(selectedFile);
      } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        data = await processExcel(selectedFile);
      } else if (fileExtension === 'json') {
        data = await processJSON(selectedFile);
      } else {
        throw new Error('Unsupported file format');
      }

      clearInterval(progressInterval);
      setUploadProgress(100);
      setProcessedData(data);
      onFileProcessed(data);
      onValidation(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process file');
      onValidation(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const processCSV = async (file: File): Promise<ProcessedFileData> => {
    const { FileParser } = await import('@/lib/import/file-parser');
    const parsed = await FileParser.parseFile(file, { maxRows: 100 });
    
    return {
      file,
      headers: parsed.headers,
      preview: parsed.rows.slice(0, 10),
      totalRows: parsed.totalRows,
      fileType: 'csv',
      hasHeaders: true,
    };
  };

  const processExcel = async (file: File): Promise<ProcessedFileData> => {
    const { FileParser } = await import('@/lib/import/file-parser');
    const parsed = await FileParser.parseFile(file, { maxRows: 100 });
    
    return {
      file,
      headers: parsed.headers,
      preview: parsed.rows.slice(0, 10),
      totalRows: parsed.totalRows,
      fileType: 'excel',
      hasHeaders: true,
    };
  };

  const processJSON = async (file: File): Promise<ProcessedFileData> => {
    const { FileParser } = await import('@/lib/import/file-parser');
    const parsed = await FileParser.parseFile(file, { maxRows: 100 });
    
    return {
      file,
      headers: parsed.headers,
      preview: parsed.rows.slice(0, 10),
      totalRows: parsed.totalRows,
      fileType: 'json',
      hasHeaders: true,
    };
  };

  const detectDelimiter = (line: string): string => {
    const delimiters = [',', ';', '\t', '|'];
    let maxCount = 0;
    let detectedDelimiter = ',';

    for (const delimiter of delimiters) {
      const count = (line.match(new RegExp(`\\${delimiter}`, 'g')) || []).length;
      if (count > maxCount) {
        maxCount = count;
        detectedDelimiter = delimiter;
      }
    }

    return detectedDelimiter;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const downloadTemplate = () => {
    const template = `Product ID,Name,Category,Price,Description,Brand,SKU,Image URL
PROD001,Sample Product 1,Electronics,299.99,High-quality electronic device,BrandA,SKU001,https://example.com/image1.jpg
PROD002,Sample Product 2,Clothing,49.99,Comfortable cotton shirt,BrandB,SKU002,https://example.com/image2.jpg`;

    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'product_import_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      {!file && (
        <Card
          className={cn(
            'border-2 border-dashed transition-all duration-200',
            isDragging
              ? 'border-[#10a37f] bg-[#10a37f]/10'
              : 'border-[#2a2a2a] bg-[#1a1a1a] hover:border-[#3a3a3a]'
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="p-12 text-center">
            <Upload className="w-12 h-12 mx-auto mb-4 text-[#666]" />
            <h3 className="text-lg font-semibold mb-2">
              Drop your file here or click to browse
            </h3>
            <p className="text-[#999] text-sm mb-4">
              Supports CSV, Excel (XLS, XLSX), and JSON files up to 100MB
            </p>
            
            <input
              type="file"
              accept=".csv,.xls,.xlsx,.json"
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload">
              <Button className="bg-[#10a37f] hover:bg-[#0e8a6b] text-white cursor-pointer">
                Select File
              </Button>
            </label>

            <div className="mt-6 pt-6 border-t border-[#2a2a2a]">
              <p className="text-xs text-[#666] mb-3">Need help getting started?</p>
              <Button
                variant="outline"
                size="sm"
                onClick={downloadTemplate}
                className="bg-[#0a0a0a] hover:bg-[#1a1a1a] border-[#2a2a2a]"
              >
                <Download className="w-4 h-4 mr-2" />
                Download CSV Template
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* File Processing */}
      {file && isProcessing && (
        <Card className="p-6 bg-[#1a1a1a] border-[#2a2a2a]">
          <div className="flex items-center gap-4 mb-4">
            <FileSpreadsheet className="w-8 h-8 text-[#10a37f]" />
            <div className="flex-1">
              <h4 className="font-medium">{file.name}</h4>
              <p className="text-sm text-[#666]">{formatFileSize(file.size)}</p>
            </div>
            <Loader2 className="w-5 h-5 animate-spin text-[#10a37f]" />
          </div>
          <Progress value={uploadProgress} className="h-2 bg-[#2a2a2a]" />
          <p className="text-sm text-[#666] mt-2">Processing your file...</p>
        </Card>
      )}

      {/* File Processed */}
      {file && processedData && !isProcessing && (
        <Card className="p-6 bg-[#1a1a1a] border-[#2a2a2a]">
          <div className="flex items-center gap-4 mb-4">
            <FileSpreadsheet className="w-8 h-8 text-[#10a37f]" />
            <div className="flex-1">
              <h4 className="font-medium flex items-center gap-2">
                {file.name}
                <CheckCircle2 className="w-4 h-4 text-[#10a37f]" />
              </h4>
              <p className="text-sm text-[#666]">
                {formatFileSize(file.size)} • {processedData.totalRows} rows • {processedData.headers.length} columns
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setFile(null);
                setProcessedData(null);
                onValidation(false);
              }}
              className="hover:bg-[#2a2a2a]"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* File Stats */}
          <div className="grid grid-cols-3 gap-4 p-4 bg-[#0a0a0a] rounded-lg">
            <div>
              <p className="text-xs text-[#666]">Format</p>
              <p className="text-sm font-medium uppercase">{processedData.fileType}</p>
            </div>
            <div>
              <p className="text-xs text-[#666]">Total Rows</p>
              <p className="text-sm font-medium">{processedData.totalRows.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-[#666]">Columns</p>
              <p className="text-sm font-medium">{processedData.headers.length}</p>
            </div>
          </div>

          {/* Detected Headers */}
          <div className="mt-4">
            <p className="text-sm font-medium mb-2">Detected Columns:</p>
            <div className="flex flex-wrap gap-2">
              {processedData.headers.map((header) => (
                <span
                  key={header}
                  className="px-2 py-1 bg-[#0a0a0a] border border-[#2a2a2a] rounded text-xs"
                >
                  {header}
                </span>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Smart Detection Alert */}
      {processedData && (
        <Alert className="bg-[#0a0a0a] border-[#10a37f]/20">
          <Sparkles className="h-4 w-4 text-[#10a37f]" />
          <AlertDescription className="text-[#999]">
            <strong className="text-white">Smart Detection Active:</strong> We'll automatically
            suggest the best field mappings based on your column names and data patterns.
          </AlertDescription>
        </Alert>
      )}

      {/* Error State */}
      {error && (
        <Alert className="bg-red-500/10 border-red-500/20">
          <AlertCircle className="h-4 w-4 text-red-500" />
          <AlertDescription className="text-red-400">
            {error}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}