# Story 3.4: Heat Map & Status Indicators

## User Story

As a content manager,
I want to see color-coded content status at a glance,
So that I can quickly identify which areas need attention.

## Size & Priority

- **Size**: S (3 hours)
- **Priority**: P0 - Critical
- **Sprint**: 3
- **Dependencies**: Task 3.1

## Description

Implement color coding for content status with a clear legend, making it easy to identify optimized, outdated, missing, and no-content areas.

## Implementation Steps

1. **Color mapping system**

   ```typescript
   enum ContentStatus {
     OPTIMIZED = 'optimized',
     OUTDATED = 'outdated',
     MISSING = 'missing',
     NO_CONTENT = 'no_content',
     IN_PROGRESS = 'in_progress',
     ERROR = 'error',
   }

   class ColorMapper {
     private colorScheme = {
       optimized: {
         primary: '#10b981', // Green
         secondary: '#34d399',
         border: '#059669',
         glow: 'rgba(16, 185, 129, 0.3)',
       },
       outdated: {
         primary: '#f59e0b', // Yellow/Amber
         secondary: '#fbbf24',
         border: '#d97706',
         glow: 'rgba(245, 158, 11, 0.3)',
       },
       missing: {
         primary: '#ef4444', // Red
         secondary: '#f87171',
         border: '#dc2626',
         glow: 'rgba(239, 68, 68, 0.3)',
       },
       no_content: {
         primary: '#9ca3af', // Gray
         secondary: '#d1d5db',
         border: '#6b7280',
         glow: 'rgba(156, 163, 175, 0.3)',
       },
       in_progress: {
         primary: '#3b82f6', // Blue
         secondary: '#60a5fa',
         border: '#2563eb',
         glow: 'rgba(59, 130, 246, 0.3)',
       },
       error: {
         primary: '#7c3aed', // Purple
         secondary: '#a78bfa',
         border: '#6d28d9',
         glow: 'rgba(124, 58, 237, 0.3)',
       },
     };

     getNodeColor(node: Node, property: 'primary' | 'border' | 'glow' = 'primary'): string {
       const status = node.contentStatus || ContentStatus.NO_CONTENT;
       return this.colorScheme[status][property];
     }

     getGradient(ctx: CanvasRenderingContext2D, node: Node): CanvasGradient {
       const gradient = ctx.createRadialGradient(
         node.x!,
         node.y!,
         0,
         node.x!,
         node.y!,
         node.radius
       );

       const colors = this.colorScheme[node.contentStatus];
       gradient.addColorStop(0, colors.secondary);
       gradient.addColorStop(0.7, colors.primary);
       gradient.addColorStop(1, colors.border);

       return gradient;
     }
   }
   ```

2. **Legend component**

   ```typescript
   interface LegendProps {
     statistics?: {
       optimized: number;
       outdated: number;
       missing: number;
       noContent: number;
     };
     onFilterChange?: (status: ContentStatus[]) => void;
   }

   const Legend: React.FC<LegendProps> = ({ statistics, onFilterChange }) => {
     const [activeFilters, setActiveFilters] = useState<Set<ContentStatus>>(
       new Set(Object.values(ContentStatus))
     );

     const legendItems = [
       {
         status: ContentStatus.OPTIMIZED,
         label: 'Optimized',
         color: '#10b981',
         description: 'Content is up-to-date and optimized'
       },
       {
         status: ContentStatus.OUTDATED,
         label: 'Outdated',
         color: '#f59e0b',
         description: 'Content needs updating'
       },
       {
         status: ContentStatus.MISSING,
         label: 'Missing',
         color: '#ef4444',
         description: 'No content exists'
       },
       {
         status: ContentStatus.NO_CONTENT,
         label: 'No Products',
         color: '#9ca3af',
         description: 'Category has no products'
       }
     ];

     const toggleFilter = (status: ContentStatus) => {
       const newFilters = new Set(activeFilters);
       if (newFilters.has(status)) {
         newFilters.delete(status);
       } else {
         newFilters.add(status);
       }
       setActiveFilters(newFilters);
       onFilterChange?.(Array.from(newFilters));
     };

     return (
       <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-4">
         <h3 className="text-sm font-semibold mb-2">Content Status</h3>
         <div className="space-y-2">
           {legendItems.map(item => (
             <div
               key={item.status}
               className={`flex items-center gap-2 cursor-pointer transition-opacity ${
                 activeFilters.has(item.status) ? 'opacity-100' : 'opacity-50'
               }`}
               onClick={() => toggleFilter(item.status)}
             >
               <div
                 className="w-4 h-4 rounded-full"
                 style={{ backgroundColor: item.color }}
               />
               <span className="text-sm">{item.label}</span>
               {statistics && (
                 <span className="text-xs text-gray-500 ml-auto">
                   {statistics[item.status]}
                 </span>
               )}
             </div>
           ))}
         </div>
       </div>
     );
   };
   ```

3. **Visual effects for status**

   ```typescript
   class StatusEffects {
     private animations: Map<string, Animation> = new Map();

     applyGlowEffect(ctx: CanvasRenderingContext2D, node: Node, intensity = 1) {
       if (node.contentStatus === ContentStatus.MISSING) {
         // Pulsing glow for critical items
         const pulse = Math.sin(Date.now() * 0.003) * 0.5 + 0.5;
         ctx.shadowColor = this.colorMapper.getNodeColor(node, 'glow');
         ctx.shadowBlur = 10 + pulse * 10;
       } else if (node.contentStatus === ContentStatus.OUTDATED) {
         // Subtle glow for attention
         ctx.shadowColor = this.colorMapper.getNodeColor(node, 'glow');
         ctx.shadowBlur = 5;
       }
     }

     renderStatusBadge(ctx: CanvasRenderingContext2D, node: Node) {
       // Small indicator badge
       const badgeRadius = 4;
       const badgeX = node.x! + node.radius * 0.7;
       const badgeY = node.y! - node.radius * 0.7;

       ctx.beginPath();
       ctx.arc(badgeX, badgeY, badgeRadius, 0, 2 * Math.PI);
       ctx.fillStyle = '#fff';
       ctx.fill();

       ctx.beginPath();
       ctx.arc(badgeX, badgeY, badgeRadius - 1, 0, 2 * Math.PI);

       // Icon based on status
       if (node.contentStatus === ContentStatus.MISSING) {
         ctx.fillStyle = '#ef4444';
         ctx.fill();
         // Draw exclamation mark
         ctx.fillStyle = '#fff';
         ctx.font = 'bold 6px sans-serif';
         ctx.textAlign = 'center';
         ctx.fillText('!', badgeX, badgeY + 2);
       } else if (node.contentStatus === ContentStatus.OPTIMIZED) {
         ctx.fillStyle = '#10b981';
         ctx.fill();
         // Draw checkmark
         ctx.strokeStyle = '#fff';
         ctx.lineWidth = 1;
         ctx.beginPath();
         ctx.moveTo(badgeX - 2, badgeY);
         ctx.lineTo(badgeX - 0.5, badgeY + 1.5);
         ctx.lineTo(badgeX + 2, badgeY - 1.5);
         ctx.stroke();
       }
     }
   }
   ```

4. **Statistics overlay**

   ```typescript
   interface StatusStatistics {
     total: number;
     byStatus: Record<ContentStatus, number>;
     coverage: number; // Percentage
     criticalCount: number; // Missing content in high-value areas
   }

   const StatusOverlay: React.FC<{ stats: StatusStatistics }> = ({ stats }) => {
     const coverageColor =
       stats.coverage > 80 ? 'text-green-600' :
       stats.coverage > 60 ? 'text-yellow-600' :
       'text-red-600';

     return (
       <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-4">
         <div className="text-2xl font-bold mb-2">
           <span className={coverageColor}>{stats.coverage}%</span>
           <span className="text-sm font-normal text-gray-500 ml-2">Coverage</span>
         </div>

         <div className="grid grid-cols-2 gap-2 text-sm">
           <div className="flex items-center gap-1">
             <div className="w-3 h-3 bg-green-500 rounded-full" />
             <span>{stats.byStatus.optimized} optimized</span>
           </div>
           <div className="flex items-center gap-1">
             <div className="w-3 h-3 bg-amber-500 rounded-full" />
             <span>{stats.byStatus.outdated} outdated</span>
           </div>
           <div className="flex items-center gap-1">
             <div className="w-3 h-3 bg-red-500 rounded-full" />
             <span>{stats.byStatus.missing} missing</span>
           </div>
           <div className="flex items-center gap-1">
             <div className="w-3 h-3 bg-gray-400 rounded-full" />
             <span>{stats.byStatus.noContent} empty</span>
           </div>
         </div>

         {stats.criticalCount > 0 && (
           <div className="mt-2 p-2 bg-red-50 rounded text-sm text-red-700">
             ⚠️ {stats.criticalCount} critical pages need content
           </div>
         )}
       </div>
     );
   };
   ```

5. **Filter by status**
   ```typescript
   class StatusFilter {
     private activeStatuses = new Set(Object.values(ContentStatus));

     filterNodes(nodes: Node[]): Node[] {
       return nodes.filter((node) => this.activeStatuses.has(node.contentStatus));
     }

     toggleStatus(status: ContentStatus) {
       if (this.activeStatuses.has(status)) {
         this.activeStatuses.delete(status);
       } else {
         this.activeStatuses.add(status);
       }
       this.onFilterChange();
     }

     showOnly(status: ContentStatus) {
       this.activeStatuses.clear();
       this.activeStatuses.add(status);
       this.onFilterChange();
     }

     showAll() {
       Object.values(ContentStatus).forEach((status) => this.activeStatuses.add(status));
       this.onFilterChange();
     }
   }
   ```

## Files to Create

- `lib/visualization/color-mapper.ts` - Color mapping logic
- `lib/visualization/status-effects.ts` - Visual effects for status
- `lib/visualization/status-filter.ts` - Filter nodes by status
- `components/taxonomy/Legend.tsx` - Interactive legend component
- `components/taxonomy/StatusOverlay.tsx` - Statistics overlay
- `components/taxonomy/StatusBadge.tsx` - Status indicator badges
- `types/status.types.ts` - Status-related types

## Visual Specifications

### Color Palette

```css
/* Status Colors */
--status-optimized: #10b981; /* Green - All good */
--status-outdated: #f59e0b; /* Amber - Needs update */
--status-missing: #ef4444; /* Red - Critical */
--status-no-content: #9ca3af; /* Gray - No products */
--status-in-progress: #3b82f6; /* Blue - Being worked on */
--status-error: #7c3aed; /* Purple - Processing error */

/* Supporting colors */
--glow-intensity: 0.3;
--border-darkness: 0.8;
--badge-size: 8px;
```

## Acceptance Criteria

- [ ] Nodes colored by content status
- [ ] Legend shows all status types
- [ ] Click legend to filter nodes
- [ ] Statistics overlay shows coverage
- [ ] Critical items highlighted
- [ ] Smooth color transitions
- [ ] Tooltips show status details
- [ ] Colorblind-friendly mode available

## Accessibility

- [ ] Color not sole indicator (add patterns/badges)
- [ ] ARIA labels for status
- [ ] Keyboard navigation for legend
- [ ] High contrast mode support
- [ ] Screen reader announces status

## Performance

- Color calculation: <1ms per node
- Filter updates: <50ms for 3,000 nodes
- No performance impact from effects
- Smooth 60fps with all effects

## Testing Requirements

- [ ] Test all status colors render correctly
- [ ] Test legend interaction
- [ ] Test filtering by status
- [ ] Test statistics calculation
- [ ] Test colorblind mode
- [ ] Test performance with effects
- [ ] Test tooltip information
- [ ] Test accessibility features

## Definition of Done

- [ ] Code complete and committed
- [ ] Color coding implemented
- [ ] Legend interactive and clear
- [ ] Statistics accurate
- [ ] Visual effects working
- [ ] Filtering functional
- [ ] Accessibility requirements met
- [ ] Tests written and passing
- [ ] Peer review completed
