'use client';

import React from 'react';
import { LoadingProgress, LoadingLevel } from '@/lib/visualization/progressive-loader';

export interface LoadingIndicatorProps {
  progress: LoadingProgress;
  className?: string;
}

const getLevelLabel = (level: LoadingLevel): string => {
  switch (level) {
    case 'core':
      return 'Loading Core Nodes';
    case 'viewport':
      return 'Loading Viewport';
    case 'connected':
      return 'Loading Connected Nodes';
    case 'all':
      return 'Loading All Nodes';
    default:
      return 'Loading';
  }
};

const getLevelColor = (level: LoadingLevel): string => {
  switch (level) {
    case 'core':
      return '#10a37f';
    case 'viewport':
      return '#0e906d';
    case 'connected':
      return '#0d7a5f';
    case 'all':
      return '#0b6550';
    default:
      return '#10a37f';
  }
};

export function LoadingIndicator({ progress, className = '' }: LoadingIndicatorProps) {
  if (progress.isComplete) {
    return null;
  }

  const levelColor = getLevelColor(progress.level);
  const levelLabel = getLevelLabel(progress.level);

  return (
    <div
      className={`absolute bottom-4 right-4 p-3 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg ${className}`}
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs text-[#999] font-medium">{levelLabel}</span>
          <span className="text-xs text-white font-mono">
            {progress.loaded.toLocaleString()} / {progress.total.toLocaleString()}
          </span>
        </div>

        <div className="relative w-48 h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
          <div
            className="absolute top-0 left-0 h-full transition-all duration-300 ease-out rounded-full"
            style={{
              width: `${progress.percentage}%`,
              backgroundColor: levelColor,
            }}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <div
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ backgroundColor: levelColor }}
            />
            <span className="text-xs text-[#666] font-mono">{progress.percentage}%</span>
          </div>

          {progress.level !== 'all' && (
            <span className="text-xs text-[#666]">
              {progress.level === 'core' && 'Essential nodes'}
              {progress.level === 'viewport' && 'Visible area'}
              {progress.level === 'connected' && 'Related nodes'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
