# Story 1.4: Basic Dashboard UI

## User Story
As a marketing manager,
I want to see a dashboard with placeholder metrics upon login,
So that I know the system is working and understand the interface layout.

## Size & Priority
- **Size**: M (4 hours)
- **Priority**: P0 - Critical
- **Sprint**: 1
- **Dependencies**: Task 1.3

## Description
Create initial dashboard with responsive layout, navigation sidebar, metric cards, and user profile management.

## Implementation Steps

1. **Create dashboard layout structure**
   - Sidebar navigation component
   - Header with user menu
   - Main content area
   - Responsive mobile menu

2. **Build metric cards**
   - Total Categories card
   - Coverage % card  
   - Pending Review card
   - Published Content card

3. **Implement navigation**
   - Dashboard (current)
   - Taxonomy (coming soon)
   - Generate (coming soon)
   - Review (coming soon)
   - Workflow (coming soon)
   - Settings (coming soon)

4. **Add user profile dropdown**
   - Display user email
   - Account settings link
   - Logout option
   - Theme toggle (future)

## Files to Create

- `app/dashboard/page.tsx` - Main dashboard page
- `app/dashboard/layout.tsx` - Dashboard layout wrapper
- `components/dashboard/MetricCard.tsx` - Metric display component
- `components/dashboard/StatsGrid.tsx` - Grid of metric cards
- `components/layout/Sidebar.tsx` - Navigation sidebar
- `components/layout/Header.tsx` - Top header with user menu
- `components/layout/MobileMenu.tsx` - Mobile navigation
- `components/layout/UserDropdown.tsx` - User profile menu

## Component Specifications

### MetricCard Component
```typescript
interface MetricCardProps {
  title: string
  value: string | number
  change?: number
  changeType?: 'increase' | 'decrease'
  icon?: React.ComponentType
  loading?: boolean
}

// Features:
// - Animated number display
// - Trend indicator (up/down arrow)
// - Loading skeleton
// - Responsive sizing
// - Hover effects
```

### Sidebar Navigation
```typescript
const navItems = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon, active: true },
  { name: 'Taxonomy', href: '/taxonomy', icon: TreeIcon, disabled: true },
  { name: 'Generate', href: '/generate', icon: SparklesIcon, disabled: true },
  { name: 'Review', href: '/review', icon: CheckIcon, disabled: true },
  { name: 'Workflow', href: '/workflow', icon: KanbanIcon, disabled: true },
  { name: 'Settings', href: '/settings', icon: CogIcon, disabled: true }
]
```

## UI/UX Requirements

### Desktop Layout
- Fixed sidebar (256px width)
- Collapsible on smaller screens
- Header height: 64px
- Content padding: 24px
- Card grid: 4 columns on XL, 2 on MD, 1 on SM

### Mobile Layout  
- Bottom navigation bar
- Hamburger menu for additional options
- Full-width metric cards
- Swipeable between sections

### Design Tokens
```css
/* Colors */
--primary: #3b82f6;
--background: #ffffff;
--surface: #f9fafb;
--text-primary: #111827;
--text-secondary: #6b7280;
--border: #e5e7eb;

/* Spacing */
--spacing-xs: 4px;
--spacing-sm: 8px;
--spacing-md: 16px;
--spacing-lg: 24px;
--spacing-xl: 32px;
```

## Acceptance Criteria

- [ ] Dashboard loads after authentication
- [ ] Sidebar navigation functional (with coming soon states)
- [ ] Header shows user info and logout option
- [ ] Four metric cards display placeholder data
- [ ] Responsive design works on mobile (320px+)
- [ ] Loading states for async data fetching
- [ ] Error boundaries prevent full page crashes
- [ ] User can logout from dropdown menu
- [ ] Clean, professional design matching brand

## Placeholder Data

```typescript
const placeholderMetrics = {
  totalCategories: 1234,
  coveragePercentage: 67,
  pendingReview: 42,
  publishedContent: 892
}
```

## Accessibility Requirements

- [ ] Keyboard navigation for all interactive elements
- [ ] ARIA labels on icon buttons
- [ ] Focus indicators visible
- [ ] Screen reader announcements for metric changes
- [ ] Semantic HTML structure
- [ ] Color contrast WCAG AA compliant

## Performance Requirements

- [ ] Initial load under 3 seconds
- [ ] Time to Interactive under 5 seconds
- [ ] Smooth animations (60fps)
- [ ] Lazy load non-critical components
- [ ] Optimize images and icons

## Testing Requirements

- [ ] Test responsive breakpoints
- [ ] Test navigation interactions
- [ ] Test logout functionality
- [ ] Test loading states
- [ ] Test error states
- [ ] Test keyboard navigation
- [ ] Test with screen reader

## Definition of Done

- [ ] Code complete and committed
- [ ] Dashboard displays correctly
- [ ] Navigation elements in place
- [ ] Responsive design verified
- [ ] Accessibility checks passed
- [ ] Performance metrics met
- [ ] Documentation updated
- [ ] Peer review completed