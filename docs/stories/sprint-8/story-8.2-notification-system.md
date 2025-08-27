# Story 8.2: Notification & Communication System

## User Story

As a user,
I want to receive timely notifications about important events and updates,
So that I can stay informed about my content generation activities and system status.

## Size & Priority

- **Size**: M (6 hours)
- **Priority**: P2 - Medium
- **Sprint**: 8
- **Dependencies**: None

## Description

Implement a comprehensive notification system with in-app notifications, email notifications, push notifications, and customizable preferences for different event types.

## Implementation Steps

1. **Notification service**

   ```typescript
   // lib/notifications/notification-service.ts
   interface Notification {
     id: string;
     userId: string;
     type: NotificationType;
     channel: NotificationChannel[];
     priority: 'low' | 'normal' | 'high' | 'urgent';
     title: string;
     message: string;
     data?: any;
     actions?: NotificationAction[];
     status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
     createdAt: Date;
     sentAt?: Date;
     readAt?: Date;
     expiresAt?: Date;
   }

   type NotificationType =
     | 'content-generated'
     | 'generation-failed'
     | 'bulk-complete'
     | 'review-required'
     | 'subscription-update'
     | 'usage-alert'
     | 'system-maintenance'
     | 'security-alert'
     | 'team-invitation'
     | 'integration-status';

   type NotificationChannel = 'in-app' | 'email' | 'push' | 'sms' | 'slack';

   class NotificationService {
     private channels: Map<NotificationChannel, NotificationChannel>;
     private queue: NotificationQueue;
     private preferences: UserPreferences;

     async send(notification: CreateNotificationDto): Promise<void> {
       // Check user preferences
       const userPrefs = await this.getUserPreferences(notification.userId);
       const enabledChannels = this.getEnabledChannels(notification.type, userPrefs);

       // Create notification record
       const notif = await this.createNotification({
         ...notification,
         channel: enabledChannels,
         status: 'pending',
       });

       // Send through each channel
       for (const channel of enabledChannels) {
         await this.sendToChannel(notif, channel);
       }
     }

     async sendBatch(notifications: CreateNotificationDto[]): Promise<void> {
       // Group by user for batching
       const grouped = this.groupByUser(notifications);

       for (const [userId, userNotifications] of grouped) {
         // Check if we should batch or send individually
         if (this.shouldBatch(userNotifications)) {
           await this.sendBatchedNotification(userId, userNotifications);
         } else {
           for (const notif of userNotifications) {
             await this.send(notif);
           }
         }
       }
     }

     private async sendToChannel(
       notification: Notification,
       channel: NotificationChannel
     ): Promise<void> {
       const handler = this.channels.get(channel);
       if (!handler) {
         throw new Error(`Channel ${channel} not configured`);
       }

       try {
         await handler.send(notification);
         await this.updateStatus(notification.id, 'sent', channel);
       } catch (error) {
         await this.handleSendError(notification, channel, error);
       }
     }

     private shouldBatch(notifications: Notification[]): boolean {
       // Batch if multiple notifications of same type within short time
       const types = new Set(notifications.map((n) => n.type));
       const timeRange = this.getTimeRange(notifications);

       return types.size === 1 && timeRange < 300000; // 5 minutes
     }

     async markAsRead(notificationId: string): Promise<void> {
       await this.updateNotification(notificationId, {
         status: 'read',
         readAt: new Date(),
       });

       // Update unread count
       await this.updateUnreadCount(notification.userId);
     }

     async getUnreadCount(userId: string): Promise<number> {
       const { count } = await supabase
         .from('notifications')
         .select('*', { count: 'exact', head: true })
         .eq('user_id', userId)
         .eq('status', 'delivered');

       return count || 0;
     }
   }
   ```

2. **Notification channels**

   ```typescript
   // lib/notifications/channels/email-channel.ts
   class EmailNotificationChannel implements NotificationChannel {
     private emailService: EmailService;
     private templates: EmailTemplates;

     async send(notification: Notification): Promise<void> {
       const template = await this.getTemplate(notification.type);
       const user = await this.getUser(notification.userId);

       const email = {
         to: user.email,
         subject: this.renderSubject(template.subject, notification),
         html: this.renderHTML(template.html, notification),
         text: this.renderText(template.text, notification),
         priority: this.mapPriority(notification.priority),
         tags: [notification.type],
         metadata: {
           notificationId: notification.id,
           userId: notification.userId,
         },
       };

       // Add action buttons
       if (notification.actions) {
         email.html = this.addActionButtons(email.html, notification.actions);
       }

       await this.emailService.send(email);
     }

     private renderHTML(template: string, notification: Notification): string {
       return handlebars.compile(template)({
         title: notification.title,
         message: notification.message,
         data: notification.data,
         appUrl: process.env.NEXT_PUBLIC_APP_URL,
         unsubscribeUrl: this.getUnsubscribeUrl(notification.userId),
       });
     }
   }

   // lib/notifications/channels/push-channel.ts
   class PushNotificationChannel implements NotificationChannel {
     private webPush: WebPushService;

     async send(notification: Notification): Promise<void> {
       const subscriptions = await this.getUserSubscriptions(notification.userId);

       const payload = {
         title: notification.title,
         body: notification.message,
         icon: '/icon-192.png',
         badge: '/badge-72.png',
         tag: notification.type,
         data: {
           notificationId: notification.id,
           url: notification.data?.url || '/',
           actions: notification.actions,
         },
         requireInteraction: notification.priority === 'urgent',
       };

       // Send to all user's devices
       await Promise.all(subscriptions.map((sub) => this.webPush.sendNotification(sub, payload)));
     }
   }

   // lib/notifications/channels/in-app-channel.ts
   class InAppNotificationChannel implements NotificationChannel {
     private realtimeService: RealtimeService;

     async send(notification: Notification): Promise<void> {
       // Store in database
       await this.storeNotification(notification);

       // Send real-time update
       await this.realtimeService.broadcast(`user:${notification.userId}`, 'notification', {
         id: notification.id,
         type: notification.type,
         title: notification.title,
         message: notification.message,
         priority: notification.priority,
         timestamp: notification.createdAt,
       });

       // Update notification badge
       await this.updateBadgeCount(notification.userId);
     }
   }
   ```

3. **Notification preferences**

   ```typescript
   // lib/notifications/preferences.ts
   interface NotificationPreferences {
     userId: string;
     email: EmailPreferences;
     push: PushPreferences;
     inApp: InAppPreferences;
     quiet: QuietHours;
     frequency: FrequencySettings;
   }

   interface EmailPreferences {
     enabled: boolean;
     types: {
       [key in NotificationType]: boolean;
     };
     digest: 'immediate' | 'hourly' | 'daily' | 'weekly';
     format: 'html' | 'text';
   }

   class NotificationPreferencesManager {
     async getUserPreferences(userId: string): Promise<NotificationPreferences> {
       let prefs = await this.loadPreferences(userId);

       if (!prefs) {
         prefs = this.getDefaultPreferences(userId);
         await this.savePreferences(prefs);
       }

       return prefs;
     }

     async updatePreferences(
       userId: string,
       updates: Partial<NotificationPreferences>
     ): Promise<void> {
       const current = await this.getUserPreferences(userId);
       const updated = { ...current, ...updates };

       // Validate preferences
       this.validatePreferences(updated);

       // Save to database
       await this.savePreferences(updated);

       // Update notification service
       await this.notificationService.updateUserPreferences(userId, updated);
     }

     private getDefaultPreferences(userId: string): NotificationPreferences {
       return {
         userId,
         email: {
           enabled: true,
           types: {
             'content-generated': true,
             'generation-failed': true,
             'bulk-complete': true,
             'review-required': true,
             'subscription-update': true,
             'usage-alert': true,
             'system-maintenance': true,
             'security-alert': true,
             'team-invitation': true,
             'integration-status': false,
           },
           digest: 'immediate',
           format: 'html',
         },
         push: {
           enabled: false,
           types: {
             'content-generated': false,
             'generation-failed': true,
             'bulk-complete': true,
             'review-required': true,
             'subscription-update': false,
             'usage-alert': true,
             'system-maintenance': true,
             'security-alert': true,
             'team-invitation': true,
             'integration-status': false,
           },
           sound: true,
           vibrate: true,
         },
         inApp: {
           enabled: true,
           showBadge: true,
           playSound: false,
           desktop: true,
         },
         quiet: {
           enabled: false,
           start: '22:00',
           end: '08:00',
           timezone: 'UTC',
           override: ['urgent', 'security-alert'],
         },
         frequency: {
           maxPerHour: 10,
           maxPerDay: 50,
           batchSimilar: true,
           batchWindow: 300000, // 5 minutes
         },
       };
     }

     shouldSendNotification(
       type: NotificationType,
       channel: NotificationChannel,
       prefs: NotificationPreferences
     ): boolean {
       // Check if channel is enabled
       if (!prefs[channel]?.enabled) return false;

       // Check if type is enabled for channel
       if (!prefs[channel]?.types?.[type]) return false;

       // Check quiet hours
       if (this.isQuietHours(prefs.quiet)) {
         if (!prefs.quiet.override.includes(type)) {
           return false;
         }
       }

       // Check frequency limits
       if (this.exceedsFrequencyLimit(prefs.frequency)) {
         return false;
       }

       return true;
     }
   }
   ```

4. **Notification UI components**

   ```tsx
   // components/notifications/NotificationCenter.tsx
   const NotificationCenter: React.FC = () => {
     const [notifications, setNotifications] = useState<Notification[]>([]);
     const [unreadCount, setUnreadCount] = useState(0);
     const [isOpen, setIsOpen] = useState(false);
     const [filter, setFilter] = useState<NotificationType | 'all'>('all');

     useEffect(() => {
       // Subscribe to real-time notifications
       const subscription = supabase
         .from('notifications')
         .on('INSERT', (payload) => {
           setNotifications((prev) => [payload.new, ...prev]);
           setUnreadCount((prev) => prev + 1);

           // Show toast for important notifications
           if (payload.new.priority === 'high' || payload.new.priority === 'urgent') {
             showToast(payload.new);
           }
         })
         .subscribe();

       return () => subscription.unsubscribe();
     }, []);

     const markAsRead = async (notificationId: string) => {
       await notificationService.markAsRead(notificationId);

       setNotifications((prev) =>
         prev.map((n) => (n.id === notificationId ? { ...n, status: 'read' } : n))
       );

       setUnreadCount((prev) => Math.max(0, prev - 1));
     };

     const markAllAsRead = async () => {
       await notificationService.markAllAsRead();

       setNotifications((prev) => prev.map((n) => ({ ...n, status: 'read' })));

       setUnreadCount(0);
     };

     return (
       <>
         <button className="notification-bell" onClick={() => setIsOpen(!isOpen)}>
           <BellIcon />
           {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
         </button>

         {isOpen && (
           <div className="notification-dropdown">
             <div className="notification-header">
               <h3>Notifications</h3>
               <div className="notification-actions">
                 <button onClick={markAllAsRead}>Mark all as read</button>
                 <Link href="/settings/notifications">Settings</Link>
               </div>
             </div>

             <div className="notification-filters">
               <button
                 onClick={() => setFilter('all')}
                 className={filter === 'all' ? 'active' : ''}
               >
                 All
               </button>
               <button
                 onClick={() => setFilter('content-generated')}
                 className={filter === 'content-generated' ? 'active' : ''}
               >
                 Content
               </button>
               <button
                 onClick={() => setFilter('system-maintenance')}
                 className={filter === 'system-maintenance' ? 'active' : ''}
               >
                 System
               </button>
             </div>

             <div className="notification-list">
               {filteredNotifications.length === 0 ? (
                 <EmptyState message="No notifications" />
               ) : (
                 filteredNotifications.map((notification) => (
                   <NotificationItem
                     key={notification.id}
                     notification={notification}
                     onRead={() => markAsRead(notification.id)}
                     onAction={(action) => handleAction(notification, action)}
                   />
                 ))
               )}
             </div>

             <div className="notification-footer">
               <Link href="/notifications">View all notifications</Link>
             </div>
           </div>
         )}
       </>
     );
   };

   // Notification preferences UI
   const NotificationPreferences: React.FC = () => {
     const [preferences, setPreferences] = useState<NotificationPreferences>();
     const [saving, setSaving] = useState(false);

     const handleToggle = (channel: string, type: string, value: boolean) => {
       setPreferences((prev) => ({
         ...prev!,
         [channel]: {
           ...prev![channel],
           types: {
             ...prev![channel].types,
             [type]: value,
           },
         },
       }));
     };

     const savePreferences = async () => {
       setSaving(true);
       await notificationService.updatePreferences(preferences);
       setSaving(false);
       showToast('Preferences saved');
     };

     return (
       <div className="notification-preferences">
         <h2>Notification Preferences</h2>

         <div className="preference-section">
           <h3>Email Notifications</h3>
           <Switch
             checked={preferences?.email.enabled}
             onChange={(v) =>
               setPreferences((prev) => ({
                 ...prev!,
                 email: { ...prev!.email, enabled: v },
               }))
             }
             label="Enable email notifications"
           />

           {preferences?.email.enabled && (
             <>
               <div className="notification-types">
                 {Object.entries(notificationTypes).map(([key, label]) => (
                   <Checkbox
                     key={key}
                     checked={preferences.email.types[key]}
                     onChange={(v) => handleToggle('email', key, v)}
                     label={label}
                   />
                 ))}
               </div>

               <Select
                 value={preferences.email.digest}
                 onChange={(v) =>
                   setPreferences((prev) => ({
                     ...prev!,
                     email: { ...prev!.email, digest: v },
                   }))
                 }
                 options={[
                   { value: 'immediate', label: 'Send immediately' },
                   { value: 'hourly', label: 'Hourly digest' },
                   { value: 'daily', label: 'Daily digest' },
                   { value: 'weekly', label: 'Weekly digest' },
                 ]}
               />
             </>
           )}
         </div>

         <div className="preference-section">
           <h3>Push Notifications</h3>
           <PushNotificationSetup
             enabled={preferences?.push.enabled}
             onEnable={() => enablePushNotifications()}
           />
         </div>

         <div className="preference-section">
           <h3>Quiet Hours</h3>
           <QuietHoursSettings
             settings={preferences?.quiet}
             onChange={(quiet) => setPreferences((prev) => ({ ...prev!, quiet }))}
           />
         </div>

         <button onClick={savePreferences} disabled={saving}>
           {saving ? 'Saving...' : 'Save Preferences'}
         </button>
       </div>
     );
   };
   ```

5. **Notification templates**
   ```typescript
   // lib/notifications/templates.ts
   class NotificationTemplateEngine {
     private templates = new Map<NotificationType, NotificationTemplate>();

     constructor() {
       this.loadTemplates();
     }

     private loadTemplates() {
       this.templates.set('content-generated', {
         title: 'Content Generation Complete',
         message: 'Your {{contentType}} content for "{{title}}" has been generated successfully.',
         email: {
           subject: '✨ Your content is ready!',
           template: 'content-generated',
         },
         actions: [
           { label: 'View Content', action: 'view', primary: true },
           { label: 'Edit', action: 'edit' },
         ],
       });

       this.templates.set('generation-failed', {
         title: 'Content Generation Failed',
         message: 'Failed to generate {{contentType}} content: {{error}}',
         email: {
           subject: '⚠️ Content generation issue',
           template: 'generation-failed',
         },
         actions: [
           { label: 'Retry', action: 'retry', primary: true },
           { label: 'View Details', action: 'details' },
         ],
       });

       this.templates.set('usage-alert', {
         title: 'Usage Alert',
         message: "You've used {{percentage}}% of your monthly {{resource}} allowance.",
         email: {
           subject: '📊 Usage alert for your account',
           template: 'usage-alert',
         },
         actions: [
           { label: 'View Usage', action: 'usage' },
           { label: 'Upgrade Plan', action: 'upgrade' },
         ],
       });
     }

     render(
       type: NotificationType,
       data: any
     ): { title: string; message: string; actions?: NotificationAction[] } {
       const template = this.templates.get(type);
       if (!template) {
         throw new Error(`Template not found for type: ${type}`);
       }

       return {
         title: this.interpolate(template.title, data),
         message: this.interpolate(template.message, data),
         actions: template.actions,
       };
     }

     private interpolate(template: string, data: any): string {
       return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
         return data[key] || match;
       });
     }
   }
   ```

## Files to Create

- `lib/notifications/notification-service.ts` - Core notification service
- `lib/notifications/channels/email-channel.ts` - Email notifications
- `lib/notifications/channels/push-channel.ts` - Push notifications
- `lib/notifications/channels/in-app-channel.ts` - In-app notifications
- `lib/notifications/preferences.ts` - Preference management
- `lib/notifications/templates.ts` - Notification templates
- `components/notifications/NotificationCenter.tsx` - Notification UI
- `components/notifications/NotificationPreferences.tsx` - Settings UI
- `pages/notifications/index.tsx` - Notifications page
- `api/notifications/webhook.ts` - Webhook handler

## Notification Types

- **Content**: Generation complete, failed, review required
- **System**: Maintenance, updates, outages
- **Billing**: Subscription changes, payment issues, usage alerts
- **Security**: Login attempts, password changes, API key usage
- **Team**: Invitations, role changes, team updates
- **Integration**: Connection status, sync complete, errors

## Acceptance Criteria

- [ ] In-app notifications working
- [ ] Email notifications sent
- [ ] Push notifications functional
- [ ] Preference management UI
- [ ] Real-time updates
- [ ] Notification history
- [ ] Batch/digest options
- [ ] Quiet hours respected

## Testing Requirements

- [ ] Test notification delivery
- [ ] Test preference filtering
- [ ] Test real-time updates
- [ ] Test email templates
- [ ] Test push notifications
- [ ] Test batch processing
- [ ] Test quiet hours
- [ ] Test unsubscribe

## Definition of Done

- [ ] Code complete and committed
- [ ] All channels functional
- [ ] Preferences working
- [ ] Templates created
- [ ] Real-time updates active
- [ ] Tests written and passing
- [ ] Documentation updated
- [ ] User acceptance testing
