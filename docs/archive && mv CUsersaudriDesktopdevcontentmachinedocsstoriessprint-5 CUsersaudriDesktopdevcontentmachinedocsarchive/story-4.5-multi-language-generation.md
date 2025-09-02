# Story 4.5: Multi-language Content Generation

## User Story

As a content manager targeting international markets,
I want to generate content in multiple languages,
So that I can serve diverse customer bases without translating manually.

## Size & Priority

- **Size**: M (4 hours)
- **Priority**: P1 - High
- **Sprint**: 4
- **Dependencies**: Task 4.3

## Description

Add language parameter to content generation API to generate content directly in target languages. The UI remains in English - only the generated content is multilingual.

## Implementation Steps

1. **Language adapter for content generation**

   ```typescript
   class LanguageAdapter {
     private supportedLanguages = new Map<string, LanguageConfig>();

     constructor() {
       this.initializeLanguages();
     }

     private initializeLanguages() {
       const languages: LanguageConfig[] = [
         {
           code: 'en',
           name: 'English',
           nativeName: 'English',
           direction: 'ltr',
           openAIModel: 'gpt-4-turbo-preview',
           seoRules: {
             titleMaxLength: 60,
             descriptionMaxLength: 160,
             keywordDensity: { min: 0.5, max: 2.5 },
           },
         },
         {
           code: 'es',
           name: 'Spanish',
           nativeName: 'Español',
           direction: 'ltr',
           openAIModel: 'gpt-4-turbo-preview',
           seoRules: {
             titleMaxLength: 70,
             descriptionMaxLength: 160,
             keywordDensity: { min: 0.5, max: 2.0 },
           },
         },
         {
           code: 'fr',
           name: 'French',
           nativeName: 'Français',
           direction: 'ltr',
           openAIModel: 'gpt-4-turbo-preview',
           seoRules: {
             titleMaxLength: 65,
             descriptionMaxLength: 160,
             keywordDensity: { min: 0.5, max: 2.0 },
           },
         },
         {
           code: 'de',
           name: 'German',
           nativeName: 'Deutsch',
           direction: 'ltr',
           openAIModel: 'gpt-4-turbo-preview',
           seoRules: {
             titleMaxLength: 60,
             descriptionMaxLength: 160,
             keywordDensity: { min: 0.4, max: 1.8 },
           },
         },
         {
           code: 'it',
           name: 'Italian',
           nativeName: 'Italiano',
           direction: 'ltr',
           openAIModel: 'gpt-4-turbo-preview',
           seoRules: {
             titleMaxLength: 65,
             descriptionMaxLength: 160,
             keywordDensity: { min: 0.5, max: 2.0 },
           },
         },
         {
           code: 'pt',
           name: 'Portuguese',
           nativeName: 'Português',
           direction: 'ltr',
           openAIModel: 'gpt-4-turbo-preview',
           seoRules: {
             titleMaxLength: 60,
             descriptionMaxLength: 160,
             keywordDensity: { min: 0.5, max: 2.2 },
           },
         },
         {
           code: 'nl',
           name: 'Dutch',
           nativeName: 'Nederlands',
           direction: 'ltr',
           openAIModel: 'gpt-4-turbo-preview',
           seoRules: {
             titleMaxLength: 60,
             descriptionMaxLength: 160,
             keywordDensity: { min: 0.4, max: 1.8 },
           },
         },
         {
           code: 'pl',
           name: 'Polish',
           nativeName: 'Polski',
           direction: 'ltr',
           openAIModel: 'gpt-4-turbo-preview',
           seoRules: {
             titleMaxLength: 60,
             descriptionMaxLength: 160,
             keywordDensity: { min: 0.4, max: 1.8 },
           },
         },
         {
           code: 'sv',
           name: 'Swedish',
           nativeName: 'Svenska',
           direction: 'ltr',
           openAIModel: 'gpt-4-turbo-preview',
           seoRules: {
             titleMaxLength: 60,
             descriptionMaxLength: 160,
             keywordDensity: { min: 0.4, max: 1.8 },
           },
         },
         {
           code: 'no',
           name: 'Norwegian',
           nativeName: 'Norsk',
           direction: 'ltr',
           openAIModel: 'gpt-4-turbo-preview',
           seoRules: {
             titleMaxLength: 60,
             descriptionMaxLength: 160,
             keywordDensity: { min: 0.4, max: 1.8 },
           },
         },
       ];

       languages.forEach((lang) => {
         this.supportedLanguages.set(lang.code, lang);
       });
     }

     isSupported(languageCode: string): boolean {
       return this.supportedLanguages.has(languageCode.toLowerCase());
     }

     getLanguageConfig(languageCode: string): LanguageConfig {
       const config = this.supportedLanguages.get(languageCode.toLowerCase());
       if (!config) {
         throw new Error(`Unsupported language: ${languageCode}`);
       }
       return config;
     }

     getSupportedLanguages(): LanguageInfo[] {
       return Array.from(this.supportedLanguages.values()).map((config) => ({
         code: config.code,
         name: config.name,
         nativeName: config.nativeName,
       }));
     }
   }
   ```

2. **Prompt builder with language support**

   ```typescript
   class MultilingualPromptBuilder {
     buildPrompt(template: string, language: string, variables: Record<string, any>): string {
       const languageConfig = this.languageAdapter.getLanguageConfig(language);

       // Base prompt with language instruction
       let prompt = `Generate the following content in ${languageConfig.name} (${languageConfig.nativeName}).
       
       IMPORTANT: 
       - All text must be in ${languageConfig.name}
       - Use natural, native expressions appropriate for ${languageConfig.name} speakers
       - Follow ${languageConfig.name} SEO best practices
       - Maintain cultural relevance for the target market
       
       ${template}`;

       // Replace variables
       Object.entries(variables).forEach(([key, value]) => {
         prompt = prompt.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
       });

       return prompt;
     }

     buildComponentPrompt(component: string, context: GenerationContext): string {
       const language = context.language || 'en';
       const languageConfig = this.languageAdapter.getLanguageConfig(language);

       switch (component) {
         case 'hero':
           return this.buildHeroPrompt(context, languageConfig);
         case 'faq':
           return this.buildFAQPrompt(context, languageConfig);
         case 'description':
           return this.buildDescriptionPrompt(context, languageConfig);
         default:
           return this.buildGenericPrompt(component, context, languageConfig);
       }
     }

     private buildHeroPrompt(context: GenerationContext, languageConfig: LanguageConfig): string {
       return `Create a hero section for a ${context.pageType} page in ${languageConfig.name}.
       
       Product/Category: ${context.targetKeywords[0]}
       Target Keywords: ${context.targetKeywords.join(', ')}
       
       Requirements:
       - Headline: Maximum ${languageConfig.seoRules.titleMaxLength} characters
       - Include the main keyword naturally in ${languageConfig.name}
       - Subheadline: 100-120 characters
       - Description: Maximum ${languageConfig.seoRules.descriptionMaxLength} characters
       - Call-to-action: Short, action-oriented phrase in ${languageConfig.name}
       
       Cultural considerations for ${languageConfig.name} market:
       - Use appropriate formality level
       - Include culturally relevant references if applicable
       - Avoid direct translations - use native expressions
       
       Output format:
       {
         "headline": "...",
         "subheadline": "...",
         "description": "...",
         "cta": { "text": "...", "action": "..." }
       }`;
     }

     private buildFAQPrompt(context: GenerationContext, languageConfig: LanguageConfig): string {
       return `Generate 5 frequently asked questions and answers about ${context.targetKeywords[0]} in ${languageConfig.name}.
       
       Guidelines:
       - Questions should be natural and conversational in ${languageConfig.name}
       - Include relevant keywords naturally
       - Answers should be informative and 50-150 words each
       - Use the appropriate level of formality for ${languageConfig.name}
       - Include local market considerations if relevant
       
       Output format:
       {
         "faqs": [
           {
             "question": "...",
             "answer": "..."
           }
         ]
       }`;
     }
   }
   ```

3. **Language selector component**

   ```typescript
   interface LanguageSelectorProps {
     value: string;
     onChange: (language: string) => void;
     disabled?: boolean;
   }

   const LanguageSelector: React.FC<LanguageSelectorProps> = ({
     value,
     onChange,
     disabled = false
   }) => {
     const [languages, setLanguages] = useState<LanguageInfo[]>([]);

     useEffect(() => {
       const adapter = new LanguageAdapter();
       setLanguages(adapter.getSupportedLanguages());
     }, []);

     return (
       <div className="language-selector">
         <label htmlFor="language" className="block text-sm font-medium text-gray-700">
           Content Language
         </label>
         <select
           id="language"
           value={value}
           onChange={(e) => onChange(e.target.value)}
           disabled={disabled}
           className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
         >
           {languages.map(lang => (
             <option key={lang.code} value={lang.code}>
               {lang.name} ({lang.nativeName})
             </option>
           ))}
         </select>
         <p className="mt-1 text-xs text-gray-500">
           Generated content will be in this language. UI remains in English.
         </p>
       </div>
     );
   };
   ```

4. **Language-specific SEO optimization**

   ```typescript
   class MultilingualSEO {
     optimizeForLanguage(content: string, language: string, keywords: string[]): OptimizedContent {
       const config = this.languageAdapter.getLanguageConfig(language);

       return {
         content: this.optimizeContent(content, keywords, config),
         meta: this.generateMetaTags(content, language, config),
         schema: this.generateSchema(content, language),
       };
     }

     private optimizeContent(content: string, keywords: string[], config: LanguageConfig): string {
       // Calculate keyword density
       const density = this.calculateKeywordDensity(content, keywords);

       // Adjust if needed
       if (density < config.seoRules.keywordDensity.min) {
         // Suggest adding keywords naturally
         console.warn(`Keyword density too low for ${config.name}`);
       } else if (density > config.seoRules.keywordDensity.max) {
         // Suggest reducing keywords
         console.warn(`Keyword density too high for ${config.name}`);
       }

       return content;
     }

     private generateMetaTags(content: string, language: string, config: LanguageConfig): MetaTags {
       return {
         title: this.truncateText(this.extractTitle(content), config.seoRules.titleMaxLength),
         description: this.truncateText(
           this.extractDescription(content),
           config.seoRules.descriptionMaxLength
         ),
         lang: language,
         'og:locale': this.getLocaleString(language),
       };
     }

     private generateSchema(content: string, language: string): object {
       return {
         '@context': 'https://schema.org',
         '@type': 'WebPage',
         inLanguage: language,
         headline: this.extractTitle(content),
         description: this.extractDescription(content),
       };
     }

     private getLocaleString(language: string): string {
       const localeMap: Record<string, string> = {
         en: 'en_US',
         es: 'es_ES',
         fr: 'fr_FR',
         de: 'de_DE',
         it: 'it_IT',
         pt: 'pt_PT',
         nl: 'nl_NL',
         pl: 'pl_PL',
         sv: 'sv_SE',
         no: 'no_NO',
       };

       return localeMap[language] || 'en_US';
     }
   }
   ```

5. **Content generation with language**

   ```typescript
   class MultilingualContentGenerator {
     async generate(request: ContentGenerationRequest): Promise<GeneratedContent> {
       // Validate language
       if (!this.languageAdapter.isSupported(request.targetLanguage)) {
         throw new Error(`Language ${request.targetLanguage} not supported`);
       }

       // Build language-specific context
       const context: GenerationContext = {
         ...request,
         language: request.targetLanguage,
       };

       // Generate components in target language
       const components = await Promise.all(
         request.components.map(async (componentConfig) => {
           const prompt = this.promptBuilder.buildComponentPrompt(componentConfig.type, context);

           const result = await this.openAIClient.generateText(prompt, {
             model: this.languageAdapter.getLanguageConfig(request.targetLanguage).openAIModel,
             temperature: 0.7,
             maxTokens: 2000,
           });

           return {
             type: componentConfig.type,
             content: result.content,
             language: request.targetLanguage,
           };
         })
       );

       // Optimize for language-specific SEO
       const optimizedContent = this.seo.optimizeForLanguage(
         components,
         request.targetLanguage,
         request.keywords
       );

       // Store with language metadata
       await this.storeContent({
         ...optimizedContent,
         language: request.targetLanguage,
         generatedAt: new Date(),
       });

       return optimizedContent;
     }
   }
   ```

## Files to Create

- `lib/generation/language-adapter.ts` - Language configuration management
- `lib/generation/multilingual-prompt-builder.ts` - Language-aware prompts
- `lib/generation/multilingual-seo.ts` - Language-specific SEO
- `components/generation/LanguageSelector.tsx` - Language dropdown UI
- `types/language.types.ts` - Language-related types
- `tests/multilingual.test.ts` - Multi-language tests

## Language Configuration

```typescript
interface LanguageConfig {
  code: string; // ISO 639-1 code
  name: string; // English name
  nativeName: string; // Native name
  direction: 'ltr' | 'rtl'; // Text direction
  openAIModel: string; // Best model for this language
  seoRules: {
    titleMaxLength: number;
    descriptionMaxLength: number;
    keywordDensity: {
      min: number;
      max: number;
    };
  };
}

interface ContentGenerationRequest {
  pageType: PageType;
  targetLanguage: string; // ISO 639-1 code
  keywords: string[]; // In target language
  components: ComponentConfig[];
  brandVoice: BrandVoice;
}
```

## Supported Languages

| Code | Language   | Native Name | SEO Title Length | Notes                 |
| ---- | ---------- | ----------- | ---------------- | --------------------- |
| en   | English    | English     | 60               | Default               |
| es   | Spanish    | Español     | 70               | Longer titles allowed |
| fr   | French     | Français    | 65               | Formal tone           |
| de   | German     | Deutsch     | 60               | Compound words        |
| it   | Italian    | Italiano    | 65               | Expressive            |
| pt   | Portuguese | Português   | 60               | BR variant available  |
| nl   | Dutch      | Nederlands  | 60               | Concise               |
| pl   | Polish     | Polski      | 60               | Complex grammar       |
| sv   | Swedish    | Svenska     | 60               | Nordic market         |
| no   | Norwegian  | Norsk       | 60               | Bokmål variant        |

## Acceptance Criteria

- [ ] All 10 languages supported for generation
- [ ] Language selector integrated in UI
- [ ] Content generated natively in target language
- [ ] SEO rules applied per language
- [ ] Language metadata stored with content
- [ ] UI remains in English throughout
- [ ] Prompts optimized for each language
- [ ] Character limits respected per language

## Important Notes

- **UI Language**: Admin interface stays in English
- **Content Only**: Only generated content is multilingual
- **Native Generation**: Content generated directly in target language (not translated)
- **SEO Compliance**: Each language follows its specific SEO rules
- **Cultural Adaptation**: Prompts consider cultural context

## Testing Requirements

- [ ] Test generation in all languages
- [ ] Test language selector functionality
- [ ] Test SEO optimization per language
- [ ] Test character limit enforcement
- [ ] Test special characters handling
- [ ] Test RTL language support (future)
- [ ] Test language metadata storage
- [ ] Test prompt effectiveness per language

## Definition of Done

- [ ] Code complete and committed
- [ ] All languages integrated
- [ ] Language selector working
- [ ] Native generation verified
- [ ] SEO rules implemented
- [ ] Metadata storage functional
- [ ] Tests written and passing
- [ ] Documentation updated
- [ ] Peer review completed
