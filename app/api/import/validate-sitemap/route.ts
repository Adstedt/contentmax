import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: 'Sitemap URL is required' },
        { status: 400 }
      );
    }

    // Validate URL format
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    // Fetch the sitemap
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'ContentMax/1.0 (Sitemap Validator)',
        'Accept': 'application/xml, text/xml, */*',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch sitemap: ${response.status} ${response.statusText}` },
        { status: 400 }
      );
    }

    const contentType = response.headers.get('content-type');
    const text = await response.text();

    // Check if it's XML
    if (!text.includes('<?xml') && !text.includes('<urlset') && !text.includes('<sitemapindex')) {
      return NextResponse.json(
        { error: 'Invalid sitemap format. Expected XML sitemap.' },
        { status: 400 }
      );
    }

    // Parse the sitemap to extract URLs
    const urlMatches = text.matchAll(/<loc>(.*?)<\/loc>/g);
    const urls: string[] = [];
    
    for (const match of urlMatches) {
      urls.push(match[1]);
    }

    // Categorize URLs
    const categories = {
      products: 0,
      categories: 0,
      brands: 0,
      content: 0,
      other: 0,
    };

    for (const urlStr of urls) {
      const lowerUrl = urlStr.toLowerCase();
      
      if (lowerUrl.includes('/product') || lowerUrl.includes('/produkt')) {
        categories.products++;
      } else if (lowerUrl.includes('/category') || lowerUrl.includes('/kategori')) {
        categories.categories++;
      } else if (lowerUrl.includes('/brand') || lowerUrl.includes('/varumarke')) {
        categories.brands++;
      } else if (lowerUrl.includes('/blog') || lowerUrl.includes('/article') || lowerUrl.includes('/guide')) {
        categories.content++;
      } else {
        categories.other++;
      }
    }

    // Check for nested sitemaps
    const sitemapMatches = text.matchAll(/<sitemap>[\s\S]*?<loc>(.*?)<\/loc>[\s\S]*?<\/sitemap>/g);
    const nestedSitemaps: string[] = [];
    
    for (const match of sitemapMatches) {
      nestedSitemaps.push(match[1]);
    }

    const preview = {
      totalUrls: urls.length,
      categories,
      sampleUrls: urls.slice(0, 5),
      domain: parsedUrl.hostname,
      isIndex: nestedSitemaps.length > 0,
      nestedSitemaps: nestedSitemaps.slice(0, 5),
    };

    return NextResponse.json({ 
      success: true,
      preview 
    });

  } catch (error) {
    console.error('Sitemap validation error:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to validate sitemap',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}