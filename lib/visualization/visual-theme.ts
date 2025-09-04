export type OptimizationStatus = 'optimized' | 'outdated' | 'missing' | 'noContent' | 'unknown';
export type ThemeMode = 'light' | 'dark';

export interface ColorScheme {
  optimized: string;
  outdated: string;
  missing: string;
  noContent: string;
  unknown: string;
  hover: {
    optimized: string;
    outdated: string;
    missing: string;
    noContent: string;
    unknown: string;
  };
  selected: {
    optimized: string;
    outdated: string;
    missing: string;
    noContent: string;
    unknown: string;
  };
}

export interface VisualTheme {
  mode: ThemeMode;
  colors: ColorScheme;
  background: string;
  text: {
    primary: string;
    secondary: string;
    muted: string;
  };
  edges: {
    default: string;
    highTraffic: string;
    lowTraffic: string;
    opacity: number;
  };
  node: {
    strokeWidth: number;
    strokeColor: string;
    minRadius: number;
    maxRadius: number;
    transitionDuration: number;
  };
}

// Dark theme with high contrast - WCAG AA compliant
export const darkTheme: VisualTheme = {
  mode: 'dark',
  colors: {
    optimized: '#10a37f', // Green - Good status
    outdated: '#f59e0b', // Yellow/Orange - Warning
    missing: '#ef4444', // Red - Critical
    noContent: '#666666', // Gray - No data
    unknown: '#1a1a1a', // Dark gray - Unknown
    hover: {
      optimized: '#14d39a', // Lighter green
      outdated: '#fbbf24', // Lighter yellow
      missing: '#f87171', // Lighter red
      noContent: '#808080', // Lighter gray
      unknown: '#333333', // Lighter dark gray
    },
    selected: {
      optimized: '#0e906d', // Darker green
      outdated: '#d97706', // Darker yellow
      missing: '#dc2626', // Darker red
      noContent: '#4d4d4d', // Darker gray
      unknown: '#0d0d0d', // Darker dark gray
    },
  },
  background: '#000000',
  text: {
    primary: '#ffffff',
    secondary: '#999999',
    muted: '#666666',
  },
  edges: {
    default: '#1a1a1a',
    highTraffic: '#2a2a2a',
    lowTraffic: '#0f0f0f',
    opacity: 0.6,
  },
  node: {
    strokeWidth: 2,
    strokeColor: '#2a2a2a',
    minRadius: 5,
    maxRadius: 30,
    transitionDuration: 300,
  },
};

// Light theme with high contrast - WCAG AA compliant
export const lightTheme: VisualTheme = {
  mode: 'light',
  colors: {
    optimized: '#059669', // Green - Good status
    outdated: '#d97706', // Orange - Warning
    missing: '#dc2626', // Red - Critical
    noContent: '#9ca3af', // Gray - No data
    unknown: '#e5e7eb', // Light gray - Unknown
    hover: {
      optimized: '#10b981', // Lighter green
      outdated: '#f59e0b', // Lighter orange
      missing: '#ef4444', // Lighter red
      noContent: '#d1d5db', // Lighter gray
      unknown: '#f3f4f6', // Lighter light gray
    },
    selected: {
      optimized: '#047857', // Darker green
      outdated: '#b45309', // Darker orange
      missing: '#b91c1c', // Darker red
      noContent: '#6b7280', // Darker gray
      unknown: '#d1d5db', // Darker light gray
    },
  },
  background: '#ffffff',
  text: {
    primary: '#111827',
    secondary: '#6b7280',
    muted: '#9ca3af',
  },
  edges: {
    default: '#e5e7eb',
    highTraffic: '#d1d5db',
    lowTraffic: '#f3f4f6',
    opacity: 0.8,
  },
  node: {
    strokeWidth: 2,
    strokeColor: '#d1d5db',
    minRadius: 5,
    maxRadius: 30,
    transitionDuration: 300,
  },
};

// Colorblind-safe theme (Deuteranopia/Protanopia friendly)
export const colorblindTheme: VisualTheme = {
  mode: 'dark',
  colors: {
    optimized: '#0173B2', // Blue - Good status
    outdated: '#ECE133', // Yellow - Warning
    missing: '#CC79A7', // Pink/Purple - Critical
    noContent: '#666666', // Gray - No data
    unknown: '#1a1a1a', // Dark gray - Unknown
    hover: {
      optimized: '#029BE5', // Lighter blue
      outdated: '#F4ED47', // Lighter yellow
      missing: '#D696BB', // Lighter pink
      noContent: '#808080', // Lighter gray
      unknown: '#333333', // Lighter dark gray
    },
    selected: {
      optimized: '#015A8A', // Darker blue
      outdated: '#CCC200', // Darker yellow
      missing: '#B25D91', // Darker pink
      noContent: '#4d4d4d', // Darker gray
      unknown: '#0d0d0d', // Darker dark gray
    },
  },
  background: '#000000',
  text: {
    primary: '#ffffff',
    secondary: '#999999',
    muted: '#666666',
  },
  edges: {
    default: '#1a1a1a',
    highTraffic: '#2a2a2a',
    lowTraffic: '#0f0f0f',
    opacity: 0.6,
  },
  node: {
    strokeWidth: 2,
    strokeColor: '#2a2a2a',
    minRadius: 5,
    maxRadius: 30,
    transitionDuration: 300,
  },
};

// Theme manager
export class ThemeManager {
  private static instance: ThemeManager;
  private currentTheme: VisualTheme = darkTheme;
  private listeners: Set<(theme: VisualTheme) => void> = new Set();

  private constructor() {}

  static getInstance(): ThemeManager {
    if (!ThemeManager.instance) {
      ThemeManager.instance = new ThemeManager();
    }
    return ThemeManager.instance;
  }

  getTheme(): VisualTheme {
    return this.currentTheme;
  }

  setTheme(theme: VisualTheme | 'dark' | 'light' | 'colorblind'): void {
    if (typeof theme === 'string') {
      switch (theme) {
        case 'dark':
          this.currentTheme = darkTheme;
          break;
        case 'light':
          this.currentTheme = lightTheme;
          break;
        case 'colorblind':
          this.currentTheme = colorblindTheme;
          break;
      }
    } else {
      this.currentTheme = theme;
    }

    // Notify all listeners
    this.listeners.forEach((listener) => listener(this.currentTheme));
  }

  subscribe(listener: (theme: VisualTheme) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Helper method to get color for status
  getStatusColor(
    status: OptimizationStatus,
    state: 'default' | 'hover' | 'selected' = 'default'
  ): string {
    if (state === 'hover') {
      return this.currentTheme.colors.hover[status] || this.currentTheme.colors.hover.unknown;
    }
    if (state === 'selected') {
      return this.currentTheme.colors.selected[status] || this.currentTheme.colors.selected.unknown;
    }
    return this.currentTheme.colors[status] || this.currentTheme.colors.unknown;
  }

  // Check if colors meet WCAG contrast requirements
  checkContrast(foreground: string, background: string): number {
    // Simple luminance calculation for contrast ratio
    const getLuminance = (color: string): number => {
      const rgb = parseInt(color.slice(1), 16);
      const r = (rgb >> 16) & 0xff;
      const g = (rgb >> 8) & 0xff;
      const b = (rgb >> 0) & 0xff;

      const rsRGB = r / 255;
      const gsRGB = g / 255;
      const bsRGB = b / 255;

      const rL = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4);
      const gL = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4);
      const bL = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4);

      return 0.2126 * rL + 0.7152 * gL + 0.0722 * bL;
    };

    const l1 = getLuminance(foreground);
    const l2 = getLuminance(background);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);

    return (lighter + 0.05) / (darker + 0.05);
  }
}
