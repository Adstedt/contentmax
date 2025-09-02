# Story 4.2: Handlebars Template System

## User Story

As a content manager,
I want flexible templates for different page types,
So that I can maintain consistent structure while allowing customization.

## Size & Priority

- **Size**: M (6 hours)
- **Priority**: P0 - Critical
- **Sprint**: 4
- **Dependencies**: Task 4.1

## Description

Integrate Handlebars.js for template management with custom helpers, partials, and layouts for all content types.

## Implementation Steps

1. **Handlebars engine setup**

   ```typescript
   import Handlebars from 'handlebars';

   class TemplateEngine {
     private handlebars: typeof Handlebars;
     private templates = new Map<string, HandlebarsTemplateDelegate>();
     private partials = new Map<string, string>();
     private layouts = new Map<string, string>();

     constructor() {
       this.handlebars = Handlebars.create();
       this.registerHelpers();
       this.loadPartials();
     }

     // Compile and cache template
     compileTemplate(name: string, source: string): HandlebarsTemplateDelegate {
       const compiled = this.handlebars.compile(source, {
         strict: false,
         noEscape: false,
       });

       this.templates.set(name, compiled);
       return compiled;
     }

     // Render template with data
     render(templateName: string, data: any, layoutName?: string): string {
       const template = this.templates.get(templateName);
       if (!template) {
         throw new Error(`Template "${templateName}" not found`);
       }

       let content = template(data);

       // Apply layout if specified
       if (layoutName) {
         const layout = this.layouts.get(layoutName);
         if (layout) {
           const layoutTemplate = this.handlebars.compile(layout);
           content = layoutTemplate({ ...data, body: content });
         }
       }

       return content;
     }

     // Register partial for reuse
     registerPartial(name: string, source: string) {
       this.handlebars.registerPartial(name, source);
       this.partials.set(name, source);
     }

     // Register layout
     registerLayout(name: string, source: string) {
       this.layouts.set(name, source);
     }
   }
   ```

2. **Custom Handlebars helpers**

   ```typescript
   class TemplateHelpers {
     static register(handlebars: typeof Handlebars) {
       // Text formatting helpers
       handlebars.registerHelper('capitalize', (str: string) => {
         return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
       });

       handlebars.registerHelper('truncate', (str: string, length: number) => {
         if (!str || str.length <= length) return str;
         return str.substring(0, length) + '...';
       });

       handlebars.registerHelper('slugify', (str: string) => {
         return str
           .toLowerCase()
           .replace(/[^a-z0-9]+/g, '-')
           .replace(/^-+|-+$/g, '');
       });

       // SEO helpers
       handlebars.registerHelper('seoTitle', (title: string, suffix?: string) => {
         const maxLength = 60;
         let seoTitle = title;
         if (suffix) {
           const combined = `${title} | ${suffix}`;
           seoTitle = combined.length <= maxLength ? combined : title;
         }
         return seoTitle.substring(0, maxLength);
       });

       handlebars.registerHelper('metaDescription', (text: string) => {
         const maxLength = 160;
         const cleaned = text.replace(/<[^>]*>/g, '').trim();
         return cleaned.length > maxLength ? cleaned.substring(0, maxLength - 3) + '...' : cleaned;
       });

       // Price formatting
       handlebars.registerHelper('formatPrice', (price: number, currency = 'USD') => {
         return new Intl.NumberFormat('en-US', {
           style: 'currency',
           currency: currency,
         }).format(price);
       });

       // Date formatting
       handlebars.registerHelper('formatDate', (date: Date, format = 'short') => {
         const options: Intl.DateTimeFormatOptions =
           format === 'short'
             ? { year: 'numeric', month: 'short', day: 'numeric' }
             : { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };

         return new Intl.DateTimeFormat('en-US', options).format(date);
       });

       // Schema generation
       handlebars.registerHelper('generateSchema', function (type: string, data: any) {
         const schema = SchemaGenerator.generate(type, data);
         return new handlebars.SafeString(
           `<script type="application/ld+json">${JSON.stringify(schema)}</script>`
         );
       });

       // Conditional helpers
       handlebars.registerHelper('ifEquals', function (a: any, b: any, options: any) {
         return a === b ? options.fn(this) : options.inverse(this);
       });

       handlebars.registerHelper('ifGreaterThan', function (a: number, b: number, options: any) {
         return a > b ? options.fn(this) : options.inverse(this);
       });

       // Array helpers
       handlebars.registerHelper('join', (array: any[], separator = ', ') => {
         return Array.isArray(array) ? array.join(separator) : '';
       });

       handlebars.registerHelper('limit', (array: any[], limit: number) => {
         return Array.isArray(array) ? array.slice(0, limit) : [];
       });
     }
   }
   ```

3. **Page templates**

   ```handlebars
   {{!-- brand-page.hbs --}}
   <article class="brand-page">
     {{> hero data.hero}}

     <section class="brand-story">
       <h2>About {{brand.name}}</h2>
       <div class="content">
         {{{data.brandStory.content}}}
       </div>
     </section>

     {{#if data.products}}
       {{> productGrid data.products}}
     {{/if}}

     {{#if data.features}}
       <section class="features">
         <h2>Why Choose {{brand.name}}</h2>
         {{> featureList data.features}}
       </section>
     {{/if}}

     {{#if data.testimonials}}
       {{> testimonialCarousel data.testimonials}}
     {{/if}}

     {{#if data.faqs}}
       {{> faqSection data.faqs}}
     {{/if}}

     {{generateSchema 'Brand' brand}}
   </article>

   {{!-- category-page.hbs --}}
   <article class="category-page">
     {{> breadcrumbs breadcrumbs}}
     {{> hero data.hero}}

     <section class="category-content">
       <div class="description">
         {{{data.description}}}
       </div>

       {{#if data.subcategories}}
         <div class="subcategories">
           <h2>Browse Categories</h2>
           {{> categoryGrid data.subcategories}}
         </div>
       {{/if}}

       {{> productGrid data.products}}
     </section>

     {{#if data.buyingGuide}}
       <section class="buying-guide">
         <h2>{{data.buyingGuide.title}}</h2>
         {{{data.buyingGuide.content}}}
       </section>
     {{/if}}

     {{> faqSection data.faqs}}

     {{generateSchema 'Category' category}}
   </article>
   ```

4. **Partials library**

   ```handlebars
   {{! partials/hero.hbs }}
   <section class='hero'>
     <h1>{{headline}}</h1>
     {{#if subheadline}}
       <h2>{{subheadline}}</h2>
     {{/if}}
     <p class='description'>{{description}}</p>
     {{#if cta}}
       <a href='{{cta.url}}' class='btn btn-primary'>{{cta.text}}</a>
     {{/if}}
   </section>

   {{! partials/productGrid.hbs }}
   <div class='product-grid'>
     {{#each products}}
       <div class='product-card'>
         {{#if image}}
           <img src='{{image}}' alt='{{name}}' loading='lazy' />
         {{/if}}
         <h3>{{truncate name 50}}</h3>
         <p class='price'>{{formatPrice price}}</p>
         {{#if description}}
           <p>{{truncate description 100}}</p>
         {{/if}}
         <a href='{{url}}' class='btn btn-secondary'>View Details</a>
       </div>
     {{/each}}
   </div>

   {{! partials/faqSection.hbs }}
   <section class='faq-section'>
     <h2>{{title}}</h2>
     <div class='faq-list' itemscope itemtype='https://schema.org/FAQPage'>
       {{#each items}}
         <div class='faq-item' itemscope itemtype='https://schema.org/Question'>
           <h3 itemprop='name'>{{question}}</h3>
           <div itemprop='acceptedAnswer' itemscope itemtype='https://schema.org/Answer'>
             <p itemprop='text'>{{answer}}</p>
           </div>
         </div>
       {{/each}}
     </div>
   </section>
   ```

5. **Template management system**

   ```typescript
   class TemplateManager {
     private engine: TemplateEngine;
     private templates = new Map<string, TemplateConfig>();

     async loadTemplatesFromDatabase() {
       const templates = await supabase.from('templates').select('*').eq('active', true);

       templates.data?.forEach((template) => {
         this.registerTemplate({
           id: template.id,
           name: template.name,
           type: template.type,
           source: template.source,
           partials: template.partials,
           layout: template.layout,
         });
       });
     }

     registerTemplate(config: TemplateConfig) {
       // Compile template
       this.engine.compileTemplate(config.name, config.source);

       // Register associated partials
       config.partials?.forEach((partial) => {
         this.engine.registerPartial(partial.name, partial.source);
       });

       // Store config
       this.templates.set(config.id, config);
     }

     async renderContent(
       templateId: string,
       data: any,
       options?: RenderOptions
     ): Promise<RenderedContent> {
       const config = this.templates.get(templateId);
       if (!config) {
         throw new Error(`Template ${templateId} not found`);
       }

       // Prepare data with defaults
       const renderData = {
         ...this.getDefaultData(),
         ...data,
         options,
       };

       // Render HTML version
       const html = this.engine.render(config.name, renderData, config.layout);

       // Render plain text version
       const text = this.renderPlainText(html);

       return {
         html,
         text,
         metadata: {
           template: templateId,
           renderedAt: new Date(),
           language: options?.language || 'en',
         },
       };
     }

     private getDefaultData(): any {
       return {
         siteName: process.env.SITE_NAME,
         currentYear: new Date().getFullYear(),
         baseUrl: process.env.BASE_URL,
       };
     }
   }
   ```

## Files to Create

- `lib/templates/handlebars-engine.ts` - Core Handlebars engine
- `lib/templates/template-helpers.ts` - Custom helper functions
- `lib/templates/template-manager.ts` - Template management system
- `lib/templates/schema-generator.ts` - Schema markup generation
- `templates/layouts/default.hbs` - Default layout template
- `templates/pages/brand-page.hbs` - Brand page template
- `templates/pages/category-page.hbs` - Category page template
- `templates/pages/inspire-page.hbs` - Inspire content template
- `templates/pages/engage-page.hbs` - Engage content template
- `templates/partials/` - Reusable partial templates
- `types/templates.types.ts` - Template TypeScript types

## Template Structure

```typescript
interface TemplateConfig {
  id: string;
  name: string;
  type: 'brand' | 'category' | 'inspire' | 'engage';
  source: string; // Handlebars template source
  layout?: string;
  partials?: PartialConfig[];
  variables: TemplateVariable[];
  validation?: ValidationRules;
}

interface PartialConfig {
  name: string;
  source: string;
  description?: string;
}

interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'array' | 'object';
  required: boolean;
  default?: any;
  description?: string;
}
```

## Acceptance Criteria

- [ ] Handlebars engine integrated
- [ ] All custom helpers working
- [ ] Templates for all page types created
- [ ] Partials library comprehensive
- [ ] Layout system functional
- [ ] Template compilation and caching
- [ ] HTML and text rendering working
- [ ] Schema markup generated correctly
- [ ] Template variables validated

## Template Features

- **Layouts**: Wrap content in consistent structure
- **Partials**: Reusable components across templates
- **Helpers**: Custom functions for formatting
- **Conditionals**: Show/hide based on data
- **Loops**: Iterate over arrays/collections
- **Safe HTML**: Automatic escaping with opt-out
- **Schema**: Automatic structured data generation

## Testing Requirements

- [ ] Test all helper functions
- [ ] Test template compilation
- [ ] Test partial inclusion
- [ ] Test layout application
- [ ] Test data binding
- [ ] Test error handling
- [ ] Test performance with large data
- [ ] Test XSS prevention

## Definition of Done

- [ ] Code complete and committed
- [ ] Template engine configured
- [ ] All helpers implemented
- [ ] Templates for all page types
- [ ] Partials library created
- [ ] Caching implemented
- [ ] Tests written and passing
- [ ] Documentation complete
- [ ] Peer review completed
