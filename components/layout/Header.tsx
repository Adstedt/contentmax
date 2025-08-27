'use client';

import { UserDropdown } from './UserDropdown';

interface HeaderProps {
  title?: string;
  subtitle?: string;
}

export function Header({ title = 'Dashboard', subtitle }: HeaderProps) {
  return (
    <header className="bg-[#0a0a0a] border-b border-[#1a1a1a] px-6 py-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-medium text-white">{title}</h2>
          {subtitle && (
            <p className="mt-0.5 text-sm text-[#999]">{subtitle}</p>
          )}
        </div>
        <UserDropdown />
      </div>
    </header>
  );
}