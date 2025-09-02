# Documentation Cleanup Strategy - Revenue Optimization Pivot

## Keep (Core Revenue Optimization)

✅ `/docs/prd-revenue-optimization.md` - New focused PRD
✅ `/docs/architecture/revenue-optimization-architecture.md` - Technical blueprint
✅ `/docs/architecture/node-centric-architecture.md` - Data model
✅ `/docs/stories/sprint-4-revenue/` - Data & Intelligence sprint
✅ `/docs/stories/sprint-5-revenue/` - AI Optimization sprint
✅ `/docs/stories/sprint-3/` - Visualization sprint (with modifications)

## Archive (Generic Content Platform)

📦 `/docs/prd.md` - Original PRD → `/docs/archive/`
📦 `/docs/stories/sprint-1/` - Generic templates → `/docs/archive/`
📦 `/docs/stories/sprint-2/` - Multi-language → `/docs/archive/`
📦 Any workflow automation docs → `/docs/archive/`
📦 Template system docs → `/docs/archive/`

## Update

🔄 `/README.md` - Focus on revenue optimization value prop
🔄 `/docs/stories/sprint-3/` - Modify stories for performance overlays
🔄 `/docs/api/` - Add performance endpoints documentation
🔄 `/docs/setup/` - Simplify onboarding for e-commerce focus

## Create New

📝 `/docs/quick-start.md` - 5-minute setup for e-commerce sites
📝 `/docs/integrations/` - GSC, GA4, Shopify guides
📝 `/docs/metrics-glossary.md` - Explain opportunity scoring
📝 `/docs/case-studies/` - ROI examples

## Code Cleanup Priority

### Phase 1: Quick Wins (This Week)

1. Update package.json description
2. Remove unused dependencies (multi-language libs)
3. Update environment variables template
4. Clean up unused API routes

### Phase 2: Refactor (Next Sprint)

1. Rename generic "content" references to "optimization"
2. Remove template generation code
3. Streamline database schema (remove unused tables)
4. Focus UI on taxonomy + optimization panels

### Phase 3: Polish (Post-MVP)

1. Remove all generic CMS features
2. Optimize bundle size
3. Add revenue-focused analytics
4. Implement proper telemetry

## Migration Path

```bash
# 1. Create archive directory
mkdir docs/archive

# 2. Move outdated docs
mv docs/prd.md docs/archive/
mv docs/stories/sprint-1 docs/archive/
mv docs/stories/sprint-2 docs/archive/

# 3. Update active documentation
# (Stories 3.2, 3.4 already being updated)

# 4. Update README with new focus
```

## Why This Works

- **70% Code Reuse**: Core infrastructure stays
- **Clear Value Prop**: Revenue focus is compelling
- **Faster to Market**: 6 weeks vs 6 months rebuild
- **Progressive Enhancement**: Can add features incrementally
- **Technical Debt Minimal**: Architecture supports the pivot

## Next Immediate Steps

1. ✅ Finish updating Sprint 3 stories (in progress)
2. Move outdated docs to archive
3. Update README with revenue focus
4. Test existing D3 viz with mock performance data
5. Start Sprint 4 implementation (GSC integration)

## Success Metrics

- Documentation reflects single purpose
- No references to generic content generation
- All user journeys lead to revenue optimization
- Onboarding time < 10 minutes
- Time to first value < 24 hours

---

**Recommendation**: Definitely pivot, don't restart. You have a solid foundation that just needs focusing. The revenue optimization angle is much stronger than generic content generation.
