# Technical Architecture

### Frontend

- **Framework**: Next.js 15 (existing)
- **Visualization**: D3.js force-directed graph (existing)
- **State Management**: Zustand (existing)
- **UI Components**: Shadcn/ui (existing)

### Backend

- **Database**: Supabase PostgreSQL (existing)
- **Auth**: Supabase Auth (existing)
- **APIs**: Next.js API routes
- **Queue**: Supabase Edge Functions

### Integrations

- **Google Search Console API** (partially complete)
- **Google Analytics 4 API** (new)
- **Shopify Admin API** (new)
- **OpenAI API** (existing)

### Data Pipeline

```
Google APIs → Data Processor → Opportunity Calculator → Database
     ↓              ↓                    ↓
Shopify API → Taxonomy Mapper → Visualization Data → Frontend
```

---
