# Content Generation Wizard Specification
## ContentMax AI-Powered Content Creation Interface

### Version 1.0
### Date: January 26, 2024
### Author: Sally (UX Expert)

---

## 1. Overview

The Content Generation Wizard is the interface where users configure, preview, and initiate AI-powered content creation for individual pages or bulk selections. This specification defines how users interact with templates, components, languages, and generation settings to create SEO-optimized content that maintains brand voice while achieving business objectives.

### Design Philosophy
- **Guided Experience**: Step-by-step wizard for clarity
- **Smart Defaults**: AI-suggested configurations
- **Live Preview**: See changes in real-time
- **Transparency**: Clear costs and impact predictions
- **Flexibility**: Simple for basic, powerful for advanced

---

## 2. Wizard Entry Points

### 2.1 Access Methods

```
Entry Points:
1. Taxonomy Visualization → Right-click node → "Generate Content"
2. Bulk Selection → "Generate for 47 items"
3. Top Navigation → "✨ Generate" button
4. Dashboard → Quick Action card
5. Content Inventory Table → Row action
```

### 2.2 Context Detection

System automatically detects context:
```javascript
const context = {
  source: 'taxonomy_visualization',
  selection: ['winter-jackets', 'winter-boots'],
  count: 2,
  type: 'category',
  existingContent: false,
  language: 'EN'
}
```

---

## 3. Wizard Flow Structure

### 3.1 Flow Diagram

```
Start → Target Selection → Template Choice → Component Config → 
Language & Voice → Preview → Cost Review → Generate → Success
```

### 3.2 Progress Indicator

```
┌──────────────────────────────────────────────────────────┐
│  ① Select  ② Template  ③ Configure  ④ Preview  ⑤ Generate│
│  ━━━━━━━━   ○○○○○○○    ○○○○○○○○○    ○○○○○○○   ○○○○○○○○○ │
└──────────────────────────────────────────────────────────┘
```

---

## 4. Step 1: Target Selection

### 4.1 Single Page Selection

```
┌─────────────────────────────────────────────────────┐
│  GENERATE CONTENT FOR                              │
├─────────────────────────────────────────────────────┤
│                                                     │
│  📁 Winter Jackets                                 │
│  /categories/winter-jackets                        │
│                                                     │
│  Current Status: ✗ No Content                      │
│  SKUs: 1,245                                       │
│  Monthly Traffic: 45,000                           │
│  Competition: 8/10 have content                    │
│                                                     │
│  ⚠️ This page has no existing content              │
│                                                     │
│  [Change Selection] [Next: Choose Template →]      │
└─────────────────────────────────────────────────────┘
```

### 4.2 Bulk Selection Summary

```
┌─────────────────────────────────────────────────────┐
│  GENERATE CONTENT FOR 47 PAGES                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  SELECTION BREAKDOWN                               │
│  ├─ 38 Category Pages                              │
│  ├─ 9 Brand Pages                                  │
│  └─ 0 Product Pages                                │
│                                                     │
│  STATUS                                            │
│  ● 5 Will Override Existing                        │
│  ● 42 New Content Creation                         │
│                                                     │
│  IMPACT PREVIEW                                    │
│  Addressable Search Volume: +487K/mo               │
│  Potential Traffic: +23,400 visits/mo              │
│  Revenue Opportunity: $1.2M/mo                     │
│                                                     │
│  [Modify Selection] [Next: Choose Templates →]     │
└─────────────────────────────────────────────────────┘
```

---

## 5. Step 2: Template Selection

### 5.1 Template Gallery

```
┌─────────────────────────────────────────────────────────┐
│  SELECT CONTENT TEMPLATE                               │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  RECOMMENDED FOR YOUR SELECTION                        │
│                                                         │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐     │
│  │  CATEGORY   │ │   BRAND     │ │   INSPIRE   │     │
│  │  TEMPLATE   │ │  TEMPLATE   │ │  TEMPLATE   │     │
│  │             │ │             │ │             │     │
│  │ ⭐ Best for │ │  For brand  │ │  Editorial  │     │
│  │  categories │ │   stories   │ │   content   │     │
│  │             │ │             │ │             │     │
│  │  [Select]   │ │  [Select]   │ │  [Preview]  │     │
│  └─────────────┘ └─────────────┘ └─────────────┘     │
│                                                         │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐     │
│  │   ENGAGE    │ │   CUSTOM    │ │   HYBRID    │     │
│  │  TEMPLATE   │ │  TEMPLATE   │ │  TEMPLATE   │     │
│  │             │ │             │ │             │     │
│  │    Q&A      │ │  Build your │ │  AI picks   │     │
│  │   focused   │ │     own     │ │  components │     │
│  │             │ │             │ │             │     │
│  │  [Preview]  │ │  [Create]   │ │  [Preview]  │     │
│  └─────────────┘ └─────────────┘ └─────────────┘     │
│                                                         │
│  [Back] [Next: Configure Components →]                 │
└─────────────────────────────────────────────────────────┘
```

### 5.2 Template Details Panel

```
┌──────────────────────────────────────┐
│  CATEGORY TEMPLATE                  │
├──────────────────────────────────────┤
│                                      │
│  INCLUDES:                          │
│  ✓ Hero Section (H1, intro)        │
│  ✓ Product Grid                    │
│  ✓ Buying Guide                    │
│  ✓ FAQ Section                     │
│  ✓ Related Categories              │
│                                      │
│  SEO FEATURES:                      │
│  • FAQ Schema                       │
│  • Product Schema                   │
│  • Breadcrumb Schema                │
│                                      │
│  AVG PERFORMANCE:                   │
│  • Words: 800-1200                  │
│  • Read Time: 4-5 min               │
│  • SEO Score: 92/100                │
│                                      │
│  [🔍 Preview Example]                │
└──────────────────────────────────────┘
```

---

## 6. Step 3: Component Configuration

### 6.1 Component Builder Interface

```
┌───────────────────────────────────────────────────────────┐
│  CONFIGURE CONTENT COMPONENTS                           │
├───────────────────────────────────────────────────────────┤
│                                                          │
│  ACTIVE COMPONENTS                    PREVIEW           │
│                                                          │
│  ┌─────────────────────┐              ┌──────────────┐  │
│  │ 📝 Hero Section     │              │              │  │
│  │ ☑ Enabled          │              │    [Hero]    │  │
│  │ Words: ~150        │              │              │  │
│  │ [Configure ▼]      │              ├──────────────┤  │
│  ├─────────────────────┤              │              │  │
│  │ 🛍️ Product Grid    │              │  [Products]  │  │
│  │ ☑ Enabled          │              │              │  │
│  │ Count: 12          │              ├──────────────┤  │
│  │ [Configure ▼]      │              │              │  │
│  ├─────────────────────┤              │   [Guide]    │  │
│  │ 📚 Buying Guide    │              │              │  │
│  │ ☑ Enabled          │              ├──────────────┤  │
│  │ Sections: 5        │              │              │  │
│  │ [Configure ▼]      │              │    [FAQ]     │  │
│  ├─────────────────────┤              │              │  │
│  │ ❓ FAQ Section     │              └──────────────┘  │
│  │ ☑ Enabled          │                                 │
│  │ Questions: 8       │              Total: ~1,200 words│
│  │ [Configure ▼]      │              Read time: 5 min  │
│  └─────────────────────┘                                │
│                                                          │
│  [+ Add Component]                                      │
│                                                          │
│  [Back] [Next: Language & Voice →]                      │
└───────────────────────────────────────────────────────────┘
```

### 6.2 Component Configuration Panel

```
┌─────────────────────────────────────┐
│  CONFIGURE FAQ SECTION              │
├─────────────────────────────────────┤
│                                     │
│  Number of Questions:               │
│  [────────●────] 8                  │
│                                     │
│  Question Types:                    │
│  ☑ Product Features                 │
│  ☑ Sizing & Fit                     │
│  ☑ Care Instructions                │
│  ☑ Shipping & Returns               │
│  ☐ Technical Specs                  │
│                                     │
│  Answer Style:                      │
│  ◉ Detailed (100+ words)           │
│  ○ Concise (50-100 words)          │
│  ○ Brief (25-50 words)             │
│                                     │
│  Schema Markup:                     │
│  ☑ Generate FAQ Schema              │
│                                     │
│  [Reset] [Apply]                    │
└─────────────────────────────────────┘
```

---

## 7. Step 4: Language & Voice Configuration

### 7.1 Language Selection

```
┌──────────────────────────────────────────────────────┐
│  LANGUAGE & VOICE SETTINGS                         │
├──────────────────────────────────────────────────────┤
│                                                     │
│  OUTPUT LANGUAGE                                   │
│  ┌─────────────────────────────────┐               │
│  │ English (US) ▼                  │               │
│  └─────────────────────────────────┘               │
│                                                     │
│  Available Languages:                              │
│  🇺🇸 English  🇪🇸 Spanish  🇫🇷 French  🇩🇪 German    │
│  🇮🇹 Italian  🇵🇹 Portuguese  🇳🇱 Dutch  🇯🇵 Japanese │
│                                                     │
│  BRAND VOICE                                       │
│                                                     │
│  Tone:      [Professional & Friendly ▼]            │
│  Style:     [Informative ▼]                        │
│  Reading:   [8th Grade Level ▼]                    │
│                                                     │
│  BRAND EXAMPLES (Optional)                         │
│  ┌─────────────────────────────────────────────┐   │
│  │ Paste examples of your brand voice here     │   │
│  │ to help AI match your style...              │   │
│  │                                             │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  KEYWORDS TO EMPHASIZE                             │
│  [premium] [sustainable] [comfort] [+]             │
│                                                     │
│  [Back] [Next: Preview Content →]                  │
└──────────────────────────────────────────────────────┘
```

### 7.2 Voice Customization Panel

```
┌──────────────────────────────────┐
│  ADVANCED VOICE SETTINGS        │
├──────────────────────────────────┤
│                                  │
│  WRITING STYLE                   │
│  Formality:  [──●───────] 30%   │
│  Technical:  [────●─────] 40%   │
│  Emotional:  [──────●───] 60%   │
│  Urgency:    [───●──────] 35%   │
│                                  │
│  CONTENT PREFERENCES             │
│  ☑ Use active voice             │
│  ☑ Include statistics           │
│  ☑ Add personal pronouns        │
│  ☐ Use humor                    │
│                                  │
│  AVOID THESE:                   │
│  [jargon] [complex terms] [+]   │
│                                  │
│  [Load Brand Profile]            │
└──────────────────────────────────┘
```

---

## 8. Step 5: Live Preview

### 8.1 Split Screen Preview

```
┌────────────────────────────────────────────────────────────┐
│  PREVIEW GENERATED CONTENT                               │
├─────────────────────┬──────────────────────────────────────┤
│  CONFIGURATION      │  LIVE PREVIEW                       │
│                     │                                     │
│  Template: Category │  Premium Winter Jackets for        │
│  Language: EN       │  Extreme Cold Protection           │
│  Tone: Professional │                                     │
│  Components: 5      │  Stay warm in the harshest        │
│  Words: ~1,200      │  conditions with our collection   │
│                     │  of premium winter jackets...     │
│  [Regenerate]       │                                     │
│  [Tweak Prompt]     │  Top Features:                     │
│                     │  • Waterproof Gore-Tex            │
│  SEO PREVIEW        │  • 800-fill down insulation       │
│  Title: 62 chars    │  • Lifetime warranty              │
│  Desc: 155 chars    │                                     │
│  Score: 92/100      │  [Continue reading...]             │
│                     │                                     │
│  SCHEMA DETECTED    │  FAQ:                              │
│  ✓ FAQ              │  Q: What's the warmest jacket?    │
│  ✓ Product          │  A: Our Arctic Extreme series...  │
│  ✓ Breadcrumb       │                                     │
└─────────────────────┴──────────────────────────────────────┘
```

### 8.2 Preview Controls

```
┌───────────────────────────────────────────┐
│  Preview: [📱 Mobile] [💻 Desktop] [📄 Text] │
│  Schema: [View] [Validate]                │
│  Export: [Copy HTML] [Copy Text]          │
└───────────────────────────────────────────┘
```

---

## 9. Step 6: Cost & Impact Review

### 9.1 Generation Summary

```
┌───────────────────────────────────────────────────┐
│  READY TO GENERATE                              │
├───────────────────────────────────────────────────┤
│                                                  │
│  CONTENT SUMMARY                                │
│  Pages: 47                                      │
│  Template: Category (38), Brand (9)             │
│  Language: English                              │
│  Total Words: ~56,400                           │
│                                                  │
│  COST BREAKDOWN                                 │
│  ┌──────────────────────────────────────┐      │
│  │ Tokens: ~71,000                      │      │
│  │ GPT-4 Cost: $2.13                    │      │
│  │ Schema Generation: $0.22             │      │
│  │ Total: $2.35                         │      │
│  └──────────────────────────────────────┘      │
│                                                  │
│  💰 PROJECTED IMPACT                            │
│  ┌──────────────────────────────────────┐      │
│  │ Search Volume: +487K/mo              │      │
│  │ Traffic Increase: +23,400 visits/mo  │      │
│  │ Revenue Impact: +$412K/mo            │      │
│  │ ROI: 17,532%                         │      │
│  └──────────────────────────────────────┘      │
│                                                  │
│  PROCESSING TIME                               │
│  Estimated: 12 minutes                         │
│  Queue Position: #1 (High Priority)            │
│                                                  │
│  ⚠️ OVERRIDE WARNING                           │
│  5 pages have existing content that will       │
│  be replaced. [View Pages]                     │
│                                                  │
│  [Back] [Save as Draft] [🚀 Start Generation]  │
└───────────────────────────────────────────────────┘
```

### 9.2 Budget Alert

```
┌────────────────────────────────┐
│  ⚠️ BUDGET NOTIFICATION         │
├────────────────────────────────┤
│  Monthly Budget: $100          │
│  Used: $67.45 (67%)           │
│  This Generation: $2.35        │
│  Remaining: $30.20             │
│                                │
│  [View Budget] [Proceed]       │
└────────────────────────────────┘
```

---

## 10. Generation Process

### 10.1 Real-Time Progress

```
┌──────────────────────────────────────────────────┐
│  GENERATING CONTENT                            │
├──────────────────────────────────────────────────┤
│                                                 │
│  Overall Progress                              │
│  ████████████████████░░░░░░ 74%               │
│  35 of 47 pages completed                      │
│                                                 │
│  CURRENT PAGE                                  │
│  Winter Gloves (/categories/winter-gloves)     │
│  ├─ ✓ Hero Section                            │
│  ├─ ✓ Product Grid                            │
│  ├─ ✓ Buying Guide                            │
│  ├─ ⟳ FAQ Section (Generating...)             │
│  └─ ○ Related Categories                       │
│                                                 │
│  LIVE PREVIEW                                  │
│  ┌────────────────────────────────┐           │
│  │ Stay warm this winter with     │           │
│  │ our premium winter gloves...   │           │
│  └────────────────────────────────┘           │
│                                                 │
│  COMPLETED (Last 5)                           │
│  ✓ Winter Jackets - 1,245 words - 92/100 SEO │
│  ✓ Winter Boots - 1,189 words - 94/100 SEO   │
│  ✓ Ski Pants - 1,098 words - 91/100 SEO      │
│                                                 │
│  Time Elapsed: 8:45 | Est. Remaining: 3:15    │
│                                                 │
│  [Pause] [Cancel] [Run in Background]         │
└──────────────────────────────────────────────────┘
```

### 10.2 Background Processing

```
┌──────────────────────────────┐
│  ✓ RUNNING IN BACKGROUND    │
├──────────────────────────────┤
│  35/47 pages (74%)          │
│  ~3 minutes remaining        │
│                              │
│  You'll be notified when    │
│  complete. Continue working  │
│  on other tasks.            │
│                              │
│  [View Progress]             │
└──────────────────────────────┘
```

---

## 11. Success & Next Actions

### 11.1 Completion Summary

```
┌────────────────────────────────────────────────────┐
│  ✅ GENERATION COMPLETE!                          │
├────────────────────────────────────────────────────┤
│                                                   │
│  RESULTS                                          │
│  ✓ 47 pages generated successfully               │
│  ✓ 56,423 words created                          │
│  ✓ Average SEO score: 93/100                     │
│  ✓ All schema markup validated                   │
│                                                   │
│  TIME & COST                                      │
│  Duration: 11 minutes 34 seconds                  │
│  Total Cost: $2.31 (under estimate!)              │
│                                                   │
│  NEXT ACTIONS                                     │
│  ┌────────────────┐ ┌────────────────┐           │
│  │  Review in     │ │   Publish      │           │
│  │  Speed Review  │ │   Directly     │           │
│  └────────────────┘ └────────────────┘           │
│                                                   │
│  ┌────────────────┐ ┌────────────────┐           │
│  │   Schedule     │ │   Export       │           │
│  │   Publishing   │ │   Content      │           │
│  └────────────────┘ └────────────────┘           │
│                                                   │
│  📊 VIEW DETAILED REPORT                          │
│                                                   │
│  [Close] [Generate More] [View in Dashboard]     │
└────────────────────────────────────────────────────┘
```

---

## 12. Advanced Features

### 12.1 Prompt Engineering Panel

```
┌──────────────────────────────────────┐
│  ADVANCED PROMPT CONFIGURATION      │
├──────────────────────────────────────┤
│                                      │
│  SYSTEM PROMPT                      │
│  ┌────────────────────────────────┐ │
│  │ You are an expert e-commerce   │ │
│  │ content writer specializing... │ │
│  └────────────────────────────────┘ │
│                                      │
│  CUSTOM INSTRUCTIONS                │
│  ┌────────────────────────────────┐ │
│  │ • Focus on sustainability      │ │
│  │ • Include size guides          │ │
│  │ • Mention free shipping        │ │
│  └────────────────────────────────┘ │
│                                      │
│  NEGATIVE PROMPTS                   │
│  ┌────────────────────────────────┐ │
│  │ Avoid: competitor names,       │ │
│  │ price comparisons, medical...  │ │
│  └────────────────────────────────┘ │
│                                      │
│  [Reset to Default] [Test Prompt]   │
└──────────────────────────────────────┘
```

### 12.2 A/B Testing Configuration

```
┌─────────────────────────────────┐
│  A/B TEST VARIANTS             │
├─────────────────────────────────┤
│                                 │
│  ☑ Generate 2 variants          │
│                                 │
│  Variant A: Professional tone   │
│  Variant B: Casual tone         │
│                                 │
│  Split: 50/50                   │
│  Duration: 30 days              │
│                                 │
│  [Configure Test]               │
└─────────────────────────────────┘
```

---

## 13. Error Handling

### 13.1 Generation Failures

```
┌──────────────────────────────────┐
│  ⚠️ PARTIAL SUCCESS               │
├──────────────────────────────────┤
│  43 of 47 pages generated       │
│                                  │
│  FAILED PAGES (4)                │
│  ✗ Winter Socks - API timeout   │
│  ✗ Fleece Tops - Token limit    │
│  ✗ Base Layers - Invalid data   │
│  ✗ Neck Warmers - Network error │
│                                  │
│  [Retry Failed] [Continue]       │
└──────────────────────────────────┘
```

### 13.2 Quality Warnings

```
┌──────────────────────────────────┐
│  ⚠️ QUALITY CHECK                 │
├──────────────────────────────────┤
│  Low confidence content detected │
│                                  │
│  • Winter Hats - SEO Score: 61  │
│  • Mittens - Duplicate content   │
│                                  │
│  [Review Now] [Accept Anyway]    │
└──────────────────────────────────┘
```

---

## 14. Mobile Adaptation

### 14.1 Mobile Wizard Flow

Vertical step progression with swipe navigation:
```
┌─────────────────┐
│  Step 1 of 6    │
│  SELECT PAGES   │
├─────────────────┤
│                 │
│  Simplified     │
│  Selection      │
│                 │
├─────────────────┤
│ [Back] [Next →] │
└─────────────────┘
```

### 14.2 Touch Optimizations

- Large touch targets (44px minimum)
- Swipe between steps
- Collapsible sections
- Bottom sheet for options

---

## 15. Success Metrics

- **Wizard Completion**: 85% reach generation
- **Time to Generate**: <3 minutes setup
- **Error Rate**: <2% failed generations
- **Quality Score**: 90+ average SEO score
- **Cost Accuracy**: ±5% of estimate

---

## Next Steps

1. Build template library system
2. Create component marketplace
3. Develop prompt optimization engine
4. Design onboarding flow for first-time users
5. Build performance monitoring dashboard