export interface URLMatchResult {
  url: string;
  matchedUrl: string;
  confidence: number;
  matchType: 'exact' | 'normalized' | 'fuzzy' | 'pattern';
  components: {
    protocol: boolean;
    domain: boolean;
    path: boolean;
    params: boolean;
  };
}

export interface URLMatchOptions {
  ignoreProtocol?: boolean;
  ignoreWww?: boolean;
  ignoreTrailingSlash?: boolean;
  ignoreCase?: boolean;
  ignoreQueryParams?: boolean;
  ignoreFragment?: boolean;
  fuzzyThreshold?: number;
  patternMatching?: boolean;
}

export interface URLPattern {
  name: string;
  pattern: RegExp;
  extractId?: (url: string) => string;
  confidence: number;
}

export interface BatchMatchRequest {
  sourceUrls: string[];
  targetUrls: string[];
  options?: URLMatchOptions;
}

export interface BatchMatchResult {
  matches: URLMatchResult[];
  unmatched: string[];
  statistics: {
    totalSource: number;
    totalMatched: number;
    exactMatches: number;
    normalizedMatches: number;
    fuzzyMatches: number;
    patternMatches: number;
    averageConfidence: number;
  };
}

export interface URLComponents {
  protocol?: string;
  domain?: string;
  subdomain?: string;
  path?: string;
  params?: Record<string, string>;
  fragment?: string;
}

export interface NormalizedURL {
  original: string;
  normalized: string;
  components: URLComponents;
  hash: string;
}