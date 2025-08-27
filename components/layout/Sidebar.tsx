'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  GitBranch,
  Sparkles,
  CheckCircle,
  Layers,
  Settings,
  Menu,
  X,
  FileText,
  Database
} from 'lucide-react';
import { useState } from 'react';

const navigation = [
  { name: 'Exploring', href: '/dashboard', icon: Home },
  { name: 'Generate', href: '/generate', icon: Sparkles },
  { name: 'Content', href: '/content', icon: FileText },
  { name: 'Taxonomy', href: '/taxonomy', icon: GitBranch },
  { name: 'Review', href: '/review', icon: CheckCircle },
  { name: 'Database', href: '/database', icon: Database },
];

const bottomNavigation = [
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-md bg-[#0a0a0a] border border-[#2a2a2a]"
      >
        {isMobileMenuOpen ? (
          <X className="h-5 w-5 text-white" />
        ) : (
          <Menu className="h-5 w-5 text-white" />
        )}
      </button>

      {/* Mobile menu overlay */}
      {isMobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black bg-opacity-50 backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          fixed inset-y-0 left-0 z-40 w-[240px] bg-[#0a0a0a] border-r border-[#1a1a1a]
          transform transition-transform duration-300 ease-in-out
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0 md:static md:inset-0
        `}
      >
        {/* Logo */}
        <div className="h-14 flex items-center px-4 border-b border-[#1a1a1a]">
          <h1 className="text-base font-medium text-white">ContentMax</h1>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            const isComingSoon = item.href !== '/dashboard';

            return (
              <Link
                key={item.name}
                href={isComingSoon ? '#' : item.href}
                onClick={(e) => {
                  if (isComingSoon) e.preventDefault();
                  else setIsMobileMenuOpen(false);
                }}
                className={`
                  flex items-center px-3 py-2 text-sm rounded-md
                  transition-all duration-150
                  ${
                    isActive
                      ? 'bg-[#1a1a1a] text-white'
                      : isComingSoon
                      ? 'text-[#666] cursor-not-allowed'
                      : 'text-[#999] hover:text-white hover:bg-[#1a1a1a]'
                  }
                `}
              >
                <Icon className="mr-3 h-4 w-4" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom Navigation */}
        <div className="border-t border-[#1a1a1a] px-2 py-3">
          {bottomNavigation.map((item) => {
            const Icon = item.icon;
            const isComingSoon = true;

            return (
              <Link
                key={item.name}
                href="#"
                onClick={(e) => e.preventDefault()}
                className={`
                  flex items-center px-3 py-2 text-sm rounded-md
                  transition-all duration-150
                  ${isComingSoon ? 'text-[#666] cursor-not-allowed' : 'text-[#999] hover:text-white hover:bg-[#1a1a1a]'}
                `}
              >
                <Icon className="mr-3 h-4 w-4" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}