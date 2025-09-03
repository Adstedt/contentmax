# Story: Visual Encoding for Taxonomy Nodes - Brownfield Addition

## User Story

As a **content strategist**,  
I want **to quickly identify optimization status and content volume through visual cues (color and size)**,  
So that **I can prioritize which taxonomy nodes need immediate attention at a glance**.

## Story Context

**Existing System Integration:**

- Integrates with: D3 Force Graph visualization, Canvas renderer
- Technology: D3.js scales, Canvas 2D context, TypeScript
- Follows pattern: Existing D3 visualization rendering patterns
- Touch points:
  - Node rendering in Canvas
  - Hover and selection states
  - Edge/link rendering
  - Dark mode support

## Acceptance Criteria

**Functional Requirements:**

1. Node colors indicate optimization status (green=optimized, yellow=needs work, red=critical, gray=no data)
2. Node sizes represent product count using logarithmic scale (5-30px radius)
3. Edge thickness shows traffic flow between nodes
4. Hover states show lighter color variants

**Integration Requirements:** 5. Works with existing Canvas rendering pipeline 6. Maintains current interaction states (hover, selected) 7. Supports dark mode with appropriate color adjustments 8. Performance unchanged with new visual encoding

**Quality Requirements:** 9. Colors meet WCAG AA contrast requirements 10. Smooth transitions on state changes (300ms) 11. Visual hierarchy clear at all zoom levels 12. No performance regression (<16ms render time)

## Technical Notes

- **Integration Approach:** Visual encoder class with D3 scales
- **Existing Pattern Reference:** Follow existing Canvas rendering patterns
- **Key Constraints:**
  - Must work with Canvas 2D context (not SVG)
  - Color caching for performance
  - Support theme switching without reload
  - Accessibility considerations for color blindness

## Definition of Done

- [ ] VisualTheme configuration with PRD-specified colors
- [ ] VisualEncoder class with D3 scales
- [ ] Node color based on optimization status
- [ ] Node size based on product count (log scale)
- [ ] Edge width based on traffic flow
- [ ] Dark mode support implemented

## Risk and Compatibility Check

**Minimal Risk Assessment:**

- **Primary Risk:** Color choices may not work for colorblind users
- **Mitigation:** Provide high-contrast theme option, use patterns/shapes as secondary indicators
- **Rollback:** Can revert to previous color scheme via theme config

**Compatibility Verification:**

- [x] No breaking changes to existing visualization
- [x] Pure visual update, no structural changes
- [x] Works with existing Canvas renderer
- [x] Theme configurable without code changes

## Implementation Approach

Based on existing code, here's the specific implementation path:

1. **Create** `/lib/visualization/visual-theme.ts` - Theme configuration
2. **Create** `/lib/visualization/visual-encoder.ts` - Encoding logic
3. **Update** Canvas rendering to use VisualEncoder
4. **Add** theme switcher UI component
5. **Test** with various node counts and data ranges
6. **Validate** accessibility with contrast checkers

## Validation Checklist

**Scope Validation:**

- ✅ Story can be completed in one development session (2 hours)
- ✅ Visual-only changes, no logic modifications
- ✅ Follows existing rendering patterns
- ✅ No new architecture required

**Clarity Check:**

- ✅ Color specifications from PRD are clear
- ✅ Size scaling approach defined (logarithmic)
- ✅ Success criteria are visually testable
- ✅ Rollback is simple (theme swap)

## Story Metadata

- **Created**: 2025-09-03
- **Sprint**: Sprint 3
- **Parent Task**: TASK-008-visual-encoding
- **Estimated Effort**: 2 hours
- **Priority**: P1 - High (UX clarity critical)
- **Dependencies**:
  - ✅ D3 visualization exists
  - ✅ Canvas rendering implemented
  - ✅ Node data includes optimization scores
  - ⏳ Improves visual comprehension

## Dev Agent Record

### Status

**Not Started**

### Tasks

- [ ] Create visual theme configuration
- [ ] Implement VisualEncoder class
- [ ] Add D3 scales for size/color mapping
- [ ] Update Canvas render methods
- [ ] Add hover/selected state handling
- [ ] Implement dark mode support
- [ ] Add theme switcher UI
- [ ] Test accessibility compliance

### Implementation Notes

- Use D3 scaleLog for node sizing
- Cache colors for performance
- Consider colorblind-safe palettes
- Test at various zoom levels for clarity
