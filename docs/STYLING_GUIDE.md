# Content Machine Styling Guide

## Overview

This guide ensures consistent styling across all pages in Content Machine. All new pages and components should follow these patterns.

## Color Palette

### Background Colors

- **Primary Background**: `#0a0a0a` - Main page background
- **Secondary Background**: `#1a1a1a` - Card and panel backgrounds
- **Tertiary Background**: `#2a2a2a` - Elevated surfaces, active tab backgrounds

### Text Colors

- **Primary Text**: `white` - Headers, important text
- **Secondary Text**: `#999` - Body text, descriptions
- **Tertiary Text**: `#666` - Muted text, hints, placeholders
- **Quaternary Text**: `#444` - Disabled text

### Accent Colors

- **Primary Accent**: `#10a37f` - Primary buttons, active states, success indicators
- **Primary Hover**: `#0d8d6c` - Hover state for primary accent

### Border Colors

- **Primary Border**: `#2a2a2a` - Most borders
- **Secondary Border**: `#333` - Alternative borders
- **Subtle Border**: `#1a1a1a` - Very subtle borders

## Component Patterns

### Pages

```tsx
<div className="min-h-screen bg-[#0a0a0a]">
  <div className="container mx-auto py-8 px-4">
    <!-- Content -->
  </div>
</div>
```

### Cards

```tsx
// Primary card (most common)
<Card className="bg-[#1a1a1a] border-[#2a2a2a]">
  <CardHeader>
    <CardTitle className="text-white">Title</CardTitle>
    <CardDescription className="text-[#999]">Description</CardDescription>
  </CardHeader>
  <CardContent>
    <!-- Content -->
  </CardContent>
</Card>

// Secondary card (nested or alternate)
<Card className="bg-[#0a0a0a] border-[#2a2a2a]">
  <!-- Content -->
</Card>

// Clickable card
<Card className="bg-[#1a1a1a] border-[#2a2a2a] hover:bg-[#2a2a2a] transition-all cursor-pointer">
  <!-- Content -->
</Card>
```

### Buttons

#### Button Hierarchy

1. **Primary CTA** - Main actions (Save, Add, Connect)
2. **Secondary CTA** - Less prominent actions (Edit, Cancel)
3. **Tertiary** - List actions, nested actions
4. **Danger** - Destructive actions (Delete, Clear)
5. **Warning** - Caution actions

#### Button Styles

```tsx
// Import helper
import { getButtonClasses, className } from '@/lib/styles/theme-constants';

// Primary CTA - Main actions
<button className={getButtonClasses('primary')}>
  Add Data Source
</button>
// OR manually:
<button className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md transition-colors font-medium text-sm bg-[#10a37f] hover:bg-[#0e8a65] text-white">
  Add Data Source
</button>

// Secondary CTA - Less prominent
<button className={getButtonClasses('secondary')}>
  Edit Profile
</button>
// OR manually:
<button className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md transition-colors font-medium text-sm bg-[#1a1a1a] hover:bg-[#2a2a2a] text-white">
  Edit Profile
</button>

// Tertiary - Even less prominent
<button className={getButtonClasses('tertiary')}>
  Cancel
</button>

// Danger - Destructive actions (semi-transparent)
<button className={getButtonClasses('danger')}>
  Clear All Data
</button>
// OR for solid danger:
<button className={getButtonClasses('dangerSolid')}>
  Delete Permanently
</button>

// Warning - Caution actions
<button className={getButtonClasses('warning')}>
  Clear Data
</button>

// Disabled states
<button className={getButtonClasses('primary')} disabled>
  Processing...
</button>

// Different sizes
<button className={getButtonClasses('primary', 'sm')}>Small</button>
<button className={getButtonClasses('primary', 'md')}>Medium (default)</button>
<button className={getButtonClasses('primary', 'lg')}>Large</button>

// Icon-only buttons
<button className="p-1.5 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white rounded transition-colors">
  <Settings className="h-4 w-4" />
</button>
```

#### Button Usage Guidelines

| Type             | Use Case                            | Example                                      |
| ---------------- | ----------------------------------- | -------------------------------------------- |
| **Primary**      | Main page action, form submission   | "Add Data Source", "Save Changes", "Connect" |
| **Secondary**    | Alternative actions, less important | "Edit Profile", "Download", "Export"         |
| **Tertiary**     | Cancel, back, nested actions        | "Cancel", "Back", "Skip"                     |
| **Outline**      | Alternative secondary style         | "Learn More", "View Details"                 |
| **Danger**       | Destructive but reversible          | "Clear Data", "Disconnect"                   |
| **Danger Solid** | Destructive and irreversible        | "Delete Account", "Remove Forever"           |
| **Warning**      | Requires caution                    | "Reset Settings", "Clear Cache"              |

#### Button Anatomy

- **Base padding**: `px-4 py-2` (16px horizontal, 8px vertical)
- **Small padding**: `px-3 py-1.5`
- **Large padding**: `px-6 py-3`
- **Border radius**: `rounded-md` (6px)
- **Font**: `font-medium text-sm`
- **Transition**: `transition-colors`
- **Gap for icons**: `gap-2` (8px between icon and text)

#### Icon Buttons

```tsx
// With text
<button className="inline-flex items-center gap-2 px-4 py-2 ...">
  <Plus className="h-4 w-4" />
  Add Item
</button>

// Icon only - small
<button className="p-1 rounded transition-colors ...">
  <X className="h-3 w-3" />
</button>

// Icon only - medium
<button className="p-1.5 rounded transition-colors ...">
  <Settings className="h-4 w-4" />
</button>

// Icon only - large
<button className="p-2 rounded transition-colors ...">
  <Menu className="h-5 w-5" />
</button>
```

### Inputs

```tsx
<Input
  className="bg-[#0a0a0a] border-[#2a2a2a] text-white placeholder:text-[#666]"
  placeholder="Enter value..."
/>

<Label className="text-[#999]">Label Text</Label>
```

### Tabs

```tsx
<Tabs>
  <TabsList className="bg-[#1a1a1a] border border-[#2a2a2a]">
    <TabsTrigger
      value="tab1"
      className="data-[state=active]:bg-[#10a37f] data-[state=active]:text-white"
    >
      Tab 1
    </TabsTrigger>
  </TabsList>
  <TabsContent value="tab1">
    <!-- Content -->
  </TabsContent>
</Tabs>
```

### Alerts

```tsx
<Alert className="bg-[#0a0a0a] border-[#2a2a2a]">
  <AlertDescription className="text-[#999]">Alert message</AlertDescription>
</Alert>
```

### Typography

### Font Families

- **Default (Sans-serif)**: System fonts for optimal performance and native feel
- **Monospace**: Used for code, technical values, IDs

### Font Sizes & Usage

| Size | Class       | Pixels | Use Case                         |
| ---- | ----------- | ------ | -------------------------------- |
| 4xl  | `text-4xl`  | 36px   | Hero sections, landing pages     |
| 3xl  | `text-3xl`  | 30px   | Page titles (Settings, Taxonomy) |
| 2xl  | `text-2xl`  | 24px   | Major section headers            |
| xl   | `text-xl`   | 20px   | Section headers                  |
| lg   | `text-lg`   | 18px   | Card titles, sub-sections        |
| base | `text-base` | 16px   | Default body text                |
| sm   | `text-sm`   | 14px   | Secondary text, descriptions     |
| xs   | `text-xs`   | 12px   | Labels, badges, timestamps       |

### Font Weights

| Weight   | Class           | Value | Use Case                   |
| -------- | --------------- | ----- | -------------------------- |
| Normal   | `font-normal`   | 400   | Body text, descriptions    |
| Medium   | `font-medium`   | 500   | Buttons, subtle emphasis   |
| Semibold | `font-semibold` | 600   | Sub-headers, card titles   |
| Bold     | `font-bold`     | 700   | Page titles, major headers |

### Typography Patterns

```tsx
// Page title
<h1 className="text-3xl font-bold text-white">Page Title</h1>

// Section header
<h2 className="text-xl font-semibold text-white">Section Title</h2>

// Card title
<h3 className="text-lg font-semibold text-white">Card Title</h3>

// Body text
<p className="text-base font-normal text-[#999]">Primary body text</p>

// Secondary text
<p className="text-sm font-normal text-[#999]">Secondary description</p>

// Muted text
<p className="text-sm font-normal text-[#666]">Muted information</p>

// Tiny text (timestamps, hints)
<p className="text-xs font-normal text-[#666]">Last updated: 2 hours ago</p>

// Labels
<label className="text-sm font-medium text-[#999]">Field Label</label>

// Badges
<span className="text-xs font-medium text-[#10a37f]">Active</span>

// Error text
<p className="text-sm font-normal text-red-500">Error message</p>

// Success text
<p className="text-sm font-normal text-[#10a37f]">Operation successful</p>

// Code/technical text
<code className="font-mono text-sm text-[#999]">product_id_123</code>

// Button text (inherits button styling)
<Button className="text-sm font-medium">Click Me</Button>
```

### Line Height Guidelines

- **Headers**: Use `leading-tight` (1.25) for compact, impactful headers
- **Body Text**: Use default `leading-normal` (1.5) for readability
- **Dense Lists**: Use `leading-snug` (1.375) for compact lists
- **Comfortable Reading**: Use `leading-relaxed` (1.625) for long-form content

### When to Use Each Font Style

#### Bold (700) - Maximum emphasis

- Page titles
- Primary navigation items when active
- Critical warnings or alerts

#### Semibold (600) - Strong emphasis

- Section headers
- Card titles
- Tab labels
- Important metrics or numbers

#### Medium (500) - Moderate emphasis

- Button text
- Active states
- Form labels
- Selected items in lists

#### Normal (400) - Standard text

- Body paragraphs
- Descriptions
- List items
- Input placeholder text

### Text Color Hierarchy

1. **White** (`text-white`) - Primary headers, important data
2. **Light Gray** (`text-[#999]`) - Body text, descriptions
3. **Medium Gray** (`text-[#666]`) - Muted text, hints, timestamps
4. **Dark Gray** (`text-[#444]`) - Disabled states (rarely used)

### Special Typography Cases

#### Numbers and Metrics

```tsx
// Large metric display
<div className="text-2xl font-bold text-white">1,234</div>
<div className="text-sm text-[#666]">Total items</div>

// Inline metrics
<span className="text-base font-semibold text-[#10a37f]">+12.5%</span>
```

#### Status Text

```tsx
// Success
<span className="text-sm font-medium text-[#10a37f]">Connected</span>

// Warning
<span className="text-sm font-medium text-yellow-500">Pending</span>

// Error
<span className="text-sm font-medium text-red-500">Failed</span>
```

#### Truncation

```tsx
// Single line truncation
<p className="text-sm text-[#999] truncate">Very long text that will be truncated...</p>

// Multi-line truncation
<p className="text-sm text-[#999] line-clamp-2">
  Very long text that will be truncated after two lines...
</p>
```

## Icons

- Use Lucide React icons consistently
- Icon colors should match text colors
- Active/success icons: `text-[#10a37f]`
- Error icons: `text-red-500` or `text-red-600`
- Warning icons: `text-yellow-500` or `text-yellow-600`
- Muted icons: `text-[#666]` or `text-[#999]`

## Hover States

- Cards: `hover:bg-[#2a2a2a]`
- Buttons: See button patterns above
- List items: `hover:bg-[#1a1a1a]` for items on primary background
- Links: `hover:text-white` when starting from `text-[#999]`

## Transitions

- Always include smooth transitions: `transition-all` or `transition-colors`
- Standard duration is default (150ms)

## Reference Implementation

The following pages demonstrate correct styling:

- `/dashboard/settings` - Settings page
- `/import` - Import wizard
- `/dashboard/taxonomy` - Taxonomy page

## Using the Theme Constants

Import the theme constants for consistent styling:

```tsx
import { className, colors } from '@/lib/styles/theme-constants';

// Use predefined class names
<Card className={className.card.primary}>
  <Button className={className.button.primary}>
    Click me
  </Button>
</Card>

// Use color values for dynamic styles
<div style={{ backgroundColor: colors.background.primary }}>
  Content
</div>
```

## Common Mistakes to Avoid

1. **Don't use generic Tailwind grays** - Use `#999`, `#666`, etc. instead of `text-gray-400`
2. **Don't use pure black** - Use `#0a0a0a` for backgrounds, not `bg-black`
3. **Don't forget hover states** - All interactive elements need hover states
4. **Don't mix accent greens** - Use `#10a37f` as primary, not `#10b981`
5. **Don't use light backgrounds** - No white or light gray backgrounds

## Testing Your Styling

1. Compare your page side-by-side with Settings or Import pages
2. Check all hover states work correctly
3. Ensure text contrast is sufficient
4. Test in both light and dark browser themes (should look the same)
5. Verify borders are visible but subtle
