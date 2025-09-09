'use client';

import { useState, useEffect } from 'react';
import { User, Database, Users, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProfileTab } from './tabs/ProfileTab';
import { DataSourcesTab } from './tabs/DataSourcesTab';
import { TeamTab } from './tabs/TeamTab';
import { BillingTab } from './tabs/BillingTab';

interface SettingsTab {
  id: string;
  label: string;
  icon: React.ElementType;
  content: React.ComponentType;
}

const tabs: SettingsTab[] = [
  { id: 'profile', label: 'Profile', icon: User, content: ProfileTab },
  { id: 'data-sources', label: 'Data Sources', icon: Database, content: DataSourcesTab },
  { id: 'team', label: 'Team', icon: Users, content: TeamTab },
  { id: 'billing', label: 'Billing', icon: CreditCard, content: BillingTab },
];

export function SettingsLayout() {
  const [activeTab, setActiveTab] = useState('profile');

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const currentIndex = tabs.findIndex((tab) => tab.id === activeTab);

        if (e.key === 'ArrowLeft' && currentIndex > 0) {
          setActiveTab(tabs[currentIndex - 1].id);
        } else if (e.key === 'ArrowRight' && currentIndex < tabs.length - 1) {
          setActiveTab(tabs[currentIndex + 1].id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab]);

  const ActiveContent = tabs.find((tab) => tab.id === activeTab)?.content || ProfileTab;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-[#999] mt-2">Manage your account and preferences</p>
        </div>

        {/* Tabs Navigation */}
        <div className="mb-8">
          <div className="border-b border-[#2a2a2a]">
            <nav className="-mb-px flex flex-wrap gap-x-8" aria-label="Settings tabs">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-all duration-200',
                      isActive
                        ? 'border-[#10a37f] text-white'
                        : 'border-transparent text-[#999] hover:text-white hover:border-[#666]'
                    )}
                    role="tab"
                    aria-selected={isActive}
                    aria-controls={`tabpanel-${tab.id}`}
                  >
                    <Icon
                      className={cn(
                        'mr-2 h-5 w-5 transition-colors',
                        isActive ? 'text-[#10a37f]' : 'text-[#666] group-hover:text-[#999]'
                      )}
                    />
                    <span className="hidden sm:inline">{tab.label}</span>
                    <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div
          className="bg-[#0a0a0a] rounded-lg"
          role="tabpanel"
          id={`tabpanel-${activeTab}`}
          aria-labelledby={`tab-${activeTab}`}
        >
          <ActiveContent />
        </div>
      </div>
    </div>
  );
}
