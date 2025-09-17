/**
 * Theme constants for Content Machine
 * Based on existing styling from Settings, Import, and Taxonomy pages
 */

export const typography = {
  // Font families - From globals.css line 22
  fonts: {
    sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Helvetica", "Arial", sans-serif',
    mono: 'font-mono', // Tailwind default mono font
  },

  // ACTUAL font sizes used in the codebase
  sizes: {
    // Headers - Based on actual usage
    '3xl': 'text-3xl', // Settings page title (SettingsLayout.tsx:67)
    '2xl': 'text-2xl', // Section headers (SitemapInput.tsx:79, BillingTab.tsx:31)
    xl: 'text-xl', // Section headers (DataSourcesTab.tsx:218, TeamTab.tsx:358, etc.)
    lg: 'text-lg', // Card titles (IntegrationsTab.tsx:341, ProfileTab.tsx:256, etc.)

    // Body text
    base: 'text-base', // Default body text (rarely explicitly set)
    sm: 'text-sm', // Most common - descriptions, body text (used everywhere)
    xs: 'text-xs', // Badges, timestamps, labels (very common)
  },

  // ACTUAL font weights used
  weights: {
    normal: 'font-normal', // Default, rarely explicitly set
    medium: 'font-medium', // Buttons, labels, emphasized text (very common)
    semibold: 'font-semibold', // Section headers (TeamTab.tsx:358, ImportSourceSelector.tsx)
    bold: 'font-bold', // Page titles only (SettingsLayout.tsx:67)
  },

  // Line heights - Not commonly customized in the codebase
  lineHeight: {
    normal: 'leading-normal', // Default, rarely customized
  },

  // Letter spacing - Not customized in the codebase
  letterSpacing: {
    normal: 'tracking-normal', // Default
  },
};

export const colors = {
  // Background colors
  background: {
    primary: '#0a0a0a', // Main page background
    secondary: '#1a1a1a', // Card backgrounds
    tertiary: '#2a2a2a', // Elevated surfaces, active states
    hover: '#1a1a1a', // Hover state for primary background items
    hoverSecondary: '#2a2a2a', // Hover state for secondary background items
  },

  // Border colors
  border: {
    primary: '#2a2a2a', // Main borders
    secondary: '#333', // Alternative borders
    subtle: '#1a1a1a', // Very subtle borders
  },

  // Text colors
  text: {
    primary: 'white', // Primary text
    secondary: '#999', // Secondary/muted text
    tertiary: '#666', // Even more muted text
    quaternary: '#444', // Disabled/very muted text
  },

  // Accent colors
  accent: {
    primary: '#10a37f', // Primary green accent (buttons, active states)
    primaryHover: '#0d8d6c', // Hover state for primary accent
    secondary: '#10b981', // Alternative green (used in some places)
    secondaryHover: '#0ea968', // Hover for alternative green
  },

  // Status colors
  status: {
    success: '#10a37f',
    successAlt: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
  },

  // Special colors
  special: {
    disabled: '#666',
    disabledBg: '#1a1a1a',
  },
};

export const className = {
  // Page layouts
  page: {
    wrapper: 'min-h-screen bg-[#0a0a0a]',
    container: 'container mx-auto py-8 px-4',
    maxWidth: 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8',
  },

  // Cards
  card: {
    primary: 'bg-[#1a1a1a] border-[#2a2a2a]',
    secondary: 'bg-[#0a0a0a] border-[#2a2a2a]',
    hover: 'hover:bg-[#2a2a2a] transition-all',
    clickable: 'cursor-pointer hover:bg-[#2a2a2a] transition-all',
  },

  // Buttons - Consistent button styles used across the app
  button: {
    // Base styles all buttons share
    base: 'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md transition-colors font-medium text-sm',

    // Primary CTA - Main actions (Add Data Source, Save, Connect)
    primary: 'bg-[#10a37f] hover:bg-[#0e8a65] text-white',
    primaryDisabled: 'bg-[#10a37f] opacity-50 text-white cursor-not-allowed',

    // Secondary - Less prominent actions (Edit Profile, Cancel)
    secondary: 'bg-[#1a1a1a] hover:bg-[#2a2a2a] text-white',
    secondaryDisabled: 'bg-[#1a1a1a] opacity-50 text-white cursor-not-allowed',

    // Tertiary/Ghost - Even less prominent (used in lists, inline actions)
    tertiary: 'bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white',

    // Outline - Alternative secondary style
    outline:
      'border border-[#2a2a2a] hover:border-[#3a3a3a] bg-transparent text-[#999] hover:text-white',

    // Danger - Destructive actions (Delete, Clear All Data)
    danger: 'bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30',
    dangerSolid: 'bg-red-600 hover:bg-red-700 text-white',

    // Warning - Caution actions
    warning: 'bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 border border-orange-500/30',

    // Sizes
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm', // Default
    lg: 'px-6 py-3 text-base',

    // Icon-only buttons
    iconOnly: 'p-1.5',
    iconOnlySm: 'p-1',
    iconOnlyLg: 'p-2',
  },

  // Inputs
  input: {
    base: 'bg-[#0a0a0a] border-[#2a2a2a] text-white placeholder:text-[#666]',
    focus: 'focus:border-[#10a37f] focus:ring-[#10a37f]',
  },

  // Tabs
  tabs: {
    list: 'bg-[#1a1a1a] border border-[#2a2a2a]',
    trigger: 'data-[state=active]:bg-[#10a37f] data-[state=active]:text-white',
    triggerBase: 'text-[#999] hover:text-white transition-colors',
  },

  // ACTUAL Typography patterns used in the codebase
  text: {
    // Headers - Based on real usage
    pageTitle: 'text-3xl font-bold', // Settings page (SettingsLayout.tsx:67)
    sectionHeader: 'text-xl font-semibold', // Data Sources, Team tabs (multiple files)
    cardTitle: 'text-lg font-medium text-white', // Card headers (multiple components)
    smallHeader: 'text-sm font-medium text-white', // Small section headers

    // Body text - Most common patterns
    body: 'text-[#999]', // Primary body text (no size = inherits)
    bodySmall: 'text-sm text-[#999]', // Very common pattern
    description: 'text-sm text-[#999]', // Descriptions everywhere

    // Muted/secondary text
    muted: 'text-sm text-[#666]', // Less important info
    tiny: 'text-xs text-[#666]', // Timestamps, hints

    // Labels and form elements
    label: 'text-sm font-medium text-white', // Form labels (ProfileTab.tsx:583)
    inputLabel: 'text-sm text-[#999]', // Input descriptions

    // Interactive elements
    buttonText: 'text-sm font-medium', // Buttons (implicit in most cases)
    tabText: 'text-sm font-medium', // Tab labels (SettingsLayout.tsx:84)

    // Status and badges
    badge: 'text-xs font-medium', // Badges (common pattern)
    statusGreen: 'text-green-500', // Active status
    statusRed: 'text-red-500', // Error status
    statusYellow: 'text-yellow-500', // Warning status

    // Special text
    emphasis: 'font-medium text-white', // Emphasized inline text
    code: 'font-mono', // Code snippets (rarely used)
  },

  // Alerts
  alert: {
    base: 'bg-[#0a0a0a] border-[#2a2a2a]',
    success: 'bg-[#0a0a0a] border-[#10a37f] text-[#10a37f]',
    warning: 'bg-[#0a0a0a] border-yellow-600 text-yellow-600',
    error: 'bg-[#0a0a0a] border-red-600 text-red-600',
    info: 'bg-[#0a0a0a] border-blue-600 text-blue-600',
  },

  // Badges
  badge: {
    default: 'bg-[#2a2a2a] text-[#999]',
    success: 'bg-[#10a37f]/20 text-[#10a37f] border-[#10a37f]/30',
    warning: 'bg-yellow-600/20 text-yellow-600 border-yellow-600/30',
    error: 'bg-red-600/20 text-red-600 border-red-600/30',
  },
};

/**
 * Helper function to combine class names
 */
export function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(' ');
}

/**
 * Button helper - combines base styles with variant
 * @param variant - 'primary' | 'secondary' | 'tertiary' | 'outline' | 'danger' | 'warning'
 * @param size - 'sm' | 'md' | 'lg'
 * @param disabled - boolean
 */
export function getButtonClasses(
  variant:
    | 'primary'
    | 'secondary'
    | 'tertiary'
    | 'outline'
    | 'danger'
    | 'dangerSolid'
    | 'warning' = 'primary',
  size: 'sm' | 'md' | 'lg' = 'md',
  disabled: boolean = false
): string {
  const base = className.button.base;

  // Get variant styles
  let variantClass = className.button[variant];
  if (disabled && variant === 'primary') {
    variantClass = className.button.primaryDisabled;
  } else if (disabled && variant === 'secondary') {
    variantClass = className.button.secondaryDisabled;
  } else if (disabled) {
    variantClass += ' opacity-50 cursor-not-allowed';
  }

  // Get size (only if not default)
  const sizeClass = size !== 'md' ? className.button[size] : '';

  return cn(base, variantClass, sizeClass);
}

/**
 * Example usage:
 *
 * import { className, colors } from '@/lib/styles/theme-constants';
 *
 * <div className={className.page.wrapper}>
 *   <Card className={className.card.primary}>
 *     <Button className={className.button.primary}>
 *       Click me
 *     </Button>
 *   </Card>
 * </div>
 *
 * For dynamic styles:
 * <div style={{ backgroundColor: colors.background.primary }}>
 *   Content
 * </div>
 */
