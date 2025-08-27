'use client';

import { Clock, FileText, CheckCircle, AlertCircle } from 'lucide-react';

interface ActivityItem {
  id: string;
  type: 'content_created' | 'content_published' | 'review_completed' | 'alert';
  title: string;
  description: string;
  timestamp: string;
  user?: string;
}

const mockActivities: ActivityItem[] = [
  {
    id: '1',
    type: 'content_published',
    title: 'Blog Post Published',
    description: 'Ultimate Guide to Content Marketing Strategy',
    timestamp: '2 hours ago',
    user: 'Sarah Johnson'
  },
  {
    id: '2',
    type: 'review_completed',
    title: 'Review Completed',
    description: '5 articles reviewed and approved',
    timestamp: '4 hours ago',
    user: 'Mike Chen'
  },
  {
    id: '3',
    type: 'content_created',
    title: 'New Content Generated',
    description: '12 new product descriptions created',
    timestamp: '6 hours ago',
    user: 'AI Assistant'
  },
  {
    id: '4',
    type: 'alert',
    title: 'Low Coverage Alert',
    description: 'Electronics category at 45% coverage',
    timestamp: '8 hours ago'
  },
  {
    id: '5',
    type: 'content_published',
    title: 'Landing Page Updated',
    description: 'Summer Sale 2024 campaign page',
    timestamp: '1 day ago',
    user: 'Emily Davis'
  }
];

export function RecentActivity() {
  const getActivityIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'content_created':
        return <FileText className="h-5 w-5 text-[#3b82f6]" />;
      case 'content_published':
        return <CheckCircle className="h-5 w-5 text-[#10a37f]" />;
      case 'review_completed':
        return <Clock className="h-5 w-5 text-[#a855f7]" />;
      case 'alert':
        return <AlertCircle className="h-5 w-5 text-[#eab308]" />;
    }
  };

  const getActivityColor = (type: ActivityItem['type']) => {
    switch (type) {
      case 'content_created':
        return 'bg-[#3b82f6]/10';
      case 'content_published':
        return 'bg-[#10a37f]/10';
      case 'review_completed':
        return 'bg-[#a855f7]/10';
      case 'alert':
        return 'bg-[#eab308]/10';
    }
  };

  return (
    <div className="bg-[#0a0a0a] rounded-lg border border-[#1a1a1a]">
      <div className="px-6 py-4 border-b border-[#1a1a1a]">
        <h3 className="text-lg font-medium text-white">Recent Activity</h3>
      </div>
      <div className="divide-y divide-[#1a1a1a]">
        {mockActivities.map((activity) => (
          <div key={activity.id} className="px-6 py-4 hover:bg-[#111] transition-colors">
            <div className="flex items-start space-x-3">
              <div className={`flex-shrink-0 p-2 rounded-lg ${getActivityColor(activity.type)}`}>
                {getActivityIcon(activity.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">{activity.title}</p>
                <p className="text-sm text-[#999]">{activity.description}</p>
                <div className="mt-1 flex items-center space-x-2 text-xs text-[#666]">
                  <span>{activity.timestamp}</span>
                  {activity.user && (
                    <>
                      <span>•</span>
                      <span>{activity.user}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="px-6 py-3 border-t border-[#1a1a1a]">
        <button className="text-sm text-[#10a37f] hover:text-[#0e906d] font-medium transition-colors">
          View all activity →
        </button>
      </div>
    </div>
  );
}