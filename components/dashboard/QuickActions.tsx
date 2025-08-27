'use client';

import { Plus, Upload, RefreshCw, Search } from 'lucide-react';

export function QuickActions() {
  const actions = [
    {
      title: 'Generate Content',
      description: 'Create new AI-powered content',
      icon: Plus,
      color: 'bg-[#10a37f] hover:bg-[#0e906d] text-white',
      href: '/generate'
    },
    {
      title: 'Import Sitemap',
      description: 'Import from existing website',
      icon: Upload,
      color: 'bg-[#3b82f6] hover:bg-[#2563eb] text-white',
      href: '/import'
    },
    {
      title: 'Sync Taxonomy',
      description: 'Update content structure',
      icon: RefreshCw,
      color: 'bg-[#a855f7] hover:bg-[#9333ea] text-white',
      href: '/taxonomy'
    },
    {
      title: 'Analyze Gaps',
      description: 'Find content opportunities',
      icon: Search,
      color: 'bg-[#eab308] hover:bg-[#ca8a04] text-white',
      href: '/analyze'
    }
  ];

  return (
    <div className="bg-[#0a0a0a] rounded-lg border border-[#1a1a1a]">
      <div className="px-6 py-4 border-b border-[#1a1a1a]">
        <h3 className="text-lg font-medium text-white">Quick Actions</h3>
      </div>
      <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.title}
              className={`flex items-center p-4 rounded-lg ${action.color} transition-colors group relative overflow-hidden`}
              disabled
            >
              <Icon className="h-8 w-8 flex-shrink-0" />
              <div className="ml-4 text-left">
                <p className="text-sm font-medium">{action.title}</p>
                <p className="text-xs opacity-90">{action.description}</p>
              </div>
              <span className="absolute top-2 right-2 text-xs bg-black bg-opacity-20 text-white px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                Soon
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}