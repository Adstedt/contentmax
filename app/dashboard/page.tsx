import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold">ContentMax Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">{user.email}</span>
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="border-4 border-dashed border-gray-200 rounded-lg h-96 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Welcome to ContentMax!
            </h2>
            <p className="text-gray-600 mb-4">
              You&apos;re successfully logged in as: <span className="font-semibold">{user.email}</span>
            </p>
            <div className="bg-blue-50 p-4 rounded-md">
              <h3 className="text-lg font-semibold text-blue-900 mb-2">
                Getting Started
              </h3>
              <ul className="list-disc list-inside text-blue-800 space-y-1">
                <li>Import your website sitemap to analyze content structure</li>
                <li>Scrape and analyze existing content</li>
                <li>Generate new content using AI</li>
                <li>Visualize your content taxonomy</li>
                <li>Manage templates and components</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}