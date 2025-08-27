# Story 7.4: Billing and Subscription System

## User Story
As a user,
I want flexible billing and subscription options,
So that I can choose a plan that fits my needs and budget.

## Size & Priority
- **Size**: L (8 hours)
- **Priority**: P0 - Critical
- **Sprint**: 7
- **Dependencies**: Task 7.3 (Enterprise features)

## Description
Implement a comprehensive billing and subscription system with multiple pricing tiers, usage-based billing, payment processing, invoicing, and subscription management capabilities.

## Implementation Steps

1. **Subscription management**
   ```typescript
   // lib/billing/subscription-manager.ts
   import Stripe from 'stripe';
   
   interface SubscriptionPlan {
     id: string;
     name: string;
     tier: 'free' | 'starter' | 'professional' | 'enterprise';
     pricing: {
       monthly: number;
       annual: number;
       currency: string;
     };
     limits: {
       users: number;
       contentGenerations: number;
       storage: number; // GB
       apiCalls: number;
       customDomains: number;
     };
     features: string[];
     stripePriceId: {
       monthly: string;
       annual: string;
     };
   }
   
   class SubscriptionManager {
     private stripe: Stripe;
     private plans: Map<string, SubscriptionPlan>;
     
     constructor() {
       this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
         apiVersion: '2023-10-16'
       });
       this.initializePlans();
     }
     
     private initializePlans() {
       const plans: SubscriptionPlan[] = [
         {
           id: 'free',
           name: 'Free',
           tier: 'free',
           pricing: {
             monthly: 0,
             annual: 0,
             currency: 'USD'
           },
           limits: {
             users: 1,
             contentGenerations: 10,
             storage: 1,
             apiCalls: 100,
             customDomains: 0
           },
           features: [
             'Basic content generation',
             'Standard templates',
             'Community support'
           ],
           stripePriceId: {
             monthly: '',
             annual: ''
           }
         },
         {
           id: 'starter',
           name: 'Starter',
           tier: 'starter',
           pricing: {
             monthly: 49,
             annual: 490, // 2 months free
             currency: 'USD'
           },
           limits: {
             users: 5,
             contentGenerations: 500,
             storage: 10,
             apiCalls: 5000,
             customDomains: 1
           },
           features: [
             'Advanced content generation',
             'Custom templates',
             'API access',
             'Email support',
             'Analytics dashboard'
           ],
           stripePriceId: {
             monthly: 'price_starter_monthly',
             annual: 'price_starter_annual'
           }
         },
         {
           id: 'professional',
           name: 'Professional',
           tier: 'professional',
           pricing: {
             monthly: 199,
             annual: 1990,
             currency: 'USD'
           },
           limits: {
             users: 20,
             contentGenerations: 5000,
             storage: 100,
             apiCalls: 50000,
             customDomains: 5
           },
           features: [
             'All Starter features',
             'Bulk operations',
             'Priority generation',
             'Advanced analytics',
             'Priority support',
             'Custom branding'
           ],
           stripePriceId: {
             monthly: 'price_professional_monthly',
             annual: 'price_professional_annual'
           }
         },
         {
           id: 'enterprise',
           name: 'Enterprise',
           tier: 'enterprise',
           pricing: {
             monthly: -1, // Custom pricing
             annual: -1,
             currency: 'USD'
           },
           limits: {
             users: -1, // Unlimited
             contentGenerations: -1,
             storage: -1,
             apiCalls: -1,
             customDomains: -1
           },
           features: [
             'All Professional features',
             'Unlimited everything',
             'SSO integration',
             'SLA guarantee',
             'Dedicated support',
             'Custom integrations',
             'On-premise option'
           ],
           stripePriceId: {
             monthly: '',
             annual: ''
           }
         }
       ];
       
       plans.forEach(plan => this.plans.set(plan.id, plan));
     }
     
     async createSubscription(
       userId: string,
       planId: string,
       billingPeriod: 'monthly' | 'annual',
       paymentMethodId?: string
     ): Promise<Subscription> {
       const plan = this.plans.get(planId);
       if (!plan) throw new Error('Invalid plan');
       
       // Get or create Stripe customer
       const customer = await this.getOrCreateCustomer(userId);
       
       // Attach payment method if provided
       if (paymentMethodId) {
         await this.stripe.paymentMethods.attach(paymentMethodId, {
           customer: customer.id
         });
         
         await this.stripe.customers.update(customer.id, {
           invoice_settings: {
             default_payment_method: paymentMethodId
           }
         });
       }
       
       // Create subscription
       const stripeSubscription = await this.stripe.subscriptions.create({
         customer: customer.id,
         items: [{
           price: plan.stripePriceId[billingPeriod]
         }],
         trial_period_days: 14,
         payment_behavior: 'default_incomplete',
         payment_settings: {
           save_default_payment_method: 'on_subscription'
         },
         expand: ['latest_invoice.payment_intent']
       });
       
       // Save subscription to database
       const subscription = await this.saveSubscription({
         id: stripeSubscription.id,
         userId,
         planId,
         status: stripeSubscription.status,
         billingPeriod,
         currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
         currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
         cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
         stripeCustomerId: customer.id
       });
       
       return subscription;
     }
     
     async updateSubscription(
       subscriptionId: string,
       updates: SubscriptionUpdate
     ): Promise<Subscription> {
       const subscription = await this.getSubscription(subscriptionId);
       
       if (updates.planId) {
         const newPlan = this.plans.get(updates.planId);
         if (!newPlan) throw new Error('Invalid plan');
         
         // Update Stripe subscription
         await this.stripe.subscriptions.update(subscription.stripeId, {
           items: [{
             id: subscription.stripeItemId,
             price: newPlan.stripePriceId[subscription.billingPeriod]
           }],
           proration_behavior: updates.prorationBehavior || 'create_prorations'
         });
       }
       
       if (updates.billingPeriod) {
         // Handle billing period change
         await this.changeBillingPeriod(subscription, updates.billingPeriod);
       }
       
       if (updates.quantity) {
         // Update quantity for seat-based pricing
         await this.stripe.subscriptions.update(subscription.stripeId, {
           items: [{
             id: subscription.stripeItemId,
             quantity: updates.quantity
           }]
         });
       }
       
       return this.getSubscription(subscriptionId);
     }
     
     async cancelSubscription(
       subscriptionId: string,
       immediately = false
     ): Promise<void> {
       const subscription = await this.getSubscription(subscriptionId);
       
       if (immediately) {
         await this.stripe.subscriptions.cancel(subscription.stripeId);
       } else {
         await this.stripe.subscriptions.update(subscription.stripeId, {
           cancel_at_period_end: true
         });
       }
       
       await this.updateSubscriptionStatus(subscriptionId, 
         immediately ? 'canceled' : 'pending_cancellation'
       );
     }
   }
   ```

2. **Usage-based billing**
   ```typescript
   // lib/billing/usage-billing.ts
   class UsageBilling {
     private stripe: Stripe;
     private usageTrackers: Map<string, UsageTracker> = new Map();
     
     async trackUsage(
       subscriptionId: string,
       metric: UsageMetric,
       quantity: number
     ) {
       // Record usage event
       const usageEvent = {
         subscriptionId,
         metric,
         quantity,
         timestamp: new Date(),
         processed: false
       };
       
       await this.saveUsageEvent(usageEvent);
       
       // Update real-time tracker
       this.updateUsageTracker(subscriptionId, metric, quantity);
       
       // Check if limits exceeded
       await this.checkUsageLimits(subscriptionId);
     }
     
     async reportUsageToStripe() {
       // Get unprocessed usage events
       const events = await this.getUnprocessedUsageEvents();
       
       // Group by subscription and metric
       const grouped = this.groupUsageEvents(events);
       
       // Report to Stripe
       for (const [key, usage] of grouped) {
         const [subscriptionId, metric] = key.split(':');
         
         await this.stripe.subscriptionItems.createUsageRecord(
           this.getSubscriptionItemId(subscriptionId, metric),
           {
             quantity: usage.quantity,
             timestamp: Math.floor(usage.timestamp.getTime() / 1000),
             action: 'increment'
           }
         );
       }
       
       // Mark events as processed
       await this.markEventsProcessed(events.map(e => e.id));
     }
     
     async calculateOverage(subscriptionId: string): Promise<OverageCharges> {
       const subscription = await this.getSubscription(subscriptionId);
       const usage = await this.getCurrentUsage(subscriptionId);
       const plan = await this.getPlan(subscription.planId);
       
       const overages: OverageCharges = {
         contentGenerations: 0,
         storage: 0,
         apiCalls: 0,
         total: 0
       };
       
       // Calculate overages
       if (usage.contentGenerations > plan.limits.contentGenerations) {
         overages.contentGenerations = 
           (usage.contentGenerations - plan.limits.contentGenerations) * 0.10; // $0.10 per generation
       }
       
       if (usage.storage > plan.limits.storage) {
         overages.storage = 
           (usage.storage - plan.limits.storage) * 5; // $5 per GB
       }
       
       if (usage.apiCalls > plan.limits.apiCalls) {
         overages.apiCalls = 
           Math.ceil((usage.apiCalls - plan.limits.apiCalls) / 1000) * 1; // $1 per 1000 calls
       }
       
       overages.total = 
         overages.contentGenerations + 
         overages.storage + 
         overages.apiCalls;
       
       return overages;
     }
   }
   ```

3. **Payment processing**
   ```typescript
   // lib/billing/payment-processor.ts
   class PaymentProcessor {
     private stripe: Stripe;
     
     async processPayment(
       amount: number,
       currency: string,
       paymentMethodId: string,
       metadata?: any
     ): Promise<PaymentResult> {
       try {
         const paymentIntent = await this.stripe.paymentIntents.create({
           amount: Math.round(amount * 100), // Convert to cents
           currency,
           payment_method: paymentMethodId,
           confirm: true,
           metadata
         });
         
         if (paymentIntent.status === 'succeeded') {
           await this.recordPayment({
             id: paymentIntent.id,
             amount,
             currency,
             status: 'succeeded',
             metadata
           });
           
           return {
             success: true,
             paymentId: paymentIntent.id
           };
         }
         
         return {
           success: false,
           error: 'Payment failed',
           requiresAction: paymentIntent.status === 'requires_action'
         };
       } catch (error) {
         return {
           success: false,
           error: error.message
         };
       }
     }
     
     async setupPaymentMethod(customerId: string): Promise<SetupIntent> {
       const setupIntent = await this.stripe.setupIntents.create({
         customer: customerId,
         payment_method_types: ['card'],
         usage: 'off_session'
       });
       
       return {
         clientSecret: setupIntent.client_secret!,
         id: setupIntent.id
       };
     }
     
     async handleWebhook(event: Stripe.Event) {
       switch (event.type) {
         case 'payment_intent.succeeded':
           await this.handlePaymentSuccess(event.data.object);
           break;
           
         case 'payment_intent.failed':
           await this.handlePaymentFailure(event.data.object);
           break;
           
         case 'invoice.paid':
           await this.handleInvoicePaid(event.data.object);
           break;
           
         case 'invoice.payment_failed':
           await this.handleInvoicePaymentFailed(event.data.object);
           break;
           
         case 'customer.subscription.updated':
           await this.handleSubscriptionUpdate(event.data.object);
           break;
           
         case 'customer.subscription.deleted':
           await this.handleSubscriptionDeleted(event.data.object);
           break;
       }
     }
   }
   ```

4. **Billing dashboard**
   ```tsx
   // components/billing/BillingDashboard.tsx
   const BillingDashboard: React.FC = () => {
     const [subscription, setSubscription] = useState<Subscription>();
     const [usage, setUsage] = useState<UsageStats>();
     const [invoices, setInvoices] = useState<Invoice[]>([]);
     const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
     
     return (
       <div className="billing-dashboard">
         <div className="billing-overview">
           <CurrentPlan
             plan={subscription?.plan}
             status={subscription?.status}
             nextBillingDate={subscription?.nextBillingDate}
             onUpgrade={() => setShowUpgradeModal(true)}
             onCancel={() => setShowCancelModal(true)}
           />
           
           <UsageWidget
             usage={usage}
             limits={subscription?.plan.limits}
             overage={usage?.overage}
           />
           
           <BillingCycle
             currentPeriod={subscription?.currentPeriod}
             billingAmount={subscription?.billingAmount}
             dueDate={subscription?.dueDate}
           />
         </div>
         
         <div className="billing-tabs">
           <Tabs>
             <TabPanel label="Subscription">
               <SubscriptionDetails
                 subscription={subscription}
                 onUpdate={(updates) => updateSubscription(updates)}
               />
               
               <PlanComparison
                 currentPlan={subscription?.planId}
                 plans={availablePlans}
                 onSelectPlan={(planId) => changePlan(planId)}
               />
             </TabPanel>
             
             <TabPanel label="Usage">
               <UsageChart
                 data={usage?.history}
                 period={selectedPeriod}
                 onPeriodChange={setSelectedPeriod}
               />
               
               <UsageBreakdown
                 contentGenerations={usage?.contentGenerations}
                 storage={usage?.storage}
                 apiCalls={usage?.apiCalls}
                 users={usage?.activeUsers}
               />
               
               <OverageAlert
                 overages={usage?.overages}
                 estimatedCost={usage?.estimatedOverageCost}
               />
             </TabPanel>
             
             <TabPanel label="Invoices">
               <InvoiceList
                 invoices={invoices}
                 onDownload={(invoiceId) => downloadInvoice(invoiceId)}
                 onPay={(invoiceId) => payInvoice(invoiceId)}
               />
             </TabPanel>
             
             <TabPanel label="Payment Methods">
               <PaymentMethodList
                 methods={paymentMethods}
                 defaultMethod={subscription?.defaultPaymentMethod}
                 onSetDefault={(methodId) => setDefaultPaymentMethod(methodId)}
                 onRemove={(methodId) => removePaymentMethod(methodId)}
               />
               
               <AddPaymentMethod
                 onAdd={(method) => addPaymentMethod(method)}
               />
             </TabPanel>
           </Tabs>
         </div>
         
         <UpgradeModal
           isOpen={showUpgradeModal}
           currentPlan={subscription?.plan}
           availablePlans={availablePlans}
           onUpgrade={(planId, billingPeriod) => upgradePlan(planId, billingPeriod)}
           onClose={() => setShowUpgradeModal(false)}
         />
         
         <CancelSubscriptionModal
           isOpen={showCancelModal}
           subscription={subscription}
           onConfirm={(reason) => cancelSubscription(reason)}
           onClose={() => setShowCancelModal(false)}
         />
       </div>
     );
   };
   ```

5. **Invoice generation**
   ```typescript
   // lib/billing/invoice-generator.ts
   class InvoiceGenerator {
     async generateInvoice(
       subscriptionId: string,
       period: BillingPeriod
     ): Promise<Invoice> {
       const subscription = await this.getSubscription(subscriptionId);
       const customer = await this.getCustomer(subscription.customerId);
       const usage = await this.getUsageForPeriod(subscriptionId, period);
       
       const invoice: Invoice = {
         id: generateInvoiceNumber(),
         customerId: customer.id,
         subscriptionId,
         period,
         issueDate: new Date(),
         dueDate: this.calculateDueDate(),
         status: 'draft',
         lineItems: [],
         subtotal: 0,
         tax: 0,
         total: 0,
         currency: subscription.currency
       };
       
       // Add subscription fee
       invoice.lineItems.push({
         description: `${subscription.plan.name} Plan - ${period.billingPeriod}`,
         quantity: 1,
         unitPrice: subscription.plan.pricing[period.billingPeriod],
         amount: subscription.plan.pricing[period.billingPeriod]
       });
       
       // Add usage-based charges
       const overages = await this.calculateOverages(usage, subscription.plan);
       
       if (overages.contentGenerations > 0) {
         invoice.lineItems.push({
           description: `Additional Content Generations (${overages.contentGenerations})`,
           quantity: overages.contentGenerations,
           unitPrice: 0.10,
           amount: overages.contentGenerations * 0.10
         });
       }
       
       // Calculate totals
       invoice.subtotal = invoice.lineItems.reduce((sum, item) => sum + item.amount, 0);
       invoice.tax = await this.calculateTax(customer, invoice.subtotal);
       invoice.total = invoice.subtotal + invoice.tax;
       
       // Save invoice
       await this.saveInvoice(invoice);
       
       // Generate PDF
       await this.generatePDF(invoice);
       
       return invoice;
     }
     
     private async generatePDF(invoice: Invoice): Promise<Buffer> {
       const html = await this.renderInvoiceHTML(invoice);
       
       const browser = await puppeteer.launch();
       const page = await browser.newPage();
       await page.setContent(html);
       
       const pdf = await page.pdf({
         format: 'A4',
         printBackground: true,
         margin: {
           top: '20mm',
           bottom: '20mm',
           left: '20mm',
           right: '20mm'
         }
       });
       
       await browser.close();
       
       // Store PDF
       await this.storePDF(invoice.id, pdf);
       
       return pdf;
     }
   }
   ```

## Files to Create

- `lib/billing/subscription-manager.ts` - Subscription management
- `lib/billing/usage-billing.ts` - Usage tracking and billing
- `lib/billing/payment-processor.ts` - Payment processing
- `lib/billing/invoice-generator.ts` - Invoice generation
- `lib/billing/stripe-webhooks.ts` - Stripe webhook handlers
- `components/billing/BillingDashboard.tsx` - Billing dashboard UI
- `components/billing/PricingPlans.tsx` - Pricing plans display
- `components/billing/PaymentForm.tsx` - Payment form component
- `pages/billing/dashboard.tsx` - Billing dashboard page
- `api/stripe/webhook.ts` - Stripe webhook endpoint

## Pricing Tiers

| Feature | Free | Starter ($49/mo) | Professional ($199/mo) | Enterprise (Custom) |
|---------|------|-----------------|----------------------|-------------------|
| Users | 1 | 5 | 20 | Unlimited |
| Content Generations | 10/mo | 500/mo | 5000/mo | Unlimited |
| Storage | 1 GB | 10 GB | 100 GB | Unlimited |
| API Calls | 100/mo | 5000/mo | 50000/mo | Unlimited |
| Custom Domains | 0 | 1 | 5 | Unlimited |
| Support | Community | Email | Priority | Dedicated |

## Acceptance Criteria

- [ ] Subscription creation and management
- [ ] Payment processing with Stripe
- [ ] Usage tracking and limits
- [ ] Overage billing
- [ ] Invoice generation
- [ ] Payment method management
- [ ] Billing dashboard functional
- [ ] Webhook handling

## Testing Requirements

- [ ] Test subscription lifecycle
- [ ] Test payment processing
- [ ] Test usage tracking
- [ ] Test overage calculations
- [ ] Test invoice generation
- [ ] Test webhook handling
- [ ] Test payment failures
- [ ] Test subscription upgrades/downgrades

## Definition of Done

- [ ] Code complete and committed
- [ ] Stripe integration working
- [ ] Subscription management functional
- [ ] Usage tracking accurate
- [ ] Invoices generated correctly
- [ ] Payment processing secure
- [ ] Tests written and passing
- [ ] PCI compliance verified