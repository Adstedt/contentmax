# Taxonomy Visualization Core Specification
## ContentMax Force-Directed Network Interface

### Version 1.0
### Date: January 26, 2024
### Author: Sally (UX Expert)

---

## 1. Overview

The Taxonomy Visualization is ContentMax's signature interface - a force-directed network visualization that transforms how e-commerce teams understand and manage their content ecosystem. This specification defines the core visualization system that displays up to 10,000+ nodes in an intuitive, performant, and interactive manner.

### Design Principles
- **Scalability First**: Handle 10,000+ nodes without performance degradation
- **Progressive Disclosure**: Show what matters when it matters
- **Intuitive Physics**: Natural movements that feel familiar
- **Information Density**: Maximum insight, minimum clutter
- **Mode Flexibility**: Seamless switching between different view modes

---

## 2. Layout & Interface Structure

### 2.1 Full Application Layout

```
┌────────────────────────────────────────────────────────────────────────┐
│  ContentMax  [📊 Dashboard] [🗺️ Taxonomy] [✨ Generate] [📥 Review]    │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │  CONTENT COVERAGE: 67% ████████████░░░░  1,247/1,856 pages   │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                        │
│  ┌─────────┬──────────────────────────────────────────┬──────────┐   │
│  │         │                                          │          │   │
│  │  LEFT   │         MAIN VISUALIZATION CANVAS        │  RIGHT   │   │
│  │ SIDEBAR │                                          │ SIDEBAR  │   │
│  │         │                                          │          │   │
│  └─────────┴──────────────────────────────────────────┴──────────┘   │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │  [View: Default] [Link Mode] [Heat Map] [Coverage] [Compare] │    │
│  └──────────────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Left Sidebar - Navigation & Filters

```
┌─────────────────────────┐
│  NAVIGATION            │
├─────────────────────────┤
│  🔍 Search...          │
├─────────────────────────┤
│  VIEW TYPE             │
│  ◉ Categories          │
│  ○ Brands             │
│  ○ Products           │
│                        │
│  FILTERS               │
│  Status                │
│  □ ✓ Optimized (234)  │
│  □ ⚠ Outdated (567)   │
│  ☑ ✗ Missing (446)    │
│  □ ○ No Products (89) │
│                        │
│  Size By               │
│  ◉ SKU Count          │
│  ○ Traffic            │
│  ○ Revenue            │
│                        │
│  Language              │
│  [EN ▼] All Languages │
│                        │
│  QUICK ACTIONS         │
│  [+ New Category]      │
│  [⟲ Refresh Data]     │
│  [📥 Import Sitemap]  │
└─────────────────────────┘
```

### 2.3 Right Sidebar - Context Panel

```
┌─────────────────────────┐
│  SELECTION INFO        │
├─────────────────────────┤
│  Winter Jackets        │
│  /category/winter-jack │
│                        │
│  STATUS                │
│  ● Optimized           │
│  Last Updated: 2 days  │
│                        │
│  METRICS               │
│  SKUs: 1,245           │
│  Traffic: 45K/mo       │
│  Revenue: $487K/mo     │
│  Position: #3          │
│                        │
│  ACTIONS               │
│  [✨ Generate Content] │
│  [✏️ Edit Content]     │
│  [🔄 Regenerate]      │
│  [📊 View Analytics]  │
│                        │
│  RELATIONSHIPS         │
│  Parent: Outerwear     │
│  Children: 12          │
│  Links In: 7           │
│  Links Out: 3          │
└─────────────────────────┘
```

---

## 3. Force-Directed Network Visualization

### 3.1 Node Design System

```
         OPTIMIZED              OUTDATED              MISSING              NO PRODUCTS
            (Green)              (Yellow)               (Red)                (Gray)
              ⬤                    ⬤                     ⬤                    ⬤
          [>1000 SKUs]         [500-1000]             [100-500]             [0-100]
              
         Large Node            Medium Node            Small Node            Tiny Node
           (50px)                (35px)                (25px)               (15px)
```

**Node Anatomy:**
```
    ┌─────────────┐
    │     👔      │  <- Category Icon (on hover/zoom)
    │   Shirts    │  <- Label (visible at zoom > 50%)
    │    (234)    │  <- SKU count (on hover)
    └─────────────┘
```

### 3.2 Force Physics Configuration

```javascript
const forceConfig = {
  charge: {
    strength: -300,        // Repulsion between nodes
    distanceMin: 20,       // Minimum distance
    distanceMax: 500       // Maximum influence distance
  },
  link: {
    distance: 100,         // Ideal link length
    strength: 0.7          // Link spring strength
  },
  collision: {
    radius: (node) => node.radius + 5,  // Prevent overlap
    strength: 0.7
  },
  center: {
    x: viewport.width / 2,
    y: viewport.height / 2
  }
}
```

### 3.3 Performance Optimization Levels

```
ZOOM LEVEL          RENDER DETAILS           NODE COUNT
---------------------------------------------------------
0-25%              Clusters only             Top 50
26-50%             Major nodes + edges       Top 200  
51-75%             All nodes, no labels      Top 1000
76-100%            All nodes + labels        Top 2500
100%+ (zoomed)     Full detail              Viewport only
```

---

## 4. Interaction Patterns

### 4.1 Mouse Interactions

#### Hover States
```
Node Hover:
├─ Scale: 1.0 → 1.2 (150ms ease)
├─ Glow: 4px spread, 40% opacity
├─ Tooltip: Appear after 500ms
└─ Connected nodes: Highlight at 60% opacity

Edge Hover:
├─ Thickness: 2px → 4px
├─ Color: Gray → Primary blue
└─ Show link details tooltip
```

#### Click Behaviors
| Click Type | Action |
|------------|--------|
| Single Click | Select node, show in right panel |
| Double Click | Zoom to node and its immediate network |
| Right Click | Context menu |
| Shift + Click | Add to selection |
| Ctrl + Click | Toggle selection |

#### Drag Behaviors
- **Node Drag**: Reposition with physics simulation
- **Canvas Drag**: Pan viewport
- **Lasso Drag**: Multi-select (with Alt key)

### 4.2 Zoom & Pan Controls

```
┌──────────────┐
│  ⊕  ═══●═══  ⊖│  <- Zoom slider
└──────────────┘
    
┌──────┐
│  ⬆   │          <- Pan controls
│⬅ ⊙ ➡│             (or WASD keys)
│  ⬇   │
└──────┘

[🏠 Reset] [📍 Center] [⛶ Fullscreen]
```

**Zoom Behaviors:**
- **Mouse Wheel**: Zoom in/out at cursor position
- **Pinch Gesture**: Touch zoom on tablets
- **Double Click**: Zoom in one level
- **Keyboard**: +/- keys for zoom

### 4.3 Keyboard Navigation

| Key | Action |
|-----|--------|
| `Arrow Keys` | Navigate between connected nodes |
| `Tab` | Cycle through nodes |
| `Enter` | Select focused node |
| `Space` | Toggle node expansion |
| `/` | Focus search |
| `L` | Toggle Link Mode |
| `H` | Toggle Heat Map |
| `R` | Reset view |
| `F` | Fit to screen |

---

## 5. View Modes

### 5.1 Default View
Standard force-directed layout with status colors

### 5.2 Heat Map View
```
Traffic Heat Map:
🔴 Hot (>10K/mo) 🟠 Warm (5-10K) 🟡 Medium (1-5K) 🔵 Cold (<1K)

Coverage Heat Map:
🟢 100% 🟡 50-99% 🟠 25-49% 🔴 0-24%
```

### 5.3 Coverage View
```
┌────────────────────────────────┐
│  Coverage by Depth            │
├────────────────────────────────┤
│  Level 1: ████████████ 100%   │
│  Level 2: ████████░░░░  67%   │
│  Level 3: ████░░░░░░░░  34%   │
│  Level 4: ██░░░░░░░░░░  18%   │
└────────────────────────────────┘
```

### 5.4 Comparison View
Split screen showing before/after or competitor comparison

### 5.5 Time-lapse View
Animated progression showing content coverage over time

---

## 6. Search & Navigation

### 6.1 Smart Search Interface

```
┌─────────────────────────────────────────┐
│  🔍 Search categories, brands, URLs... │
├─────────────────────────────────────────┤
│  SUGGESTIONS                           │
│  📁 /categories/winter-jackets         │
│  📁 /categories/winter-accessories     │
│  🏷️ North Face (Brand)                │
│  🏷️ Patagonia (Brand)                 │
│                                        │
│  [Search in: ◉ All ○ Categories ○ Brands] │
└─────────────────────────────────────────┘
```

**Search Behaviors:**
- Auto-complete after 2 characters
- Highlight and zoom to result
- Multiple results show list
- Search history preserved

### 6.2 Breadcrumb Navigation

```
Home > Clothing > Outerwear > Winter Jackets
```
Click any level to zoom to that scope

### 6.3 Mini-Map

```
┌──────────┐
│ ┌────┐   │  <- Mini-map showing
│ │▓▓▓▓│   │     current viewport
│ └────┘   │     within full network
│          │
└──────────┘
```

---

## 7. Clustering & Aggregation

### 7.1 Automatic Clustering

When nodes exceed density threshold:
```
    Before Clustering           After Clustering
    
    · · · · · ·                    ┌───┐
    · · · · · ·         →          │ 47│ <- Cluster badge
    · · · · · ·                    └───┘
    (47 nodes)                  (1 cluster node)
```

### 7.2 Manual Grouping

Users can create custom groups:
```
┌─────────────────────┐
│  🗂️ Custom Group    │
│  "Winter Essential" │
│  Contains: 23 items │
│  [Expand] [Edit]    │
└─────────────────────┘
```

---

## 8. Progressive Loading Strategy

### 8.1 Initial Load Sequence

```
1. Load viewport nodes (0-100ms)
   └─> Show skeleton
2. Load first neighbors (100-300ms)
   └─> Begin physics simulation
3. Load second degree (300-500ms)
   └─> Update positions
4. Background load remaining (500ms+)
   └─> Stream in as needed
```

### 8.2 Viewport Management

```javascript
class ViewportManager {
  visibleNodes() {
    return nodes.filter(node => 
      node.x > viewport.left - buffer &&
      node.x < viewport.right + buffer &&
      node.y > viewport.top - buffer &&
      node.y < viewport.bottom + buffer
    );
  }
  
  levelOfDetail(node) {
    const zoom = this.currentZoom;
    if (zoom < 0.25) return 'cluster';
    if (zoom < 0.5) return 'simple';
    if (zoom < 0.75) return 'standard';
    return 'detailed';
  }
}
```

---

## 9. Animation & Transitions

### 9.1 Animation Timing

| Action | Duration | Easing |
|--------|----------|--------|
| Node hover | 150ms | ease-out |
| Node select | 200ms | ease-in-out |
| Zoom | 300ms | ease-in-out |
| Pan | Instant | - |
| Force simulation | 60fps continuous | - |
| Mode switch | 400ms | ease-in-out |

### 9.2 Physics Animation

```
Frame Rate: 60 FPS target
Simulation Steps:
├─ Calculate forces (charge, link, collision)
├─ Update velocities
├─ Apply damping (0.4)
├─ Update positions
└─ Render changes
```

---

## 10. Mobile & Touch Adaptation

### 10.1 Touch Gestures

| Gesture | Action |
|---------|--------|
| Tap | Select node |
| Double Tap | Zoom in |
| Long Press | Context menu |
| Pinch | Zoom |
| Two-finger drag | Pan |
| Three-finger swipe | Switch modes |

### 10.2 Mobile Layout

```
┌─────────────────┐
│  ☰  ContentMax  │
├─────────────────┤
│                 │
│   VISUALIZATION │
│      CANVAS     │
│                 │
├─────────────────┤
│ [🏠][🔍][📊][⚙️] │  <- Bottom nav
└─────────────────┘
```

---

## 11. Performance Metrics

### 11.1 Target Performance

| Metric | Target | Maximum |
|--------|--------|---------|
| Initial Render | <500ms | 1000ms |
| Interaction Response | <16ms | 33ms |
| Search Results | <100ms | 200ms |
| Mode Switch | <300ms | 500ms |
| 10K Nodes Render | <2s | 3s |
| Frame Rate | 60fps | 30fps minimum |

### 11.2 Performance Monitoring

```javascript
const performanceMonitor = {
  nodeRenderTime: [],
  interactionLatency: [],
  frameRate: [],
  
  degradeGracefully() {
    if (this.frameRate < 30) {
      reduceNodeDetail();
      disableAnimations();
      enableGPUAcceleration();
    }
  }
}
```

---

## 12. Accessibility Features

### 12.1 Screen Reader Support

```html
<div role="application" aria-label="Site taxonomy visualization">
  <div role="tree">
    <div role="treeitem" 
         aria-expanded="false"
         aria-label="Winter Jackets, 1245 products, optimized">
      Winter Jackets
    </div>
  </div>
</div>
```

### 12.2 Keyboard-Only Navigation

Full functionality available without mouse:
- Tab navigation through nodes
- Arrow keys for relationships
- Enter to select/expand
- Escape to deselect

### 12.3 Alternative Views

**Table View** for accessibility:
```
┌────────────────────┬───────┬─────────┬──────┐
│ Category          │ SKUs  │ Status  │ Rev  │
├────────────────────┼───────┼─────────┼──────┤
│ Winter Jackets    │ 1,245 │ ✓ Good  │ $47K │
│ Winter Boots      │   892 │ ⚠ Old   │ $31K │
│ Winter Gloves     │   456 │ ✗ None  │ $12K │
└────────────────────┴───────┴─────────┴──────┘
```

---

## 13. Error Handling & Loading States

### 13.1 Loading States

```
Initial Load:
┌────────────────────────┐
│  ⠋ Loading taxonomy... │
│  Found 1,856 pages     │
│  ████████░░ 67%        │
└────────────────────────┘

Network Error:
┌────────────────────────┐
│  ⚠️ Connection Issue    │
│  Using cached data     │
│  Last updated: 2 hours │
│  [Retry] [Continue]    │
└────────────────────────┘
```

### 13.2 Fallback Strategies

1. **Too Many Nodes**: Automatically cluster
2. **Slow Performance**: Reduce detail level
3. **WebGL Failure**: Fall back to Canvas
4. **Network Issues**: Use cached visualization

---

## 14. Integration Points

### 14.1 Mode Transitions

Smooth transitions between:
- Default View → Link Mode
- Link Mode → Heat Map
- Any Mode → Search Result

### 14.2 Data Synchronization

```javascript
// Real-time updates via Supabase
supabase
  .from('taxonomy')
  .on('UPDATE', payload => {
    updateNode(payload.new);
    recalculateForces();
  })
  .subscribe();
```

---

## 15. Success Metrics

- **Load Time**: <2s for 10,000 nodes
- **Interaction**: <16ms response time
- **Adoption**: 90% use visualization daily
- **Efficiency**: 50% faster to find content gaps
- **Satisfaction**: 4.5+ star rating

---

## Next Steps

1. Create WebGL prototype for performance testing
2. Build clustering algorithm for large datasets
3. Design onboarding tour for first-time users
4. Develop color-blind friendly themes
5. Create performance benchmarking suite