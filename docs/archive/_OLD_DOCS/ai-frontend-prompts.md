# AI Frontend Prototyping Prompts

## Ready-to-Use Prompts for Building ContentMax Interfaces

### Version 1.0

### Date: January 26, 2024

### Purpose: Copy-paste prompts for AI-assisted frontend development

---

## 1. Taxonomy Visualization (Force-Directed Network)

### Core Visualization Prompt

```
Create a React component for a force-directed network visualization with these requirements:

COMPONENT: TaxonomyVisualization
LIBRARY: Use D3.js or React Force Graph
FRAMEWORK: Next.js 15 with TypeScript

FEATURES:
- Display hierarchical taxonomy as interactive force-directed graph
- Support 10,000+ nodes with progressive loading
- Node size based on SKU count (15px to 50px)
- Color coding: Green (optimized), Yellow (outdated), Red (missing), Gray (no products)
- Smooth zoom (25% to 200%) with level-of-detail rendering
- Pan with mouse drag on canvas
- Physics: repulsion force -300, link distance 100, collision detection
- Show only top 50 nodes at 0-25% zoom, all nodes at 100%+
- WebGL rendering for performance

INTERACTIONS:
- Hover: Scale 1.2x, show tooltip with metrics
- Click: Select and show details in side panel
- Double-click: Zoom to node cluster
- Drag node: Reposition with physics
- Mouse wheel: Zoom at cursor position

DATA STRUCTURE:
{
  nodes: [
    { id, label, url, skuCount, status, traffic, revenue, position }
  ],
  edges: [
    { source, target, linkType }
  ]
}

STYLE: Dark mode with neon edges, subtle glow effects
```

### Link Mode Addition

```
Extend TaxonomyVisualization with Link Mode:

NEW MODE: Link Creation Mode
TRIGGER: Toggle button or 'L' key

FEATURES:
- Change cursor to crosshair
- On node hover: Show "+" icon
- Drag from node: Draw animated arrow following cursor
- Valid drop target: Green highlight
- Invalid target: Red highlight
- On successful link: Show modal for link context

LINK CONTEXT MODAL:
- Source and target node names
- Relationship type dropdown (parent/child, related, cross-sell)
- Link reason text input (required, 50 char min)
- Anchor text suggestions
- Preview of link in content

VISUAL FEEDBACK:
- Pending links: Dashed blue line
- Confirmed links: Solid line with arrow
- Link strength: Line thickness (1-5px)
- Animated particles flowing along links
```

---

## 2. Speed Review Interface

### Swipe Card Component

```
Create a Tinder-style content review interface:

COMPONENT: SpeedReviewStack
FRAMEWORK: React with Framer Motion animations

CARD STACK:
- Show 3 cards stacked with slight rotation (-2°, 0°, 2°)
- Top card interactive, others blurred background
- Card size: 600x400px desktop, full-screen mobile

CARD CONTENT:
{
  title: string,
  url: string,
  excerpt: string (200 chars),
  status: 'draft' | 'review' | 'approved',
  metrics: {
    searchVolume: number,
    difficulty: number,
    revenueImpact: string
  },
  seoScore: number (0-100),
  issues: string[]
}

SWIPE GESTURES:
- Right swipe (>50px): Approve (green overlay)
- Left swipe (>50px): Reject (red overlay)
- Up swipe (>50px): Needs editing (yellow overlay)
- Down swipe (>50px): Skip for now (gray overlay)
- Release under threshold: Snap back

ANIMATIONS:
- Swipe: Card flies off screen (300ms, ease-out)
- Next card: Scales up and rotates to position (200ms)
- Decision overlay: Fade in with icon (150ms)

KEYBOARD:
- Arrow keys for swipe direction
- Space: Preview full content
- Enter: Approve
- Escape: Skip

PROGRESS:
- Top progress bar: "45/234 reviewed today"
- Streak counter: "🔥 12 in a row!"
- Time per card: "Avg: 3.5 seconds"
```

---

## 3. Bulk Operations Interface

### Selection Interface

```
Create a multi-select interface with lasso selection:

COMPONENT: BulkSelectionGrid
FEATURES: Lasso select, rectangle select, keyboard multi-select

GRID LAYOUT:
- Responsive grid: 4 columns desktop, 2 tablet, 1 mobile
- Card size: 280x320px
- Gap: 20px

SELECTION METHODS:
1. Lasso: Hold Alt + drag to draw free-form selection
2. Rectangle: Shift + drag for box selection
3. Individual: Ctrl/Cmd + click to toggle
4. Range: Click + Shift + click for range
5. Select all: Ctrl/Cmd + A

VISUAL FEEDBACK:
- Unselected: White background
- Hover: Light blue border
- Selected: Blue background, white checkmark
- Selection area: Blue transparent overlay (30% opacity)

SELECTION BAR:
Position: Fixed bottom
Content: "23 items selected | [Generate All] [Edit] [Delete] [Clear]"
Animation: Slide up on first selection

SMART SELECTION:
Buttons for quick filters:
- "Select all outdated"
- "Select by traffic (>1000)"
- "Select missing content"
- "Select by language"

ACTIONS:
{
  generateContent: (ids: string[]) => Promise<void>,
  bulkEdit: (ids: string[], changes: object) => void,
  delete: (ids: string[]) => void,
  export: (ids: string[], format: string) => void
}
```

---

## 4. Content Generation Wizard

### Step Wizard Component

```
Create a multi-step content generation wizard:

COMPONENT: ContentGenerationWizard
FRAMEWORK: React with React Hook Form

WIZARD STRUCTURE:
steps: [
  { id: 'pages', label: 'Select Pages', icon: '📄' },
  { id: 'template', label: 'Choose Template', icon: '🎨' },
  { id: 'components', label: 'Configure Components', icon: '🧩' },
  { id: 'tone', label: 'Set Tone & Style', icon: '✍️' },
  { id: 'seo', label: 'SEO Settings', icon: '📊' },
  { id: 'review', label: 'Review & Generate', icon: '🚀' }
]

STEP INDICATOR:
- Horizontal stepper with connecting lines
- Completed: Green check
- Current: Blue pulse animation
- Upcoming: Gray outline

STEP 1 - PAGE SELECTION:
- Tree view of taxonomy
- Checkbox selection with count
- Quick filters: Status, type, language
- Search with auto-complete

STEP 2 - TEMPLATE:
- Visual template cards (preview thumbnails)
- Template categories: Hero, Features, FAQ, etc.
- Compatibility indicator per page type

STEP 3 - COMPONENTS:
Drag and drop component builder:
availableComponents: [
  { type: 'hero', label: 'Hero Section', required: false },
  { type: 'intro', label: 'Introduction', required: true },
  { type: 'features', label: 'Key Features', required: false },
  { type: 'faq', label: 'FAQs', required: false }
]

STEP 4 - TONE:
- Brand voice selector (Professional, Friendly, Expert)
- Keywords to emphasize (tag input)
- Language selection with locale

STEP 5 - SEO:
- Target keywords per page
- Meta description length (120-160 chars)
- Internal linking preferences

STEP 6 - REVIEW:
- Summary of selections
- Cost estimation: "$0.15 per page × 45 pages = $6.75"
- Time estimate: "~15 minutes"
- Generate button with loading state

NAVIGATION:
- Previous/Next buttons
- Skip optional steps
- Save draft functionality
- Keyboard navigation (Tab, Enter, Arrow keys)
```

---

## 5. Kanban Workflow Board

### Kanban Board Component

```
Create a drag-and-drop Kanban board:

COMPONENT: ContentWorkflowBoard
LIBRARY: react-beautiful-dnd or @dnd-kit

COLUMNS:
columns: [
  { id: 'backlog', title: 'Backlog', limit: null },
  { id: 'queued', title: 'Queued', limit: 20 },
  { id: 'generating', title: 'Generating', limit: 5 },
  { id: 'review', title: 'Review', limit: 10 },
  { id: 'approved', title: 'Approved', limit: null },
  { id: 'published', title: 'Published', limit: null }
]

CARD STRUCTURE:
{
  id: string,
  title: string,
  url: string,
  priority: 'low' | 'medium' | 'high' | 'urgent',
  assignee: { name: string, avatar: string },
  progress: number (0-100),
  timeRemaining: string,
  metrics: { traffic: number, revenue: string },
  blocked: boolean,
  blockReason?: string
}

CARD VISUAL:
- Priority indicator: Color-coded left border (4px)
- Progress bar: Bottom of card
- Avatar: Top right corner
- Blocked: Red overlay with icon
- Hover: Subtle shadow elevation

DRAG BEHAVIOR:
- Drag preview: Semi-transparent card
- Valid drop: Green column highlight
- Invalid drop: Red column overlay
- Auto-scroll near edges
- Multi-drag: Stack preview with count

WIP LIMITS:
- Visual indicator when approaching limit (yellow)
- Prevent drop when over limit (red)
- Show count: "Review (8/10)"

PERFORMANCE:
- Virtual scroll for 100+ cards
- Lazy load card details
- Optimistic updates
- Debounced saves
```

---

## 6. Dashboard Overview

### Analytics Dashboard

```
Create a comprehensive dashboard with metrics:

COMPONENT: ContentDashboard
LAYOUT: CSS Grid with responsive breakpoints

GRID AREAS:
- Header: Coverage progress bar
- Sidebar: Navigation and filters
- Main: 2x2 grid of metric cards
- Bottom: Activity timeline

METRIC CARDS:

1. COVERAGE DONUT:
Chart type: Donut chart (Chart.js or Recharts)
Data: { optimized: 234, outdated: 567, missing: 446 }
Center text: "67%" coverage
Colors: Green, yellow, red

2. VELOCITY LINE CHART:
Time series last 30 days
Y-axis: Pages generated
Show trend line and average
Hover: Detailed daily breakdown

3. SEO IMPACT BARS:
Horizontal bars showing:
- Addressable search volume
- Current visibility %
- Potential revenue
Sorted by opportunity

4. TEAM ACTIVITY:
Real-time activity feed:
[Avatar] [Name] [Action] [Time]
"Sarah approved Winter Boots - 2m ago"
"AI generated 5 pages - 10m ago"

FILTERS:
- Date range picker
- Category selector
- Status checkboxes
- Language dropdown

RESPONSIVE:
Desktop: 4-column grid
Tablet: 2-column
Mobile: Single column stack
```

---

## 7. Mobile Responsive Components

### Mobile Navigation

```
Create mobile-optimized navigation:

COMPONENT: MobileTabNav
POSITION: Fixed bottom

TABS:
tabs: [
  { icon: '🏠', label: 'Home', path: '/' },
  { icon: '🗺️', label: 'Taxonomy', path: '/taxonomy' },
  { icon: '✨', label: 'Generate', path: '/generate', badge: 5 },
  { icon: '📋', label: 'Review', path: '/review', badge: 23 },
  { icon: '👤', label: 'Profile', path: '/profile' }
]

BEHAVIOR:
- Active tab: Filled icon, primary color
- Inactive: Outline icon, gray
- Badge: Red circle with white number
- Tap: Haptic feedback on mobile
- Swipe up: Expand to full menu

GESTURE HINTS:
- Swipe right on taxonomy: Next category
- Swipe down on cards: Skip
- Pinch: Zoom visualization
- Long press: Context menu
```

---

## 8. Component Library Setup

### Design System Foundation

```
Create a component library with Storybook:

SETUP:
npx storybook@latest init
npm install tailwindcss @headlessui/react @heroicons/react

THEME TOKENS:
colors: {
  primary: { 50-900 },
  success: green,
  warning: yellow,
  danger: red,
  neutral: gray
}

spacing: 4px base unit
borderRadius: sm(4px), md(8px), lg(12px)
shadows: sm, md, lg, xl

COMPONENTS TO BUILD:
- Button (primary, secondary, ghost, sizes)
- Card (default, selectable, draggable)
- Badge (status, count, priority)
- Progress (bar, circle, segmented)
- Tooltip (hover, click, positions)
- Modal (centered, slideout, fullscreen)
- Toast (success, error, info, warning)
- Skeleton (text, card, table)

ANIMATION PRESETS:
fadeIn, slideUp, slideDown, scaleIn, bounce
Duration: 150ms (fast), 250ms (normal), 400ms (slow)
Easing: ease-in-out standard
```

---

## 9. State Management

### Global State Setup

```
Set up global state with Zustand:

STORE STRUCTURE:
interface ContentStore {
  // Taxonomy
  nodes: TaxonomyNode[]
  edges: Edge[]
  selectedNodes: string[]
  viewMode: 'default' | 'link' | 'heatmap'

  // Generation
  generationQueue: QueueItem[]
  generationStatus: 'idle' | 'generating' | 'error'

  // Review
  reviewQueue: ReviewItem[]
  reviewStats: { total: number, completed: number }

  // Actions
  selectNode: (id: string) => void
  createLink: (source: string, target: string) => void
  queueGeneration: (items: GenerationRequest[]) => void
  reviewContent: (id: string, decision: Decision) => void
}

REAL-TIME SYNC:
- Connect to Supabase realtime
- Subscribe to table changes
- Optimistic updates
- Conflict resolution
```

---

## 10. Testing Prompts

### E2E Testing Setup

```
Set up Playwright tests for critical paths:

TEST SCENARIOS:
1. Content generation flow (select → configure → generate)
2. Speed review (swipe through 10 cards)
3. Taxonomy navigation (zoom, pan, select)
4. Link creation (drag between nodes)
5. Bulk operations (select multiple, generate)

ACCESSIBILITY TESTS:
- Keyboard navigation coverage
- Screen reader announcements
- Color contrast validation
- Focus management
- ARIA labels

PERFORMANCE TESTS:
- Load 10,000 nodes < 2 seconds
- Swipe response < 16ms
- Search results < 100ms
- Virtual scroll smoothness
```

---

## Usage Instructions

1. **Choose the interface** you want to build
2. **Copy the relevant prompt** from this document
3. **Paste into your AI coding assistant** (Cursor, GitHub Copilot, etc.)
4. **Add project context**: "Using Next.js 15, TypeScript, Tailwind, and Supabase"
5. **Iterate on the generated code** with specific refinements
6. **Test across devices** using the responsive guidelines

### Pro Tips

- Start with the component library setup for consistency
- Build mobile-first, then enhance for desktop
- Use Storybook to develop components in isolation
- Implement virtual scrolling early for performance
- Add loading skeletons from the beginning
- Use optimistic updates for instant feedback
- Test with throttled network to ensure good UX

---

## Next Steps After Prototyping

1. **Performance optimization**: Implement code splitting and lazy loading
2. **Accessibility audit**: Run axe DevTools and fix issues
3. **User testing**: Conduct usability tests with 5-10 users
4. **Analytics setup**: Add event tracking for user behavior
5. **Error boundaries**: Add graceful error handling
6. **Progressive enhancement**: Ensure core functionality works without JavaScript
