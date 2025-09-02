# Story 7.5: Third-party Integrations Hub

## User Story

As a user,
I want to integrate ContentMax with my existing tools and workflows,
So that I can streamline my content operations across platforms.

## Size & Priority

- **Size**: M (6 hours)
- **Priority**: P2 - Medium
- **Sprint**: 7
- **Dependencies**: API system complete

## Description

Build a comprehensive integrations hub supporting popular e-commerce platforms, CMS systems, marketing tools, and analytics services with bi-directional data sync and webhook capabilities.

## Implementation Steps

1. **Integration framework**

   ```typescript
   // lib/integrations/integration-framework.ts
   interface Integration {
     id: string;
     name: string;
     category: 'ecommerce' | 'cms' | 'marketing' | 'analytics' | 'storage';
     icon: string;
     description: string;
     status: 'active' | 'inactive' | 'error';
     config: IntegrationConfig;
     capabilities: IntegrationCapabilities;
   }

   interface IntegrationCapabilities {
     import: boolean;
     export: boolean;
     sync: boolean;
     webhooks: boolean;
     realtime: boolean;
   }

   abstract class IntegrationBase {
     protected config: IntegrationConfig;
     protected credentials: any;
     protected webhooks: WebhookConfig[];

     abstract async connect(credentials: any): Promise<boolean>;
     abstract async disconnect(): Promise<void>;
     abstract async testConnection(): Promise<boolean>;
     abstract async sync(direction: 'import' | 'export' | 'bidirectional'): Promise<SyncResult>;

     async handleWebhook(event: WebhookEvent): Promise<void> {
       // Process incoming webhook
       const processor = this.getWebhookProcessor(event.type);
       if (processor) {
         await processor(event);
       }
     }

     protected async logActivity(activity: IntegrationActivity) {
       await this.saveActivity({
         integrationId: this.config.id,
         type: activity.type,
         status: activity.status,
         details: activity.details,
         timestamp: new Date(),
       });
     }

     protected async handleError(error: Error) {
       await this.logActivity({
         type: 'error',
         status: 'failed',
         details: {
           message: error.message,
           stack: error.stack,
         },
       });

       // Update integration status
       await this.updateStatus('error');

       // Send notification
       await this.notifyError(error);
     }
   }
   ```

2. **E-commerce integrations**

   ```typescript
   // lib/integrations/ecommerce/shopify.ts
   class ShopifyIntegration extends IntegrationBase {
     private client: ShopifyClient;

     async connect(credentials: ShopifyCredentials): Promise<boolean> {
       this.client = new ShopifyClient({
         shopDomain: credentials.shopDomain,
         apiKey: credentials.apiKey,
         apiSecret: credentials.apiSecret,
         accessToken: credentials.accessToken,
       });

       const isValid = await this.testConnection();

       if (isValid) {
         // Register webhooks
         await this.registerWebhooks();

         // Initial sync
         await this.performInitialSync();
       }

       return isValid;
     }

     async sync(direction: 'import' | 'export' | 'bidirectional'): Promise<SyncResult> {
       const result: SyncResult = {
         success: true,
         imported: 0,
         exported: 0,
         errors: [],
       };

       try {
         if (direction === 'import' || direction === 'bidirectional') {
           result.imported = await this.importFromShopify();
         }

         if (direction === 'export' || direction === 'bidirectional') {
           result.exported = await this.exportToShopify();
         }
       } catch (error) {
         result.success = false;
         result.errors.push(error.message);
       }

       return result;
     }

     private async importFromShopify(): Promise<number> {
       let imported = 0;

       // Import products
       const products = await this.client.products.list({ limit: 250 });

       for (const product of products) {
         await this.importProduct({
           externalId: product.id,
           title: product.title,
           description: product.body_html,
           category: product.product_type,
           vendor: product.vendor,
           tags: product.tags.split(', '),
           variants: product.variants,
           images: product.images,
         });
         imported++;
       }

       // Import collections
       const collections = await this.client.collections.list();

       for (const collection of collections) {
         await this.importCategory({
           externalId: collection.id,
           name: collection.title,
           description: collection.body_html,
           handle: collection.handle,
         });
         imported++;
       }

       return imported;
     }

     private async exportToShopify(): Promise<number> {
       let exported = 0;

       // Get generated content
       const content = await this.getGeneratedContent({
         status: 'approved',
         notExported: true,
       });

       for (const item of content) {
         if (item.type === 'product') {
           await this.updateShopifyProduct(item.externalId, {
             body_html: item.content.description,
             metafields: [
               {
                 namespace: 'contentmax',
                 key: 'generated_content',
                 value: JSON.stringify(item.content),
                 type: 'json',
               },
             ],
           });
           exported++;
         }
       }

       return exported;
     }

     private async registerWebhooks() {
       const webhooks = [
         { topic: 'products/create', address: this.getWebhookUrl('product-created') },
         { topic: 'products/update', address: this.getWebhookUrl('product-updated') },
         { topic: 'products/delete', address: this.getWebhookUrl('product-deleted') },
         { topic: 'collections/create', address: this.getWebhookUrl('collection-created') },
         { topic: 'collections/update', address: this.getWebhookUrl('collection-updated') },
       ];

       for (const webhook of webhooks) {
         await this.client.webhooks.create(webhook);
       }
     }
   }

   // lib/integrations/ecommerce/woocommerce.ts
   class WooCommerceIntegration extends IntegrationBase {
     private api: WooCommerceAPI;

     async connect(credentials: WooCommerceCredentials): Promise<boolean> {
       this.api = new WooCommerceAPI({
         url: credentials.storeUrl,
         consumerKey: credentials.consumerKey,
         consumerSecret: credentials.consumerSecret,
         wpAPI: true,
         version: 'wc/v3',
       });

       return this.testConnection();
     }

     async sync(direction: SyncDirection): Promise<SyncResult> {
       // Similar implementation for WooCommerce
     }
   }
   ```

3. **CMS integrations**

   ```typescript
   // lib/integrations/cms/wordpress.ts
   class WordPressIntegration extends IntegrationBase {
     private wp: WordPressClient;

     async connect(credentials: WordPressCredentials): Promise<boolean> {
       this.wp = new WordPressClient({
         endpoint: credentials.endpoint,
         username: credentials.username,
         password: credentials.applicationPassword,
       });

       return this.testConnection();
     }

     async publishContent(content: GeneratedContent): Promise<PublishResult> {
       const post = {
         title: content.title,
         content: content.html,
         excerpt: content.excerpt,
         status: 'publish',
         categories: await this.mapCategories(content.categories),
         tags: await this.mapTags(content.tags),
         featured_media: await this.uploadMedia(content.featuredImage),
         meta: {
           _yoast_wpseo_title: content.seo.title,
           _yoast_wpseo_metadesc: content.seo.description,
           _yoast_wpseo_focuskw: content.seo.focusKeyword,
         },
       };

       const result = await this.wp.posts.create(post);

       return {
         success: true,
         url: result.link,
         id: result.id,
       };
     }

     async importContent(): Promise<number> {
       const posts = await this.wp.posts.get({ per_page: 100 });
       let imported = 0;

       for (const post of posts) {
         await this.saveContent({
           externalId: post.id,
           title: post.title.rendered,
           content: post.content.rendered,
           excerpt: post.excerpt.rendered,
           url: post.link,
           type: 'blog',
         });
         imported++;
       }

       return imported;
     }
   }
   ```

4. **Marketing tool integrations**

   ```typescript
   // lib/integrations/marketing/mailchimp.ts
   class MailchimpIntegration extends IntegrationBase {
     private mailchimp: Mailchimp;

     async connect(credentials: MailchimpCredentials): Promise<boolean> {
       this.mailchimp = new Mailchimp({
         apiKey: credentials.apiKey,
         server: credentials.server,
       });

       return this.testConnection();
     }

     async createCampaign(content: GeneratedContent): Promise<CampaignResult> {
       // Create campaign
       const campaign = await this.mailchimp.campaigns.create({
         type: 'regular',
         recipients: {
           list_id: this.config.defaultListId,
         },
         settings: {
           subject_line: content.emailSubject,
           preview_text: content.previewText,
           title: content.title,
           from_name: this.config.fromName,
           reply_to: this.config.replyTo,
         },
       });

       // Set content
       await this.mailchimp.campaigns.setContent(campaign.id, {
         html: content.html,
         plain_text: content.text,
       });

       return {
         success: true,
         campaignId: campaign.id,
         webId: campaign.web_id,
       };
     }

     async syncAudience(): Promise<void> {
       const lists = await this.mailchimp.lists.getAll();

       for (const list of lists) {
         await this.saveAudience({
           externalId: list.id,
           name: list.name,
           memberCount: list.stats.member_count,
           segments: await this.getSegments(list.id),
         });
       }
     }
   }

   // lib/integrations/marketing/hubspot.ts
   class HubSpotIntegration extends IntegrationBase {
     private hubspot: HubSpotClient;

     async publishBlogPost(content: GeneratedContent): Promise<PublishResult> {
       const post = await this.hubspot.blogPosts.create({
         name: content.title,
         content_group_id: this.config.blogId,
         post_body: content.html,
         meta_description: content.seo.description,
         featured_image: content.featuredImage,
         slug: content.slug,
         publish_immediately: true,
       });

       return {
         success: true,
         url: post.url,
         id: post.id,
       };
     }
   }
   ```

5. **Integration management UI**

   ```tsx
   // components/integrations/IntegrationsHub.tsx
   const IntegrationsHub: React.FC = () => {
     const [integrations, setIntegrations] = useState<Integration[]>([]);
     const [activeIntegration, setActiveIntegration] = useState<Integration | null>(null);
     const [category, setCategory] = useState<string>('all');

     return (
       <div className="integrations-hub">
         <header className="hub-header">
           <h1>Integrations Hub</h1>
           <p>Connect ContentMax to your favorite tools</p>
         </header>

         <div className="category-filters">
           <button
             onClick={() => setCategory('all')}
             className={category === 'all' ? 'active' : ''}
           >
             All
           </button>
           <button
             onClick={() => setCategory('ecommerce')}
             className={category === 'ecommerce' ? 'active' : ''}
           >
             E-commerce
           </button>
           <button
             onClick={() => setCategory('cms')}
             className={category === 'cms' ? 'active' : ''}
           >
             CMS
           </button>
           <button
             onClick={() => setCategory('marketing')}
             className={category === 'marketing' ? 'active' : ''}
           >
             Marketing
           </button>
           <button
             onClick={() => setCategory('analytics')}
             className={category === 'analytics' ? 'active' : ''}
           >
             Analytics
           </button>
         </div>

         <div className="integrations-grid">
           {filteredIntegrations.map((integration) => (
             <IntegrationCard
               key={integration.id}
               integration={integration}
               isConnected={integration.status === 'active'}
               onClick={() => setActiveIntegration(integration)}
             />
           ))}
         </div>

         {activeIntegration && (
           <IntegrationModal
             integration={activeIntegration}
             onClose={() => setActiveIntegration(null)}
             onConnect={(credentials) => connectIntegration(activeIntegration.id, credentials)}
             onDisconnect={() => disconnectIntegration(activeIntegration.id)}
             onConfigure={(config) => configureIntegration(activeIntegration.id, config)}
           />
         )}

         <div className="connected-integrations">
           <h2>Connected Integrations</h2>
           <ConnectedIntegrationsList
             integrations={connectedIntegrations}
             onManage={(id) => manageIntegration(id)}
             onSync={(id) => syncIntegration(id)}
             onRemove={(id) => removeIntegration(id)}
           />
         </div>

         <IntegrationActivity
           activities={recentActivities}
           onViewDetails={(activity) => viewActivityDetails(activity)}
         />
       </div>
     );
   };
   ```

## Files to Create

- `lib/integrations/integration-framework.ts` - Base integration framework
- `lib/integrations/ecommerce/shopify.ts` - Shopify integration
- `lib/integrations/ecommerce/woocommerce.ts` - WooCommerce integration
- `lib/integrations/cms/wordpress.ts` - WordPress integration
- `lib/integrations/cms/contentful.ts` - Contentful integration
- `lib/integrations/marketing/mailchimp.ts` - Mailchimp integration
- `lib/integrations/marketing/hubspot.ts` - HubSpot integration
- `components/integrations/IntegrationsHub.tsx` - Integrations UI
- `pages/integrations/index.tsx` - Integrations page

## Supported Integrations

### E-commerce

- Shopify
- WooCommerce
- BigCommerce
- Magento
- PrestaShop

### CMS

- WordPress
- Contentful
- Strapi
- Sanity
- Ghost

### Marketing

- Mailchimp
- HubSpot
- ActiveCampaign
- Klaviyo
- SendGrid

### Analytics

- Google Analytics
- Segment
- Mixpanel
- Amplitude
- Heap

### Storage

- Google Drive
- Dropbox
- AWS S3
- Azure Storage

## Acceptance Criteria

- [ ] Integration framework implemented
- [ ] 5+ integrations functional
- [ ] OAuth flow working
- [ ] Webhook handling
- [ ] Bi-directional sync
- [ ] Activity logging
- [ ] Error handling robust
- [ ] UI for managing integrations

## Testing Requirements

- [ ] Test OAuth flows
- [ ] Test API connections
- [ ] Test data sync
- [ ] Test webhook delivery
- [ ] Test error scenarios
- [ ] Test rate limiting
- [ ] Test data mapping
- [ ] Integration tests

## Definition of Done

- [ ] Code complete and committed
- [ ] 5+ integrations working
- [ ] Authentication flows secure
- [ ] Data sync reliable
- [ ] Webhooks functional
- [ ] UI complete
- [ ] Tests passing
- [ ] Documentation written
