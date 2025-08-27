# Story 4.1: Component Architecture System

## User Story

As a content strategist,
I want a flexible component-based content system,
So that I can generate consistent, high-quality content across different page types.

## Size & Priority

- **Size**: L (8 hours)
- **Priority**: P0 - Critical
- **Sprint**: 4
- **Dependencies**: Sprint 1 complete

## Description

Design and implement a flexible component-based content architecture that allows for reusable, composable content blocks across different page types.

## Implementation Steps

1. **Base component architecture**

   ```typescript
   // Base component interface
   abstract class ContentComponent {
     abstract readonly type: string;
     abstract readonly version: string;
     protected config: ComponentConfig;

     constructor(config: ComponentConfig) {
       this.config = config;
       this.validate();
     }

     // Core methods every component must implement
     abstract async generate(context: GenerationContext): Promise<ComponentData>;
     abstract renderHTML(data: ComponentData): string;
     abstract renderText(data: ComponentData): string;
     abstract validate(): void;
     abstract getSchema(): JSONSchema;

     // Common functionality
     protected async callOpenAI(prompt: string): Promise<string> {
       // Shared OpenAI integration
     }

     protected sanitizeHTML(html: string): string {
       // HTML sanitization logic
     }

     protected truncateText(text: string, maxLength: number): string {
       // Text truncation with word boundaries
     }
   }

   interface ComponentConfig {
     id: string;
     name: string;
     enabled: boolean;
     settings: Record<string, any>;
     constraints?: ComponentConstraints;
   }

   interface ComponentConstraints {
     minLength?: number;
     maxLength?: number;
     requiredFields?: string[];
     allowedTags?: string[];
   }

   interface GenerationContext {
     pageType: 'product' | 'category' | 'brand' | 'inspire' | 'engage';
     targetKeywords: string[];
     brandVoice: BrandVoice;
     competitorData?: CompetitorAnalysis;
     productData?: ProductData[];
     seoRequirements: SEORequirements;
     language: string;
   }
   ```

2. **Hero component implementation**

   ```typescript
   class HeroComponent extends ContentComponent {
     readonly type = 'hero';
     readonly version = '1.0.0';

     async generate(context: GenerationContext): Promise<HeroComponentData> {
       const prompt = this.buildPrompt(context);
       const response = await this.callOpenAI(prompt);

       return {
         headline: this.extractHeadline(response),
         subheadline: this.extractSubheadline(response),
         description: this.extractDescription(response),
         cta: this.extractCTA(response),
         metadata: {
           generatedAt: new Date(),
           keywords: context.targetKeywords,
           confidence: this.calculateConfidence(response),
         },
       };
     }

     renderHTML(data: HeroComponentData): string {
       return `
         <section class="hero-section">
           <h1>${this.sanitizeHTML(data.headline)}</h1>
           <h2>${this.sanitizeHTML(data.subheadline)}</h2>
           <p>${this.sanitizeHTML(data.description)}</p>
           ${data.cta ? `<button class="cta-button">${data.cta.text}</button>` : ''}
         </section>
       `;
     }

     renderText(data: HeroComponentData): string {
       return `
         ${data.headline}
         ${data.subheadline}
         
         ${data.description}
         ${data.cta ? `\n${data.cta.text}` : ''}
       `.trim();
     }

     private buildPrompt(context: GenerationContext): string {
       return `
         Generate a hero section for a ${context.pageType} page.
         Target keywords: ${context.targetKeywords.join(', ')}
         Brand voice: ${context.brandVoice.tone}
         Language: ${context.language}
         
         Requirements:
         - Headline: 60-70 characters, include primary keyword
         - Subheadline: 100-120 characters, supporting message
         - Description: 150-200 characters, value proposition
         - CTA: Action-oriented, 2-4 words
       `;
     }

     getSchema(): JSONSchema {
       return {
         type: 'object',
         properties: {
           headline: { type: 'string', minLength: 10, maxLength: 70 },
           subheadline: { type: 'string', minLength: 20, maxLength: 120 },
           description: { type: 'string', minLength: 50, maxLength: 200 },
           cta: {
             type: 'object',
             properties: {
               text: { type: 'string' },
               url: { type: 'string' },
             },
           },
         },
         required: ['headline', 'description'],
       };
     }
   }
   ```

3. **FAQ component implementation**

   ```typescript
   class FAQComponent extends ContentComponent {
     readonly type = 'faq';
     readonly version = '1.0.0';

     async generate(context: GenerationContext): Promise<FAQComponentData> {
       const questions = await this.generateQuestions(context);
       const answers = await this.generateAnswers(questions, context);

       return {
         items: questions.map((q, i) => ({
           question: q,
           answer: answers[i],
           schema: this.generateFAQSchema(q, answers[i]),
         })),
         metadata: {
           count: questions.length,
           generatedAt: new Date(),
         },
       };
     }

     private async generateQuestions(context: GenerationContext): Promise<string[]> {
       const prompt = `
         Generate ${this.config.settings.count || 5} frequently asked questions
         for a ${context.pageType} page about ${context.targetKeywords[0]}.
         Language: ${context.language}
       `;

       const response = await this.callOpenAI(prompt);
       return this.parseQuestions(response);
     }

     renderHTML(data: FAQComponentData): string {
       const schemaScript = this.generateSchemaScript(data);

       return `
         <section class="faq-section">
           <h2>Frequently Asked Questions</h2>
           <div class="faq-list">
             ${data.items
               .map(
                 (item) => `
            <div class="faq-item">
              <h3>${this.sanitizeHTML(item.question)}</h3>
              <p>${this.sanitizeHTML(item.answer)}</p>
            </div>
          `
               )
               .join('')}
           </div>
           ${schemaScript}
         </section>
       `;
     }

     private generateFAQSchema(question: string, answer: string): object {
       return {
         '@type': 'Question',
         name: question,
         acceptedAnswer: {
           '@type': 'Answer',
           text: answer,
         },
       };
     }
   }
   ```

4. **Component registry**

   ```typescript
   class ComponentRegistry {
     private components = new Map<string, typeof ContentComponent>();
     private instances = new Map<string, ContentComponent>();

     register(componentClass: typeof ContentComponent) {
       const temp = new componentClass({ id: 'temp', name: 'temp', enabled: true, settings: {} });
       this.components.set(temp.type, componentClass);
     }

     create(type: string, config: ComponentConfig): ContentComponent {
       const ComponentClass = this.components.get(type);
       if (!ComponentClass) {
         throw new Error(`Component type "${type}" not registered`);
       }

       const instance = new ComponentClass(config);
       this.instances.set(config.id, instance);
       return instance;
     }

     get(id: string): ContentComponent | undefined {
       return this.instances.get(id);
     }

     getAvailableTypes(): string[] {
       return Array.from(this.components.keys());
     }

     validateConfiguration(type: string, config: any): ValidationResult {
       const ComponentClass = this.components.get(type);
       if (!ComponentClass) {
         return { valid: false, errors: [`Unknown component type: ${type}`] };
       }

       try {
         const temp = new ComponentClass(config);
         const schema = temp.getSchema();
         // Validate against schema
         return { valid: true, errors: [] };
       } catch (error) {
         return { valid: false, errors: [error.message] };
       }
     }
   }

   // Initialize registry with all components
   const registry = new ComponentRegistry();
   registry.register(HeroComponent);
   registry.register(FAQComponent);
   registry.register(ProductGridComponent);
   registry.register(FeatureListComponent);
   registry.register(TestimonialComponent);
   ```

5. **Component composition**
   ```typescript
   class ContentComposer {
     constructor(private registry: ComponentRegistry) {}

     async composePage(
       template: PageTemplate,
       context: GenerationContext
     ): Promise<ComposedContent> {
       const componentResults = new Map<string, ComponentData>();

       // Generate content for each component in template
       for (const componentConfig of template.components) {
         const component = this.registry.create(componentConfig.type, componentConfig);

         const data = await component.generate(context);
         componentResults.set(componentConfig.id, data);
       }

       // Combine into final content
       return {
         html: this.renderHTML(template, componentResults),
         text: this.renderText(template, componentResults),
         components: componentResults,
         metadata: {
           template: template.id,
           generatedAt: new Date(),
           language: context.language,
         },
       };
     }

     private renderHTML(template: PageTemplate, components: Map<string, ComponentData>): string {
       let html = template.layout;

       // Replace component placeholders
       components.forEach((data, id) => {
         const component = this.registry.get(id);
         if (component) {
           const componentHTML = component.renderHTML(data);
           html = html.replace(`{{${id}}}`, componentHTML);
         }
       });

       return html;
     }
   }
   ```

## Files to Create

- `lib/content/ContentComponent.ts` - Abstract base component class
- `lib/content/components/HeroComponent.ts` - Hero section component
- `lib/content/components/FAQComponent.ts` - FAQ component
- `lib/content/components/ProductGridComponent.ts` - Product grid component
- `lib/content/components/FeatureListComponent.ts` - Features component
- `lib/content/components/TestimonialComponent.ts` - Testimonials component
- `lib/content/ComponentRegistry.ts` - Component registration system
- `lib/content/ContentComposer.ts` - Component composition logic
- `types/components.types.ts` - Component TypeScript types
- `schemas/component-schemas.ts` - JSON schemas for validation

## Component Types

### Core Components

1. **HeroComponent** - Headlines, descriptions, CTAs
2. **FAQComponent** - Question/answer pairs with schema
3. **ProductGridComponent** - Product listings with filters
4. **FeatureListComponent** - Benefits and features
5. **TestimonialComponent** - Social proof
6. **ComparisonTableComponent** - Product/feature comparisons
7. **CTABannerComponent** - Call-to-action sections
8. **BreadcrumbComponent** - Navigation breadcrumbs

### Component Features

- Language-aware generation
- SEO optimization built-in
- Schema markup generation
- HTML and text rendering
- Validation and constraints
- Configurable settings
- Brand voice adherence

## Acceptance Criteria

- [ ] Base component architecture implemented
- [ ] All core components created
- [ ] Component registry functional
- [ ] Validation working for all components
- [ ] HTML and text rendering for each
- [ ] Language support in generation
- [ ] Schema markup generated correctly
- [ ] Components composable into pages

## Testing Requirements

- [ ] Unit tests for each component
- [ ] Integration tests for composition
- [ ] Validation tests for schemas
- [ ] Generation tests with mocked OpenAI
- [ ] Rendering tests for HTML/text
- [ ] Language generation tests
- [ ] Error handling tests
- [ ] Performance tests for composition

## Definition of Done

- [ ] Code complete and committed
- [ ] All components implemented
- [ ] Registry system working
- [ ] Composition functional
- [ ] Validation comprehensive
- [ ] Tests written and passing
- [ ] Documentation complete
- [ ] Peer review completed
