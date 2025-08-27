'use client';

import { MetricCard } from './MetricCard';
import { FolderTree, Target, Clock, FileText } from 'lucide-react';

interface StatsGridProps {
  loading?: boolean;
}

export function StatsGrid({ loading = false }: StatsGridProps) {
  const metrics = [
    {
      title: 'Total Categories',
      value: 1234,
      change: 12,
      changeType: 'increase' as const,
      icon: FolderTree,
      description: 'Across all taxonomies',
    },
    {
      title: 'Coverage',
      value: '67%',
      change: 5,
      changeType: 'increase' as const,
      icon: Target,
      description: 'Content coverage rate',
    },
    {
      title: 'Pending Review',
      value: 42,
      change: -8,
      changeType: 'decrease' as const,
      icon: Clock,
      description: 'Items awaiting approval',
    },
    {
      title: 'Published Content',
      value: 892,
      change: 23,
      changeType: 'increase' as const,
      icon: FileText,
      description: 'Live content pieces',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
      {metrics.map((metric) => (
        <MetricCard
          key={metric.title}
          title={metric.title}
          value={metric.value}
          change={metric.change}
          changeType={metric.changeType}
          icon={metric.icon}
          description={metric.description}
          loading={loading}
        />
      ))}
    </div>
  );
}
