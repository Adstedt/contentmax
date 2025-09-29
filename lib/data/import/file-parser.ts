import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export interface ParsedData {
  headers: string[];
  rows: any[];
  totalRows: number;
  errors?: string[];
}

export interface FileParserOptions {
  maxRows?: number;
  encoding?: string;
  delimiter?: string;
  hasHeaders?: boolean;
}

export class FileParser {
  static async parseFile(
    file: File,
    options: FileParserOptions = {}
  ): Promise<ParsedData> {
    const fileExtension = file.name.split('.').pop()?.toLowerCase();

    switch (fileExtension) {
      case 'csv':
        return this.parseCSV(file, options);
      case 'xlsx':
      case 'xls':
        return this.parseExcel(file, options);
      case 'json':
        return this.parseJSON(file, options);
      default:
        throw new Error(`Unsupported file format: ${fileExtension}`);
    }
  }

  private static parseCSV(
    file: File,
    options: FileParserOptions
  ): Promise<ParsedData> {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: options.hasHeaders !== false,
        delimiter: options.delimiter,
        encoding: options.encoding || 'UTF-8',
        skipEmptyLines: true,
        preview: options.maxRows,
        complete: (results) => {
          if (results.errors.length > 0) {
            console.warn('CSV parsing warnings:', results.errors);
          }

          const data = results.data as any[];
          const headers = options.hasHeaders !== false
            ? Object.keys(data[0] || {})
            : this.generateHeaders(data[0]?.length || 0);

          resolve({
            headers,
            rows: data,
            totalRows: data.length,
            errors: results.errors.map(e => e.message),
          });
        },
        error: (error) => {
          reject(new Error(`CSV parsing failed: ${error.message}`));
        },
      });
    });
  }

  private static async parseExcel(
    file: File,
    options: FileParserOptions
  ): Promise<ParsedData> {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    
    // Get the first worksheet
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    // Convert to JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      header: options.hasHeaders === false ? 1 : undefined,
      defval: '',
    });

    if (jsonData.length === 0) {
      return {
        headers: [],
        rows: [],
        totalRows: 0,
      };
    }

    // Extract headers
    const headers = options.hasHeaders !== false
      ? Object.keys(jsonData[0] as any)
      : this.generateHeaders(Object.keys(jsonData[0] as any).length);

    // Apply max rows limit if specified
    const rows = options.maxRows
      ? jsonData.slice(0, options.maxRows)
      : jsonData;

    return {
      headers,
      rows: rows as any[],
      totalRows: jsonData.length,
    };
  }

  private static async parseJSON(
    file: File,
    options: FileParserOptions
  ): Promise<ParsedData> {
    const text = await file.text();
    
    try {
      const data = JSON.parse(text);
      
      // Handle different JSON structures
      let rows: any[];
      
      if (Array.isArray(data)) {
        rows = data;
      } else if (data.products && Array.isArray(data.products)) {
        rows = data.products;
      } else if (data.items && Array.isArray(data.items)) {
        rows = data.items;
      } else if (data.data && Array.isArray(data.data)) {
        rows = data.data;
      } else {
        // Single object, wrap in array
        rows = [data];
      }

      if (rows.length === 0) {
        return {
          headers: [],
          rows: [],
          totalRows: 0,
        };
      }

      // Extract headers from first object
      const headers = Object.keys(rows[0]);

      // Apply max rows limit if specified
      const limitedRows = options.maxRows
        ? rows.slice(0, options.maxRows)
        : rows;

      return {
        headers,
        rows: limitedRows,
        totalRows: rows.length,
      };
    } catch (error) {
      throw new Error(`JSON parsing failed: ${error instanceof Error ? error.message : 'Invalid JSON'}`);
    }
  }

  private static generateHeaders(count: number): string[] {
    const headers: string[] = [];
    for (let i = 0; i < count; i++) {
      headers.push(`Column ${i + 1}`);
    }
    return headers;
  }

  static detectDelimiter(text: string): string {
    const delimiters = [',', ';', '\t', '|'];
    const firstLine = text.split('\n')[0];
    
    let maxCount = 0;
    let detectedDelimiter = ',';

    for (const delimiter of delimiters) {
      const count = (firstLine.match(new RegExp(`\\${delimiter}`, 'g')) || []).length;
      if (count > maxCount) {
        maxCount = count;
        detectedDelimiter = delimiter;
      }
    }

    return detectedDelimiter;
  }

  static async validateFile(file: File): Promise<{ valid: boolean; error?: string }> {
    // Check file size (100MB limit)
    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      return {
        valid: false,
        error: `File size exceeds 100MB limit (${(file.size / 1024 / 1024).toFixed(2)}MB)`,
      };
    }

    // Check file extension
    const validExtensions = ['csv', 'xlsx', 'xls', 'json'];
    const extension = file.name.split('.').pop()?.toLowerCase();
    
    if (!extension || !validExtensions.includes(extension)) {
      return {
        valid: false,
        error: `Invalid file format. Supported formats: ${validExtensions.join(', ')}`,
      };
    }

    // Try to parse a preview
    try {
      await this.parseFile(file, { maxRows: 10 });
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Failed to parse file',
      };
    }
  }

  static analyzeDataTypes(rows: any[], headers: string[]): Record<string, DataTypeInfo> {
    const analysis: Record<string, DataTypeInfo> = {};

    headers.forEach(header => {
      const values = rows.map(row => row[header]).filter(v => v != null && v !== '');
      
      if (values.length === 0) {
        analysis[header] = { type: 'empty', nullable: true };
        return;
      }

      const types = {
        number: 0,
        date: 0,
        url: 0,
        email: 0,
        boolean: 0,
        string: 0,
      };

      values.forEach(value => {
        const strValue = String(value);
        
        // Check for number
        if (!isNaN(Number(strValue)) && strValue !== '') {
          types.number++;
        }
        // Check for URL
        else if (/^https?:\/\//.test(strValue)) {
          types.url++;
        }
        // Check for email
        else if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(strValue)) {
          types.email++;
        }
        // Check for boolean
        else if (['true', 'false', 'yes', 'no', '0', '1'].includes(strValue.toLowerCase())) {
          types.boolean++;
        }
        // Check for date
        else if (!isNaN(Date.parse(strValue))) {
          types.date++;
        }
        // Default to string
        else {
          types.string++;
        }
      });

      // Determine primary type
      const primaryType = Object.entries(types).reduce((a, b) => 
        types[a[0] as keyof typeof types] > types[b[0] as keyof typeof types] ? a : b
      )[0] as DataType;

      analysis[header] = {
        type: primaryType,
        nullable: values.length < rows.length,
        uniqueValues: new Set(values).size,
        sampleValues: values.slice(0, 5),
      };
    });

    return analysis;
  }
}

export type DataType = 'string' | 'number' | 'date' | 'url' | 'email' | 'boolean' | 'empty';

export interface DataTypeInfo {
  type: DataType;
  nullable: boolean;
  uniqueValues?: number;
  sampleValues?: any[];
}