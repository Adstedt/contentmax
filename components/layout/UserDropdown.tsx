'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User, LogOut, Settings, ChevronDown } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export function UserDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    try {
      const response = await fetch('/auth/signout', { method: 'POST' });
      if (response.ok) {
        router.push('/auth/login');
      }
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-3 px-3 py-1.5 rounded-md hover:bg-[#1a1a1a] transition-colors"
      >
        <div className="h-7 w-7 rounded-full bg-[#10a37f] flex items-center justify-center">
          <span className="text-xs font-medium text-white">
            {user?.email?.charAt(0).toUpperCase() || 'U'}
          </span>
        </div>
        <span className="hidden md:block text-sm text-[#999]">
          {user?.email?.split('@')[0] || 'User'}
        </span>
        <ChevronDown className={`h-3 w-3 text-[#666] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] shadow-xl focus:outline-none z-50">
          <div className="px-4 py-3 border-b border-[#2a2a2a]">
            <p className="text-sm font-medium text-white">{user?.email}</p>
            <p className="text-xs text-[#999] mt-0.5">Free tier</p>
          </div>
          
          <div className="py-1">
            <button
              onClick={() => {
                setIsOpen(false);
                router.push('/settings');
              }}
              className="flex items-center w-full px-4 py-2 text-sm text-[#999] hover:bg-[#2a2a2a] hover:text-white transition-colors"
              disabled
            >
              <Settings className="mr-3 h-4 w-4" />
              Settings
            </button>
            
            <button
              onClick={handleSignOut}
              className="flex items-center w-full px-4 py-2 text-sm text-[#999] hover:bg-[#2a2a2a] hover:text-white transition-colors"
            >
              <LogOut className="mr-3 h-4 w-4" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}