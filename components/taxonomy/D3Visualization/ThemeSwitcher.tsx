'use client';

import React, { useState, useEffect } from 'react';
import { ThemeManager, VisualTheme } from '@/lib/visualization/visual-theme';
import { Palette, Eye, Sun, Moon } from 'lucide-react';

export interface ThemeSwitcherProps {
  className?: string;
  onThemeChange?: (theme: string) => void;
}

export function ThemeSwitcher({ className = '', onThemeChange }: ThemeSwitcherProps) {
  const [currentTheme, setCurrentTheme] = useState<'dark' | 'light' | 'colorblind'>('dark');
  const [isOpen, setIsOpen] = useState(false);
  const themeManager = ThemeManager.getInstance();

  useEffect(() => {
    // Subscribe to theme changes
    const unsubscribe = themeManager.subscribe((theme: VisualTheme) => {
      setCurrentTheme(
        theme.mode === 'light'
          ? 'light'
          : theme.colors.optimized === '#0173B2'
            ? 'colorblind'
            : 'dark'
      );
    });

    return unsubscribe;
  }, []);

  const handleThemeChange = (theme: 'dark' | 'light' | 'colorblind') => {
    setCurrentTheme(theme);
    themeManager.setTheme(theme);
    onThemeChange?.(theme);
    setIsOpen(false);
  };

  const getThemeIcon = () => {
    switch (currentTheme) {
      case 'light':
        return <Sun className="w-4 h-4" />;
      case 'colorblind':
        return <Eye className="w-4 h-4" />;
      default:
        return <Moon className="w-4 h-4" />;
    }
  };

  const getThemeLabel = () => {
    switch (currentTheme) {
      case 'light':
        return 'Light';
      case 'colorblind':
        return 'Colorblind';
      default:
        return 'Dark';
    }
  };

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1 bg-[#0a0a0a] border border-[#1a1a1a] rounded text-xs text-[#999] hover:border-[#2a2a2a] hover:text-white transition-colors"
        aria-label="Theme switcher"
      >
        {getThemeIcon()}
        <span>{getThemeLabel()}</span>
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 right-0 w-48 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg shadow-xl z-50">
          <div className="p-1">
            <button
              onClick={() => handleThemeChange('dark')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded transition-colors ${
                currentTheme === 'dark'
                  ? 'bg-[#1a1a1a] text-white'
                  : 'text-[#999] hover:bg-[#1a1a1a] hover:text-white'
              }`}
            >
              <Moon className="w-4 h-4" />
              <div className="flex-1 text-left">
                <div className="text-xs font-medium">Dark Theme</div>
                <div className="text-xs text-[#666]">Default dark mode</div>
              </div>
            </button>

            <button
              onClick={() => handleThemeChange('light')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded transition-colors ${
                currentTheme === 'light'
                  ? 'bg-[#1a1a1a] text-white'
                  : 'text-[#999] hover:bg-[#1a1a1a] hover:text-white'
              }`}
            >
              <Sun className="w-4 h-4" />
              <div className="flex-1 text-left">
                <div className="text-xs font-medium">Light Theme</div>
                <div className="text-xs text-[#666]">High contrast light</div>
              </div>
            </button>

            <button
              onClick={() => handleThemeChange('colorblind')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded transition-colors ${
                currentTheme === 'colorblind'
                  ? 'bg-[#1a1a1a] text-white'
                  : 'text-[#999] hover:bg-[#1a1a1a] hover:text-white'
              }`}
            >
              <Eye className="w-4 h-4" />
              <div className="flex-1 text-left">
                <div className="text-xs font-medium">Colorblind Safe</div>
                <div className="text-xs text-[#666]">Deuteranopia friendly</div>
              </div>
            </button>

            <div className="border-t border-[#1a1a1a] mt-1 pt-1">
              <button
                onClick={() => setIsOpen(false)}
                className="w-full flex items-center gap-3 px-3 py-2 text-[#999] hover:bg-[#1a1a1a] hover:text-white rounded transition-colors"
              >
                <Palette className="w-4 h-4" />
                <div className="flex-1 text-left">
                  <div className="text-xs font-medium">Visual Legend</div>
                  <div className="text-xs text-[#666]">Show color meanings</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
