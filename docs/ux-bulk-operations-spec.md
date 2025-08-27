# Bulk Selection & Operations Specification

## ContentMax Multi-Select and Batch Processing Interface

### Version 1.0

### Date: January 26, 2024

### Author: Sally (UX Expert)

---

## 1. Overview

The Bulk Selection & Operations system enables users to efficiently manage content at scale by selecting multiple nodes in the taxonomy visualization and performing batch actions. This specification defines how users select, manage, and process groups of content items, transforming hours of individual work into minutes of bulk operations.

### Design Philosophy

- **Intuitive Selection**: Multiple methods matching user mental models
- **Visual Feedback**: Always know what's selected and why
- **Smart Defaults**: Intelligent suggestions for bulk actions
- **Progressive Disclosure**: Simple for basic, powerful for advanced
- **Reversibility**: Undo protection for large-scale changes

---

## 2. Selection Methods

### 2.1 Lasso Selection Tool

```
Activation: Hold Alt + Drag (or click Lasso tool icon)

    Start Drag              During Selection           Release

         X                  ╔═══════════╗            ┌─────────┐
                           ║     ○ ○     ║           │  ● ● 5  │
    (Alt + Click)         ║   ○ ○ ○ ○   ║           │ ● ● ●   │
                          ║     ○ ○ ○    ║           │   ● ●   │
                           ╚═══════════╝             └─────────┘
                           Dotted outline            Selected nodes
```

**Visual Feedback:**

- Dotted line follows cursor (2px, animated dashes)
- Semi-transparent blue fill (20% opacity)
- Nodes highlight as lasso encompasses them
- Counter shows selection count in real-time
- Release animates to selection confirmation

### 2.2 Rectangle Selection

```
Activation: Shift + Drag

┌─ ─ ─ ─ ─ ─ ─ ─ ─┐
│  ○  ○  ●  ●  ○  │    ● = Selected
│  ○  ●  ●  ●  ○  │    ○ = Not selected
│  ○  ●  ●  ○  ○  │
└─ ─ ─ ─ ─ ─ ─ ─ ─┘
```

### 2.3 Click Selection Patterns

| Method       | Action        | Result                    |
| ------------ | ------------- | ------------------------- |
| Click        | Select single | Clear others, select one  |
| Ctrl+Click   | Toggle single | Add/remove from selection |
| Shift+Click  | Range select  | Select path between nodes |
| Double Click | Select branch | Node + all children       |
| Triple Click | Select tree   | Entire connected tree     |

### 2.4 Smart Selection Commands

```
┌──────────────────────────────────────┐
│  SMART SELECT                        │
├──────────────────────────────────────┤
│  By Similarity                       │
│  ├─ Same Status (Missing)           │
│  ├─ Same Level (Depth 2)            │
│  ├─ Similar Size (1000+ SKUs)       │
│  └─ Same Parent                     │
│                                      │
│  By Performance                     │
│  ├─ High Traffic (>10K/mo)          │
│  ├─ Low Conversion (<1%)            │
│  └─ No Content                      │
│                                      │
│  By Relationship                    │
│  ├─ All Children                    │
│  ├─ All Siblings                    │
│  └─ Connected Nodes                 │
│                                      │
│  [Apply] [Save Selection Group]     │
└──────────────────────────────────────┘
```

### 2.5 Selection from Table View

```
┌─────────────────────────────────────────────────┐
│  □ Select All | ▣ 47 selected                  │
├─────────────────────────────────────────────────┤
│  ☑ Winter Jackets      1,245 SKUs    Missing  │
│  ☑ Winter Boots          892 SKUs    Missing  │
│  ☑ Winter Gloves         456 SKUs    Outdated │
│  □ Summer Hats           234 SKUs    Good     │
└─────────────────────────────────────────────────┘
```

---

## 3. Selection Management

### 3.1 Selection Counter & Summary

```
┌───────────────────────────────────────────────┐
│  SELECTION: 47 items                         │
├───────────────────────────────────────────────┤
│  Categories: 38 | Brands: 9                  │
│  Total SKUs: 12,456                          │
│  Total Traffic: 487K/mo                      │
│  Est. Revenue Impact: $1.2M/mo               │
│                                              │
│  Status Breakdown:                           │
│  ● 12 Optimized ⚠ 18 Outdated ✗ 17 Missing │
└───────────────────────────────────────────────┘
```

### 3.2 Selection Groups (Saved Selections)

```
┌──────────────────────────────────┐
│  SAVED SELECTIONS               │
├──────────────────────────────────┤
│  📁 High Priority (23)          │
│  📁 Winter Collection (67)      │
│  📁 Needs Review (45)           │
│  📁 Q1 Content Plan (102)       │
│  📁 Competitor Gaps (34)        │
│                                 │
│  [+ Save Current Selection]     │
└──────────────────────────────────┘
```

### 3.3 Selection Modification Tools

```
┌─────────────────────────────────┐
│  REFINE SELECTION              │
├─────────────────────────────────┤
│  [Expand] [Contract] [Invert]  │
│                                │
│  Add to Selection:             │
│  [+Children] [+Parents]        │
│  [+Similar] [+Connected]       │
│                                │
│  Remove from Selection:        │
│  [-Optimized] [-Low Value]     │
│                                │
│  [Clear Selection]             │
└─────────────────────────────────┘
```

---

## 4. Bulk Actions Menu

### 4.1 Primary Bulk Actions

```
┌──────────────────────────────────────────────────┐
│  BULK ACTIONS (47 items selected)              │
├──────────────────────────────────────────────────┤
│                                                 │
│  CONTENT OPERATIONS                            │
│  ┌──────────────┐ ┌──────────────┐            │
│  │ ✨ Generate  │ │ 🔄 Regenerate│            │
│  │   Content    │ │   Content    │            │
│  └──────────────┘ └──────────────┘            │
│                                                 │
│  ┌──────────────┐ ┌──────────────┐            │
│  │ 📝 Edit      │ │ 🗑️ Delete    │            │
│  │  Templates   │ │   Content    │            │
│  └──────────────┘ └──────────────┘            │
│                                                 │
│  WORKFLOW                                      │
│  ┌──────────────┐ ┌──────────────┐            │
│  │ ➡️ Move to   │ │ 🏷️ Add Tags  │            │
│  │   Stage      │ │              │            │
│  └──────────────┘ └──────────────┘            │
│                                                 │
│  OPTIMIZATION                                  │
│  ┌──────────────┐ ┌──────────────┐            │
│  │ 🔗 Add Links │ │ 📊 Analyze   │            │
│  │              │ │   SEO        │            │
│  └──────────────┘ └──────────────┘            │
│                                                 │
│  [More Actions ▼]                             │
└──────────────────────────────────────────────────┘
```

### 4.2 Bulk Generate Content Wizard

```
Step 1: Confirm Selection
┌─────────────────────────────────────┐
│  Generate Content for 47 Pages     │
├─────────────────────────────────────┤
│  ☑ 38 Categories                   │
│  ☑ 9 Brand Pages                   │
│                                     │
│  Template Assignment:              │
│  Categories: [Category Template ▼] │
│  Brands: [Brand Template ▼]        │
│                                     │
│  [Back] [Next: Configure]          │
└─────────────────────────────────────┘

Step 2: Configuration
┌─────────────────────────────────────┐
│  Generation Settings                │
├─────────────────────────────────────┤
│  Language: [English ▼]             │
│  Tone: [Professional ▼]            │
│  Length: [~500 words ▼]            │
│                                     │
│  ☑ Include FAQ Section             │
│  ☑ Generate Schema Markup          │
│  ☑ Auto-link Related Pages         │
│  ☐ Override Existing Content       │
│                                     │
│  Priority Order:                   │
│  ◉ By Traffic (Highest First)      │
│  ○ By SKU Count                    │
│  ○ Alphabetical                    │
│                                     │
│  [Back] [Next: Review Cost]        │
└─────────────────────────────────────┘

Step 3: Cost & Confirmation
┌─────────────────────────────────────┐
│  Generation Summary                 │
├─────────────────────────────────────┤
│  Pages: 47                         │
│  Est. Tokens: ~47,000               │
│  Est. Cost: $2.35                  │
│  Est. Time: 12 minutes             │
│                                     │
│  Potential Impact:                 │
│  • Search Volume: +234K/mo         │
│  • Traffic: +11,200 visits/mo      │
│  • Revenue: +$487K/mo              │
│                                     │
│  Queue Priority: High              │
│                                     │
│  [Back] [🚀 Start Generation]      │
└─────────────────────────────────────┘
```

### 4.3 Bulk Edit Interface

```
┌───────────────────────────────────────────┐
│  BULK EDIT (47 items)                   │
├───────────────────────────────────────────┤
│  Apply Changes To:                      │
│  ☑ All Selected Items                   │
│                                          │
│  FIELDS TO UPDATE                       │
│  ┌──────────────────────────────────┐   │
│  │ Status: [Keep Current ▼]        │   │
│  │ Language: [Keep Current ▼]      │   │
│  │ Template: [Keep Current ▼]      │   │
│  │ Priority: [Set to High ▼]       │   │
│  │ Tags: +winter, +priority         │   │
│  └──────────────────────────────────┘   │
│                                          │
│  DANGER ZONE                            │
│  ○ Archive Content                     │
│  ○ Delete Pages                        │
│  ○ Reset to Default                    │
│                                          │
│  [Cancel] [Preview Changes] [Apply]     │
└───────────────────────────────────────────┘
```

---

## 5. Visual Feedback Systems

### 5.1 Selection States in Visualization

```
Node States:
○ = Normal (not selected)
● = Selected (primary selection)
◐ = Partial (some children selected)
◍ = Related (connected to selection)
⊗ = Excluded (explicitly removed)
```

### 5.2 Selection Animation

```
Selection Process:
1. Hover: Subtle pulse (scale 1.0 → 1.05)
2. Select: Blue ring expands (0 → 20px, 200ms)
3. Added: Brief glow effect
4. Batch Select: Ripple effect from center
```

### 5.3 Bulk Operation Progress

```
┌──────────────────────────────────────────┐
│  GENERATING CONTENT                     │
├──────────────────────────────────────────┤
│  ████████████████░░░░░░ 67%            │
│  31 of 47 completed                    │
│                                         │
│  Current: Winter Gloves                │
│  Status: Generating FAQ section...     │
│                                         │
│  ✓ Winter Jackets - Complete           │
│  ✓ Winter Boots - Complete             │
│  ⟳ Winter Gloves - In Progress         │
│  ○ Winter Scarves - Queued             │
│                                         │
│  Time Elapsed: 8:34                    │
│  Est. Remaining: 3:26                  │
│                                         │
│  [Pause] [Cancel] [Run in Background]  │
└──────────────────────────────────────────┘
```

---

## 6. Smart Prioritization

### 6.1 Priority Scoring Interface

```
┌────────────────────────────────────────┐
│  SMART PRIORITIZATION                 │
├────────────────────────────────────────┤
│  Auto-order selected items by:        │
│                                       │
│  VALUE METRICS                        │
│  [────●────] Traffic (60%)            │
│  [──●──────] Revenue (30%)            │
│  [●────────] SKU Count (10%)          │
│                                       │
│  CONTENT GAPS                         │
│  ☑ Prioritize missing content         │
│  ☑ Deprioritize recent updates        │
│                                       │
│  BUSINESS RULES                       │
│  ☑ Seasonal relevance (Winter: High)  │
│  ☑ Competitor gaps first              │
│                                       │
│  Preview Order:                       │
│  1. Winter Jackets ($47K/mo) 🔥       │
│  2. Snow Boots ($38K/mo) 🔥           │
│  3. Thermal Wear ($31K/mo)            │
│  ...                                  │
│                                       │
│  [Reset] [Apply Prioritization]       │
└────────────────────────────────────────┘
```

### 6.2 Batch Queuing System

```
┌─────────────────────────────────┐
│  BATCH QUEUE                   │
├─────────────────────────────────┤
│  Active: Winter Collection (47)│
│  ████████░░ 67% Complete       │
│                                │
│  Queued:                       │
│  2. Spring Arrivals (82)       │
│  3. Sale Items (156)           │
│  4. New Brands (34)            │
│                                │
│  [+ Add to Queue]              │
│  [⟳ Reorder] [❌ Clear Queue]  │
└─────────────────────────────────┘
```

---

## 7. Keyboard Shortcuts

### 7.1 Selection Shortcuts

| Shortcut       | Action                        |
| -------------- | ----------------------------- |
| `Ctrl+A`       | Select all visible            |
| `Ctrl+Shift+A` | Select all (including hidden) |
| `Ctrl+I`       | Invert selection              |
| `Ctrl+D`       | Deselect all                  |
| `Ctrl+G`       | Group selection               |
| `Ctrl+Shift+G` | Ungroup                       |
| `Alt+Drag`     | Lasso select                  |
| `Shift+Drag`   | Rectangle select              |

### 7.2 Action Shortcuts

| Shortcut     | Action              |
| ------------ | ------------------- |
| `Ctrl+Enter` | Quick generate      |
| `Delete`     | Remove content      |
| `Ctrl+E`     | Bulk edit           |
| `Ctrl+P`     | Open priority panel |
| `Ctrl+Q`     | Add to queue        |

---

## 8. Undo/Redo System

### 8.1 Bulk Operation History

```
┌──────────────────────────────┐
│  HISTORY                    │
├──────────────────────────────┤
│  ↶ Generated 47 pages       │
│  ↶ Edited 23 templates      │
│  ↷ Deleted 5 pages          │
│  ↶ Moved 67 to Review       │
│                             │
│  [↶ Undo] [↷ Redo]         │
└──────────────────────────────┘
```

### 8.2 Confirmation Dialogs

```
┌─────────────────────────────────────┐
│  ⚠️ Confirm Bulk Operation          │
├─────────────────────────────────────┤
│  You're about to generate content  │
│  for 47 pages. This will:          │
│                                     │
│  • Cost approximately $2.35        │
│  • Take ~12 minutes                │
│  • Override 5 existing pages       │
│                                     │
│  ☑ Don't ask again for this        │
│    session                          │
│                                     │
│  [Cancel] [Proceed]                │
└─────────────────────────────────────┘
```

---

## 9. Mobile Adaptation

### 9.1 Touch Selection

```
Touch Gestures:
- Tap: Select single
- Long press: Multi-select mode
- Two-finger box: Rectangle select
- Pinch out on group: Expand selection
```

### 9.2 Mobile Bulk Actions

```
┌─────────────────┐
│  47 Selected    │
├─────────────────┤
│ [Generate] [▼]  │
├─────────────────┤
│                 │
│   Simplified    │
│   Actions       │
│                 │
└─────────────────┘
```

---

## 10. Performance Optimization

### 10.1 Large Selection Handling

```javascript
class SelectionManager {
  // Virtual selection for large sets
  virtualSelection = new Set();

  // Chunked processing
  async processBulkAction(items, action) {
    const CHUNK_SIZE = 50;
    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
      const chunk = items.slice(i, i + CHUNK_SIZE);
      await this.processChunk(chunk, action);
      this.updateProgress(i / items.length);
    }
  }

  // Debounced updates
  updateVisualization = debounce(() => {
    this.renderSelection();
  }, 100);
}
```

### 10.2 Performance Targets

| Operation     | Items  | Target Time |
| ------------- | ------ | ----------- |
| Select All    | 10,000 | <100ms      |
| Lasso Select  | 500    | <50ms       |
| Bulk Generate | 100    | <30s setup  |
| Apply Filter  | 10,000 | <200ms      |

---

## 11. Integration with Other Systems

### 11.1 Speed Review Queue

Selected items can be sent directly to Speed Review:

```
[Send 47 items to Speed Review →]
```

### 11.2 Link Mode Integration

In Link Mode, bulk selection creates multiple links:

```
Select sources → Switch to Link Mode → Draw to target
Creates links from all selected to target
```

### 11.3 Export Options

```
┌────────────────────────────┐
│  EXPORT SELECTION         │
├────────────────────────────┤
│  Format:                  │
│  ◉ CSV                    │
│  ○ JSON                   │
│  ○ Sitemap XML            │
│                           │
│  Include:                 │
│  ☑ URLs                   │
│  ☑ Status                 │
│  ☑ Metrics                │
│  ☑ Content                │
│                           │
│  [Download]               │
└────────────────────────────┘
```

---

## 12. Success Metrics

- **Selection Speed**: <2s to select 100+ nodes
- **Bulk Generation**: 100+ pages initiated in <30s
- **Error Rate**: <1% failed bulk operations
- **Efficiency Gain**: 10x faster than individual operations
- **User Satisfaction**: 4.5+ rating for bulk features

---

## Next Steps

1. Prototype lasso selection algorithm
2. Design chunked processing for large batches
3. Create undo/redo state management
4. Build selection group persistence
5. Develop smart prioritization engine
