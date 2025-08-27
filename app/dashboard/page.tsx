import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { StatsGrid } from '@/components/dashboard/StatsGrid';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { QuickActions } from '@/components/dashboard/QuickActions';

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  return (
    <div className="flex-1 flex flex-col bg-[#000]">
      <Header 
        title="Dashboard" 
        subtitle="Welcome back! Here's an overview of your content performance."
      />
      
      <main className="flex-1 p-6 overflow-y-auto">
        {/* Stats Grid */}
        <StatsGrid />

        {/* Main Content Grid */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Activity - Takes up 2 columns on large screens */}
          <div className="lg:col-span-2">
            <RecentActivity />
          </div>
          
          {/* Quick Actions - Takes up 1 column on large screens */}
          <div className="lg:col-span-1">
            <QuickActions />
          </div>
        </div>

        {/* Welcome Message for First Time Users */}
        <div className="mt-8 bg-gradient-to-r from-[#10a37f] to-[#0e906d] rounded-lg p-6 text-white">
          <h2 className="text-2xl font-bold mb-2">Getting Started with ContentMax</h2>
          <p className="text-white/90 mb-4">
            Transform your content strategy with AI-powered generation and management.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="bg-white bg-opacity-10 backdrop-blur rounded-lg p-4">
              <h3 className="font-semibold mb-1">1. Import Your Site</h3>
              <p className="text-sm text-white/80">Upload sitemap to analyze structure</p>
            </div>
            <div className="bg-white bg-opacity-10 backdrop-blur rounded-lg p-4">
              <h3 className="font-semibold mb-1">2. Generate Content</h3>
              <p className="text-sm text-white/80">AI creates optimized content</p>
            </div>
            <div className="bg-white bg-opacity-10 backdrop-blur rounded-lg p-4">
              <h3 className="font-semibold mb-1">3. Review & Publish</h3>
              <p className="text-sm text-white/80">Approve and deploy at scale</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}