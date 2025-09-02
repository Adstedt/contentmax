# Story 8.1: Knowledge Base & Help Center

## User Story

As a user,
I want comprehensive documentation and self-service help resources,
So that I can quickly find answers and learn how to use the platform effectively.

## Size & Priority

- **Size**: M (4 hours)
- **Priority**: P2 - Medium
- **Sprint**: 8
- **Dependencies**: None

## Description

Create a comprehensive knowledge base with searchable documentation, video tutorials, FAQs, interactive guides, and contextual help throughout the application.

## Implementation Steps

1. **Knowledge base structure**

   ```typescript
   // lib/knowledge-base/kb-manager.ts
   interface KnowledgeArticle {
     id: string;
     title: string;
     slug: string;
     category: ArticleCategory;
     tags: string[];
     content: string;
     excerpt: string;
     author: string;
     status: 'draft' | 'published' | 'archived';
     difficulty: 'beginner' | 'intermediate' | 'advanced';
     readTime: number; // minutes
     helpful: number;
     notHelpful: number;
     relatedArticles: string[];
     metadata: {
       lastUpdated: Date;
       version: string;
       views: number;
     };
   }

   interface ArticleCategory {
     id: string;
     name: string;
     slug: string;
     description: string;
     parent?: string;
     icon: string;
     order: number;
   }

   class KnowledgeBaseManager {
     private articles = new Map<string, KnowledgeArticle>();
     private categories = new Map<string, ArticleCategory>();
     private searchIndex: SearchIndex;

     constructor() {
       this.initializeCategories();
       this.buildSearchIndex();
     }

     private initializeCategories() {
       const categories: ArticleCategory[] = [
         {
           id: 'getting-started',
           name: 'Getting Started',
           slug: 'getting-started',
           description: 'Learn the basics of ContentMax',
           icon: 'rocket',
           order: 1,
         },
         {
           id: 'content-generation',
           name: 'Content Generation',
           slug: 'content-generation',
           description: 'Master AI-powered content creation',
           icon: 'sparkles',
           order: 2,
         },
         {
           id: 'taxonomy',
           name: 'Taxonomy & Organization',
           slug: 'taxonomy',
           description: 'Organize your content effectively',
           icon: 'folder-tree',
           order: 3,
         },
         {
           id: 'api-webhooks',
           name: 'API & Webhooks',
           slug: 'api-webhooks',
           description: 'Integrate with external systems',
           icon: 'code',
           order: 4,
         },
         {
           id: 'billing',
           name: 'Billing & Subscriptions',
           slug: 'billing',
           description: 'Manage your account and billing',
           icon: 'credit-card',
           order: 5,
         },
         {
           id: 'troubleshooting',
           name: 'Troubleshooting',
           slug: 'troubleshooting',
           description: 'Solve common issues',
           icon: 'wrench',
           order: 6,
         },
       ];

       categories.forEach((cat) => this.categories.set(cat.id, cat));
     }

     async searchArticles(query: string, filters?: SearchFilters): Promise<SearchResult[]> {
       // Full-text search
       const results = await this.searchIndex.search(query, {
         fields: ['title^2', 'content', 'tags^1.5', 'excerpt'],
         highlight: {
           fields: ['content'],
           preTag: '<mark>',
           postTag: '</mark>',
         },
         filters: filters,
       });

       // Boost relevance based on user behavior
       return this.boostByRelevance(results);
     }

     async getArticle(slug: string): Promise<KnowledgeArticle | null> {
       const article = Array.from(this.articles.values()).find((a) => a.slug === slug);

       if (article) {
         // Track view
         await this.trackView(article.id);

         // Get related articles
         article.relatedArticles = await this.findRelatedArticles(article);
       }

       return article;
     }

     async trackHelpfulness(articleId: string, helpful: boolean) {
       const article = this.articles.get(articleId);
       if (!article) return;

       if (helpful) {
         article.helpful++;
       } else {
         article.notHelpful++;
       }

       await this.updateArticle(article);

       // If many "not helpful" votes, flag for review
       const ratio = article.notHelpful / (article.helpful + article.notHelpful);
       if (ratio > 0.3 && article.notHelpful > 10) {
         await this.flagForReview(articleId, 'Low helpfulness rating');
       }
     }
   }
   ```

2. **Interactive tutorials**

   ```typescript
   // lib/tutorials/tutorial-engine.ts
   interface Tutorial {
     id: string;
     title: string;
     description: string;
     steps: TutorialStep[];
     estimatedTime: number;
     difficulty: 'beginner' | 'intermediate' | 'advanced';
     prerequisites: string[];
     outcomes: string[];
   }

   interface TutorialStep {
     id: string;
     title: string;
     content: string;
     action?: TutorialAction;
     validation?: StepValidation;
     hints?: string[];
     skipCondition?: () => boolean;
   }

   interface TutorialAction {
     type: 'click' | 'input' | 'navigate' | 'api-call';
     target: string; // CSS selector or URL
     value?: any;
   }

   class InteractiveTutorial {
     private currentStep = 0;
     private tutorial: Tutorial;
     private progress: TutorialProgress;
     private overlay: TutorialOverlay;

     async start(tutorialId: string) {
       this.tutorial = await this.loadTutorial(tutorialId);
       this.progress = await this.loadOrCreateProgress(tutorialId);

       // Show tutorial overlay
       this.overlay = new TutorialOverlay();
       this.overlay.show();

       // Start from last position or beginning
       this.currentStep = this.progress.lastStep || 0;
       this.showStep(this.currentStep);
     }

     private showStep(stepIndex: number) {
       const step = this.tutorial.steps[stepIndex];

       // Highlight target element
       if (step.action?.target) {
         this.highlightElement(step.action.target);
       }

       // Show step content
       this.overlay.showStep({
         title: step.title,
         content: step.content,
         progress: `${stepIndex + 1} / ${this.tutorial.steps.length}`,
         canSkip: step.skipCondition?.() ?? true,
         hints: step.hints,
       });

       // Wait for user action
       this.waitForAction(step);
     }

     private async waitForAction(step: TutorialStep) {
       if (!step.action) {
         // Just a informational step
         return;
       }

       switch (step.action.type) {
         case 'click':
           await this.waitForClick(step.action.target);
           break;
         case 'input':
           await this.waitForInput(step.action.target, step.action.value);
           break;
         case 'navigate':
           await this.waitForNavigation(step.action.target);
           break;
         case 'api-call':
           await this.waitForAPICall(step.action.target);
           break;
       }

       // Validate step completion
       if (step.validation) {
         const isValid = await this.validateStep(step.validation);
         if (!isValid) {
           this.showHint(step.hints?.[0] || 'Try again');
           return;
         }
       }

       // Move to next step
       this.nextStep();
     }

     private nextStep() {
       this.currentStep++;

       if (this.currentStep >= this.tutorial.steps.length) {
         this.completeTutorial();
       } else {
         this.showStep(this.currentStep);
         this.saveProgress();
       }
     }

     private completeTutorial() {
       // Show completion message
       this.overlay.showCompletion({
         title: 'Tutorial Complete!',
         message: `You've completed "${this.tutorial.title}"`,
         outcomes: this.tutorial.outcomes,
         nextTutorial: this.suggestNextTutorial(),
       });

       // Track completion
       this.trackCompletion();

       // Award achievement if applicable
       this.checkAchievements();
     }
   }
   ```

3. **Contextual help system**

   ```typescript
   // lib/help/contextual-help.ts
   class ContextualHelpSystem {
     private helpContent = new Map<string, HelpContent>();
     private tooltips = new Map<string, TooltipContent>();

     initialize() {
       // Scan for help triggers in the DOM
       this.scanForHelpTriggers();

       // Set up event listeners
       this.setupEventListeners();

       // Load help content for current page
       this.loadPageHelp();
     }

     private scanForHelpTriggers() {
       // Find all elements with data-help attribute
       const helpElements = document.querySelectorAll('[data-help]');

       helpElements.forEach((element) => {
         const helpId = element.getAttribute('data-help');
         if (!helpId) return;

         // Add help icon
         const helpIcon = this.createHelpIcon();
         element.appendChild(helpIcon);

         // Set up hover/click handlers
         helpIcon.addEventListener('click', (e) => {
           e.stopPropagation();
           this.showHelp(helpId);
         });
       });
     }

     async showHelp(helpId: string) {
       const content = await this.getHelpContent(helpId);

       const helpModal = new HelpModal({
         title: content.title,
         content: content.body,
         video: content.videoUrl,
         relatedArticles: content.relatedArticles,
         actions: [
           {
             label: 'View in Knowledge Base',
             action: () => this.openKnowledgeBase(content.articleId),
           },
           {
             label: 'Contact Support',
             action: () => this.openSupport(helpId),
           },
         ],
       });

       helpModal.show();

       // Track help usage
       this.trackHelpUsage(helpId);
     }

     setupSmartSuggestions() {
       // Monitor user behavior
       const observer = new MutationObserver((mutations) => {
         // Detect when user might be struggling
         if (this.detectStruggle()) {
           this.offerProactiveHelp();
         }
       });

       observer.observe(document.body, {
         childList: true,
         subtree: true,
         attributes: true,
       });
     }

     private detectStruggle(): boolean {
       // Check for signs of user struggle
       const indicators = [
         this.checkRapidClicking(),
         this.checkFormErrors(),
         this.checkTimeOnPage(),
         this.checkBackNavigation(),
       ];

       return indicators.filter(Boolean).length >= 2;
     }

     private offerProactiveHelp() {
       const suggestion = new HelpSuggestion({
         message: 'Need help? Here are some resources that might help:',
         suggestions: this.getContextualSuggestions(),
         position: 'bottom-right',
       });

       suggestion.show();
     }
   }
   ```

4. **Help center UI**

   ```tsx
   // components/help/HelpCenter.tsx
   const HelpCenter: React.FC = () => {
     const [searchQuery, setSearchQuery] = useState('');
     const [category, setCategory] = useState<string | null>(null);
     const [searchResults, setSearchResults] = useState<KnowledgeArticle[]>([]);
     const [popularArticles, setPopularArticles] = useState<KnowledgeArticle[]>([]);

     return (
       <div className="help-center">
         <header className="help-header">
           <h1>How can we help you?</h1>
           <SearchBar
             value={searchQuery}
             onChange={setSearchQuery}
             onSearch={handleSearch}
             placeholder="Search for articles, tutorials, or topics..."
             suggestions={searchSuggestions}
           />
         </header>

         <div className="quick-links">
           <QuickLink icon="rocket" title="Getting Started Guide" href="/help/getting-started" />
           <QuickLink icon="video" title="Video Tutorials" href="/help/videos" />
           <QuickLink icon="api" title="API Documentation" href="/developers" />
           <QuickLink icon="message" title="Contact Support" onClick={() => openSupportChat()} />
         </div>

         {searchQuery ? (
           <SearchResults
             query={searchQuery}
             results={searchResults}
             onSelectArticle={(article) => navigateToArticle(article)}
           />
         ) : (
           <>
             <div className="categories-grid">
               {categories.map((cat) => (
                 <CategoryCard
                   key={cat.id}
                   category={cat}
                   articleCount={cat.articleCount}
                   onClick={() => setCategory(cat.id)}
                 />
               ))}
             </div>

             <div className="popular-articles">
               <h2>Popular Articles</h2>
               <ArticleList articles={popularArticles} showMetrics={true} />
             </div>

             <div className="tutorial-section">
               <h2>Interactive Tutorials</h2>
               <TutorialGrid
                 tutorials={availableTutorials}
                 completedTutorials={userCompletedTutorials}
                 onStartTutorial={(id) => startTutorial(id)}
               />
             </div>
           </>
         )}

         <HelpWidget
           position="bottom-right"
           onOpenChat={() => openSupportChat()}
           onOpenSearch={() => focusSearch()}
           suggestions={contextualSuggestions}
         />
       </div>
     );
   };

   // Article viewer component
   const ArticleViewer: React.FC<{ article: KnowledgeArticle }> = ({ article }) => {
     const [helpful, setHelpful] = useState<boolean | null>(null);

     return (
       <article className="knowledge-article">
         <Breadcrumb
           items={[
             { label: 'Help Center', href: '/help' },
             { label: article.category.name, href: `/help/category/${article.category.slug}` },
             { label: article.title },
           ]}
         />

         <header>
           <h1>{article.title}</h1>
           <div className="article-meta">
             <span className="read-time">{article.readTime} min read</span>
             <span className="difficulty">{article.difficulty}</span>
             <span className="last-updated">
               Updated {formatDate(article.metadata.lastUpdated)}
             </span>
           </div>
         </header>

         <TableOfContents content={article.content} />

         <div className="article-content" dangerouslySetInnerHTML={{ __html: article.content }} />

         <div className="article-feedback">
           <h3>Was this article helpful?</h3>
           <div className="feedback-buttons">
             <button
               onClick={() => handleFeedback(true)}
               className={helpful === true ? 'selected' : ''}
             >
               👍 Yes
             </button>
             <button
               onClick={() => handleFeedback(false)}
               className={helpful === false ? 'selected' : ''}
             >
               👎 No
             </button>
           </div>
           {helpful === false && (
             <FeedbackForm onSubmit={(feedback) => submitFeedback(article.id, feedback)} />
           )}
         </div>

         <RelatedArticles articles={article.relatedArticles} />

         <ContactSupport
           context={`Article: ${article.title}`}
           prefilledMessage="I have a question about this article..."
         />
       </article>
     );
   };
   ```

5. **Video tutorials**

   ```typescript
   // lib/tutorials/video-tutorials.ts
   interface VideoTutorial {
     id: string;
     title: string;
     description: string;
     duration: number; // seconds
     thumbnail: string;
     videoUrl: string;
     transcript: string;
     chapters: VideoChapter[];
     category: string;
     tags: string[];
   }

   interface VideoChapter {
     title: string;
     timestamp: number;
     description: string;
   }

   class VideoTutorialPlayer {
     private player: VideoPlayer;
     private tutorial: VideoTutorial;
     private watchProgress: WatchProgress;

     async load(tutorialId: string) {
       this.tutorial = await this.loadTutorial(tutorialId);
       this.watchProgress = await this.loadProgress(tutorialId);

       // Initialize player
       this.player = new VideoPlayer({
         src: this.tutorial.videoUrl,
         poster: this.tutorial.thumbnail,
         chapters: this.tutorial.chapters,
         startTime: this.watchProgress.lastPosition || 0,
       });

       // Set up tracking
       this.setupTracking();

       // Add interactive elements
       this.addInteractiveElements();
     }

     private addInteractiveElements() {
       // Add chapter markers
       this.tutorial.chapters.forEach((chapter) => {
         this.player.addMarker({
           time: chapter.timestamp,
           label: chapter.title,
           onClick: () => this.player.seek(chapter.timestamp),
         });
       });

       // Add transcript
       this.player.addTranscript({
         text: this.tutorial.transcript,
         syncWithVideo: true,
         searchable: true,
       });

       // Add interactive quiz points
       if (this.tutorial.quizPoints) {
         this.tutorial.quizPoints.forEach((quiz) => {
           this.player.addInteraction({
             time: quiz.timestamp,
             type: 'quiz',
             content: quiz,
             onComplete: (result) => this.trackQuizResult(result),
           });
         });
       }
     }

     private setupTracking() {
       // Track watch progress
       this.player.on('timeupdate', (time) => {
         if (time - this.watchProgress.lastPosition > 5) {
           this.saveProgress(time);
         }
       });

       // Track completion
       this.player.on('ended', () => {
         this.markAsCompleted();
         this.suggestNextVideo();
       });

       // Track engagement
       this.player.on('play', () => this.track('video-play'));
       this.player.on('pause', () => this.track('video-pause'));
       this.player.on('seek', (time) => this.track('video-seek', { time }));
     }
   }
   ```

## Files to Create

- `lib/knowledge-base/kb-manager.ts` - Knowledge base management
- `lib/tutorials/tutorial-engine.ts` - Interactive tutorial system
- `lib/tutorials/video-tutorials.ts` - Video tutorial player
- `lib/help/contextual-help.ts` - Contextual help system
- `lib/help/help-search.ts` - Help search engine
- `components/help/HelpCenter.tsx` - Help center UI
- `components/help/ArticleViewer.tsx` - Article viewer
- `components/help/TutorialPlayer.tsx` - Tutorial player
- `components/help/VideoPlayer.tsx` - Video player component
- `pages/help/index.tsx` - Help center page

## Content Structure

### Categories

- Getting Started
- Content Generation
- Taxonomy & Organization
- Templates & Customization
- API & Integrations
- Billing & Account
- Troubleshooting

### Tutorial Tracks

- **Beginner**: Platform basics, first content generation
- **Intermediate**: Advanced features, bulk operations
- **Advanced**: API integration, custom workflows
- **Developer**: API usage, webhook setup

## Acceptance Criteria

- [ ] Knowledge base with 50+ articles
- [ ] Full-text search functionality
- [ ] Interactive tutorials (5+)
- [ ] Video tutorials (10+)
- [ ] Contextual help throughout app
- [ ] Feedback collection system
- [ ] Multi-language support
- [ ] Mobile-responsive design

## Testing Requirements

- [ ] Test search functionality
- [ ] Test article navigation
- [ ] Test tutorial flow
- [ ] Test video playback
- [ ] Test contextual help
- [ ] Test feedback system
- [ ] Test related articles
- [ ] Test mobile experience

## Definition of Done

- [ ] Code complete and committed
- [ ] 50+ help articles written
- [ ] 5+ tutorials created
- [ ] 10+ videos recorded
- [ ] Search indexing working
- [ ] Contextual help integrated
- [ ] Tests written and passing
- [ ] User feedback positive
