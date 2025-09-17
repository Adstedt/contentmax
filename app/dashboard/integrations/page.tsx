'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function IntegrationsPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the settings page with integrations tab
    router.replace('/dashboard/settings?tab=integrations');
  }, [router]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="text-center">
        <div className="animate-pulse">
          <div className="h-8 w-8 border-2 border-[#10a37f] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#999]">Redirecting to Settings...</p>
        </div>
      </div>
    </div>
  );
}
