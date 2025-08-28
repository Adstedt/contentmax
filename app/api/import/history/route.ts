import { NextRequest, NextResponse } from 'next/server';

// Mock data for now - replace with database later
const mockHistory = [
  {
    id: 'import-1',
    source: 'sitemap',
    url: 'https://example.com/sitemap.xml',
    status: 'completed',
    totalUrls: 1250,
    processedUrls: 1250,
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    completedAt: new Date(Date.now() - 6.5 * 24 * 60 * 60 * 1000).toISOString(),
    duration: 1800000, // 30 minutes in milliseconds
    summary: {
      categories: 45,
      products: 850,
      brands: 120,
      content: 235,
    },
  },
  {
    id: 'import-2',
    source: 'gsc',
    url: 'Google Search Console',
    status: 'processing',
    totalUrls: 2500,
    processedUrls: 1875,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    completedAt: null,
    duration: null,
    summary: null,
  },
];

export async function GET(request: NextRequest) {
  try {
    // In a real app, fetch from database
    // For now, return mock data
    return NextResponse.json({
      imports: mockHistory,
      total: mockHistory.length,
    });
  } catch (error) {
    console.error('Failed to fetch import history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch import history' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Import ID is required' },
        { status: 400 }
      );
    }

    // In a real app, delete from database
    // For now, just return success
    return NextResponse.json({
      success: true,
      message: `Import ${id} deleted successfully`,
    });
  } catch (error) {
    console.error('Failed to delete import:', error);
    return NextResponse.json(
      { error: 'Failed to delete import' },
      { status: 500 }
    );
  }
}