# Story 8.3: Content Sharing & Collaboration

## User Story
As a content team member,
I want to share and collaborate on generated content with my team,
So that we can review, edit, and approve content together efficiently.

## Size & Priority
- **Size**: M (6 hours)
- **Priority**: P2 - Medium
- **Sprint**: 8
- **Dependencies**: Task 7.1 (User management)

## Description
Implement content sharing and collaboration features including shareable links, real-time collaborative editing, comments and annotations, version control, and approval workflows.

## Implementation Steps

1. **Content sharing system**
   ```typescript
   // lib/sharing/content-sharing.ts
   interface ContentShare {
     id: string;
     contentId: string;
     createdBy: string;
     type: 'view' | 'edit' | 'review';
     permissions: SharePermissions;
     accessMethod: 'link' | 'email' | 'team';
     shareLink?: string;
     recipients?: ShareRecipient[];
     expiresAt?: Date;
     password?: string;
     settings: ShareSettings;
     analytics: ShareAnalytics;
   }
   
   interface SharePermissions {
     canView: boolean;
     canEdit: boolean;
     canComment: boolean;
     canDownload: boolean;
     canShare: boolean;
   }
   
   class ContentSharingManager {
     async createShare(
       contentId: string,
       options: CreateShareOptions
     ): Promise<ContentShare> {
       const content = await this.getContent(contentId);
       
       // Verify permissions
       if (!await this.canShare(content, options.userId)) {
         throw new Error('Insufficient permissions to share this content');
       }
       
       // Generate unique share link
       const shareLink = await this.generateSecureLink();
       
       // Create share record
       const share: ContentShare = {
         id: generateId(),
         contentId,
         createdBy: options.userId,
         type: options.type || 'view',
         permissions: this.getPermissionsForType(options.type),
         accessMethod: options.accessMethod,
         shareLink,
         recipients: options.recipients,
         expiresAt: options.expiresAt,
         password: options.password ? await this.hashPassword(options.password) : undefined,
         settings: {
           requireAuth: options.requireAuth || false,
           trackViews: options.trackViews !== false,
           allowComments: options.allowComments || false,
           watermark: options.watermark || false,
           downloadFormat: options.downloadFormat || ['pdf', 'html']
         },
         analytics: {
           views: 0,
           uniqueViewers: 0,
           edits: 0,
           comments: 0,
           downloads: 0
         }
       };
       
       // Save share
       await this.saveShare(share);
       
       // Send notifications
       if (share.recipients) {
         await this.notifyRecipients(share);
       }
       
       return share;
     }
     
     async accessSharedContent(
       shareId: string,
       accessData: ShareAccessData
     ): Promise<SharedContentAccess> {
       const share = await this.getShare(shareId);
       
       // Validate access
       await this.validateAccess(share, accessData);
       
       // Track access
       await this.trackAccess(share, accessData);
       
       // Get content with applied permissions
       const content = await this.getContentWithPermissions(
         share.contentId,
         share.permissions
       );
       
       // Apply watermark if enabled
       if (share.settings.watermark) {
         content.html = this.applyWatermark(content.html, accessData.userInfo);
       }
       
       return {
         content,
         permissions: share.permissions,
         shareId: share.id,
         expiresAt: share.expiresAt
       };
     }
     
     private async validateAccess(
       share: ContentShare,
       accessData: ShareAccessData
     ): Promise<void> {
       // Check expiration
       if (share.expiresAt && share.expiresAt < new Date()) {
         throw new Error('This share link has expired');
       }
       
       // Check password
       if (share.password) {
         if (!accessData.password) {
           throw new Error('Password required');
         }
         
         const isValid = await this.verifyPassword(
           accessData.password,
           share.password
         );
         
         if (!isValid) {
           throw new Error('Invalid password');
         }
       }
       
       // Check authentication requirement
       if (share.settings.requireAuth && !accessData.userId) {
         throw new Error('Authentication required');
       }
       
       // Check recipient list
       if (share.recipients && share.recipients.length > 0) {
         const isRecipient = share.recipients.some(r => 
           r.email === accessData.userEmail || r.userId === accessData.userId
         );
         
         if (!isRecipient) {
           throw new Error('You are not authorized to access this content');
         }
       }
     }
     
     async updateSharePermissions(
       shareId: string,
       permissions: Partial<SharePermissions>
     ): Promise<void> {
       const share = await this.getShare(shareId);
       
       share.permissions = { ...share.permissions, ...permissions };
       
       await this.saveShare(share);
       
       // Notify active collaborators
       await this.notifyPermissionChange(share);
     }
   }
   ```

2. **Real-time collaboration**
   ```typescript
   // lib/collaboration/realtime-collaboration.ts
   import * as Y from 'yjs';
   import { WebsocketProvider } from 'y-websocket';
   
   interface CollaborationSession {
     id: string;
     contentId: string;
     document: Y.Doc;
     provider: WebsocketProvider;
     users: Map<string, CollaboratorInfo>;
     cursors: Map<string, CursorPosition>;
     selections: Map<string, SelectionRange>;
   }
   
   class RealtimeCollaboration {
     private sessions = new Map<string, CollaborationSession>();
     
     async joinSession(
       contentId: string,
       userId: string,
       userInfo: CollaboratorInfo
     ): Promise<CollaborationSession> {
       let session = this.sessions.get(contentId);
       
       if (!session) {
         session = await this.createSession(contentId);
       }
       
       // Add user to session
       session.users.set(userId, userInfo);
       
       // Set up awareness
       session.provider.awareness.setLocalStateField('user', {
         id: userId,
         name: userInfo.name,
         color: userInfo.color
       });
       
       // Track cursor and selection
       this.setupCursorTracking(session, userId);
       
       // Broadcast user joined
       this.broadcastEvent(session, 'user-joined', { userId, userInfo });
       
       return session;
     }
     
     private async createSession(contentId: string): Promise<CollaborationSession> {
       const doc = new Y.Doc();
       
       // Load initial content
       const content = await this.loadContent(contentId);
       const yText = doc.getText('content');
       yText.insert(0, content.text);
       
       // Create WebSocket provider
       const provider = new WebsocketProvider(
         process.env.NEXT_PUBLIC_WS_URL!,
         contentId,
         doc
       );
       
       // Set up persistence
       provider.on('synced', () => {
         this.persistChanges(contentId, doc);
       });
       
       const session: CollaborationSession = {
         id: generateId(),
         contentId,
         document: doc,
         provider,
         users: new Map(),
         cursors: new Map(),
         selections: new Map()
       };
       
       this.sessions.set(contentId, session);
       
       // Set up change tracking
       this.trackChanges(session);
       
       return session;
     }
     
     private trackChanges(session: CollaborationSession) {
       const yText = session.document.getText('content');
       
       yText.observe(event => {
         // Track who made changes
         const userId = session.provider.awareness.clientID;
         const user = session.users.get(userId);
         
         // Create revision
         this.createRevision({
           contentId: session.contentId,
           userId,
           changes: event.changes,
           timestamp: new Date()
         });
         
         // Update last modified
         this.updateLastModified(session.contentId, userId);
       });
     }
     
     private setupCursorTracking(session: CollaborationSession, userId: string) {
       session.provider.awareness.on('change', changes => {
         changes.added.forEach(clientId => {
           const state = session.provider.awareness.getStates().get(clientId);
           if (state?.cursor) {
             session.cursors.set(userId, state.cursor);
           }
           if (state?.selection) {
             session.selections.set(userId, state.selection);
           }
         });
       });
     }
     
     async addComment(
       sessionId: string,
       comment: CommentData
     ): Promise<Comment> {
       const session = this.sessions.get(sessionId);
       if (!session) throw new Error('Session not found');
       
       const yComments = session.document.getArray('comments');
       const newComment = {
         id: generateId(),
         ...comment,
         timestamp: new Date(),
         resolved: false
       };
       
       yComments.push([newComment]);
       
       // Notify collaborators
       this.broadcastEvent(session, 'comment-added', newComment);
       
       return newComment;
     }
   }
   ```

3. **Comments and annotations**
   ```typescript
   // lib/collaboration/comments.ts
   interface Comment {
     id: string;
     contentId: string;
     userId: string;
     text: string;
     selection?: TextRange;
     parentId?: string; // For replies
     resolved: boolean;
     resolvedBy?: string;
     resolvedAt?: Date;
     mentions: string[];
     attachments: Attachment[];
     reactions: Reaction[];
     createdAt: Date;
     updatedAt: Date;
   }
   
   class CommentSystem {
     async addComment(data: CreateCommentData): Promise<Comment> {
       const comment: Comment = {
         id: generateId(),
         contentId: data.contentId,
         userId: data.userId,
         text: data.text,
         selection: data.selection,
         parentId: data.parentId,
         resolved: false,
         mentions: this.extractMentions(data.text),
         attachments: data.attachments || [],
         reactions: [],
         createdAt: new Date(),
         updatedAt: new Date()
       };
       
       // Save comment
       await this.saveComment(comment);
       
       // Create notifications for mentions
       if (comment.mentions.length > 0) {
         await this.notifyMentions(comment);
       }
       
       // Notify content owner
       await this.notifyContentOwner(comment);
       
       // Update activity feed
       await this.updateActivityFeed(comment);
       
       return comment;
     }
     
     async addAnnotation(data: CreateAnnotationData): Promise<Annotation> {
       const annotation: Annotation = {
         id: generateId(),
         contentId: data.contentId,
         userId: data.userId,
         type: data.type, // highlight, underline, strikethrough
         color: data.color,
         selection: data.selection,
         note: data.note,
         createdAt: new Date()
       };
       
       await this.saveAnnotation(annotation);
       
       // Broadcast to collaborators
       await this.broadcastAnnotation(annotation);
       
       return annotation;
     }
     
     async resolveComment(commentId: string, userId: string): Promise<void> {
       const comment = await this.getComment(commentId);
       
       comment.resolved = true;
       comment.resolvedBy = userId;
       comment.resolvedAt = new Date();
       
       await this.updateComment(comment);
       
       // Notify participants
       await this.notifyResolution(comment);
     }
     
     async addReaction(
       commentId: string,
       userId: string,
       emoji: string
     ): Promise<void> {
       const comment = await this.getComment(commentId);
       
       const existingReaction = comment.reactions.find(
         r => r.emoji === emoji && r.userId === userId
       );
       
       if (existingReaction) {
         // Remove reaction
         comment.reactions = comment.reactions.filter(
           r => !(r.emoji === emoji && r.userId === userId)
         );
       } else {
         // Add reaction
         comment.reactions.push({ userId, emoji });
       }
       
       await this.updateComment(comment);
     }
     
     private extractMentions(text: string): string[] {
       const mentionRegex = /@(\w+)/g;
       const mentions: string[] = [];
       let match;
       
       while ((match = mentionRegex.exec(text)) !== null) {
         mentions.push(match[1]);
       }
       
       return mentions;
     }
   }
   ```

4. **Version control**
   ```typescript
   // lib/collaboration/version-control.ts
   interface ContentVersion {
     id: string;
     contentId: string;
     version: string;
     content: any;
     changes: ContentChange[];
     author: string;
     message?: string;
     timestamp: Date;
     tags: string[];
   }
   
   class VersionControl {
     async createVersion(
       contentId: string,
       changes: ContentChange[],
       message?: string
     ): Promise<ContentVersion> {
       const currentVersion = await this.getCurrentVersion(contentId);
       const newVersionNumber = this.incrementVersion(currentVersion.version);
       
       const version: ContentVersion = {
         id: generateId(),
         contentId,
         version: newVersionNumber,
         content: await this.getContent(contentId),
         changes,
         author: changes[0].userId,
         message,
         timestamp: new Date(),
         tags: []
       };
       
       await this.saveVersion(version);
       
       // Update current version pointer
       await this.updateCurrentVersion(contentId, version.id);
       
       return version;
     }
     
     async compareVersions(
       versionId1: string,
       versionId2: string
     ): Promise<VersionDiff> {
       const v1 = await this.getVersion(versionId1);
       const v2 = await this.getVersion(versionId2);
       
       const diff = this.calculateDiff(v1.content, v2.content);
       
       return {
         from: v1,
         to: v2,
         diff,
         additions: diff.filter(d => d.type === 'add').length,
         deletions: diff.filter(d => d.type === 'delete').length,
         modifications: diff.filter(d => d.type === 'modify').length
       };
     }
     
     async revertToVersion(contentId: string, versionId: string): Promise<void> {
       const version = await this.getVersion(versionId);
       
       // Create new version as revert
       await this.createVersion(
         contentId,
         [{ type: 'revert', targetVersion: versionId }],
         `Reverted to version ${version.version}`
       );
       
       // Update content
       await this.updateContent(contentId, version.content);
     }
     
     async mergeBranches(
       mainBranchId: string,
       featureBranchId: string,
       strategy: 'merge' | 'rebase' | 'squash'
     ): Promise<MergeResult> {
       const mainBranch = await this.getBranch(mainBranchId);
       const featureBranch = await this.getBranch(featureBranchId);
       
       // Check for conflicts
       const conflicts = await this.detectConflicts(mainBranch, featureBranch);
       
       if (conflicts.length > 0 && strategy !== 'squash') {
         return {
           success: false,
           conflicts,
           requiresResolution: true
         };
       }
       
       // Perform merge based on strategy
       let mergedContent;
       switch (strategy) {
         case 'merge':
           mergedContent = await this.threeWayMerge(mainBranch, featureBranch);
           break;
         case 'rebase':
           mergedContent = await this.rebase(mainBranch, featureBranch);
           break;
         case 'squash':
           mergedContent = await this.squashAndMerge(mainBranch, featureBranch);
           break;
       }
       
       // Create merge commit
       await this.createVersion(
         mainBranch.contentId,
         [{ type: 'merge', sourceBranch: featureBranchId }],
         `Merged ${featureBranch.name} into ${mainBranch.name}`
       );
       
       return {
         success: true,
         mergedContent,
         conflicts: []
       };
     }
   }
   ```

5. **Collaboration UI**
   ```tsx
   // components/collaboration/CollaborationPanel.tsx
   const CollaborationPanel: React.FC<{ contentId: string }> = ({ contentId }) => {
     const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
     const [comments, setComments] = useState<Comment[]>([]);
     const [versions, setVersions] = useState<ContentVersion[]>([]);
     const [activeTab, setActiveTab] = useState<'share' | 'comments' | 'versions'>('share');
     
     useEffect(() => {
       // Join collaboration session
       const session = collaborationService.joinSession(contentId, userId);
       
       // Subscribe to real-time updates
       session.on('user-joined', (user) => {
         setCollaborators(prev => [...prev, user]);
       });
       
       session.on('comment-added', (comment) => {
         setComments(prev => [...prev, comment]);
       });
       
       return () => session.leave();
     }, [contentId]);
     
     return (
       <div className="collaboration-panel">
         <div className="collaboration-header">
           <h3>Collaboration</h3>
           <div className="active-collaborators">
             {collaborators.map(user => (
               <CollaboratorAvatar
                 key={user.id}
                 user={user}
                 showCursor={true}
                 color={user.color}
               />
             ))}
           </div>
         </div>
         
         <div className="collaboration-tabs">
           <button
             onClick={() => setActiveTab('share')}
             className={activeTab === 'share' ? 'active' : ''}
           >
             Share
           </button>
           <button
             onClick={() => setActiveTab('comments')}
             className={activeTab === 'comments' ? 'active' : ''}
           >
             Comments ({comments.length})
           </button>
           <button
             onClick={() => setActiveTab('versions')}
             className={activeTab === 'versions' ? 'active' : ''}
           >
             Versions ({versions.length})
           </button>
         </div>
         
         <div className="collaboration-content">
           {activeTab === 'share' && (
             <SharePanel
               contentId={contentId}
               onShare={(options) => createShare(contentId, options)}
               existingShares={shares}
             />
           )}
           
           {activeTab === 'comments' && (
             <CommentsPanel
               comments={comments}
               onAddComment={(text, selection) => addComment(contentId, text, selection)}
               onResolve={(commentId) => resolveComment(commentId)}
               onReply={(parentId, text) => addReply(parentId, text)}
             />
           )}
           
           {activeTab === 'versions' && (
             <VersionsPanel
               versions={versions}
               currentVersion={currentVersion}
               onCompare={(v1, v2) => compareVersions(v1, v2)}
               onRevert={(versionId) => revertToVersion(versionId)}
               onTag={(versionId, tag) => tagVersion(versionId, tag)}
             />
           )}
         </div>
       </div>
     );
   };
   
   // Real-time editor with collaboration
   const CollaborativeEditor: React.FC<{ contentId: string }> = ({ contentId }) => {
     const [content, setContent] = useState('');
     const [cursors, setCursors] = useState<Map<string, CursorPosition>>(new Map());
     const [selections, setSelections] = useState<Map<string, SelectionRange>>(new Map());
     const editorRef = useRef<EditorInstance>();
     
     useEffect(() => {
       const session = collaborationService.joinSession(contentId);
       
       // Bind Yjs document to editor
       const yText = session.document.getText('content');
       const binding = new EditorBinding(yText, editorRef.current);
       
       // Track remote cursors
       session.provider.awareness.on('change', () => {
         const states = session.provider.awareness.getStates();
         const newCursors = new Map();
         const newSelections = new Map();
         
         states.forEach((state, clientId) => {
           if (state.cursor) {
             newCursors.set(clientId, state.cursor);
           }
           if (state.selection) {
             newSelections.set(clientId, state.selection);
           }
         });
         
         setCursors(newCursors);
         setSelections(newSelections);
       });
       
       return () => binding.destroy();
     }, [contentId]);
     
     return (
       <div className="collaborative-editor">
         <Editor
           ref={editorRef}
           value={content}
           onChange={setContent}
           onSelectionChange={(selection) => {
             // Broadcast local cursor/selection
             session.provider.awareness.setLocalStateField('cursor', selection.cursor);
             session.provider.awareness.setLocalStateField('selection', selection.range);
           }}
         />
         
         {/* Render remote cursors */}
         {Array.from(cursors.entries()).map(([userId, position]) => (
           <RemoteCursor
             key={userId}
             position={position}
             user={collaborators.get(userId)}
           />
         ))}
         
         {/* Render remote selections */}
         {Array.from(selections.entries()).map(([userId, range]) => (
           <RemoteSelection
             key={userId}
             range={range}
             color={collaborators.get(userId)?.color}
           />
         ))}
       </div>
     );
   };
   ```

## Files to Create

- `lib/sharing/content-sharing.ts` - Content sharing logic
- `lib/collaboration/realtime-collaboration.ts` - Real-time collaboration
- `lib/collaboration/comments.ts` - Comments system
- `lib/collaboration/version-control.ts` - Version control
- `lib/collaboration/approval-workflow.ts` - Approval workflows
- `components/collaboration/CollaborationPanel.tsx` - Collaboration UI
- `components/collaboration/CollaborativeEditor.tsx` - Real-time editor
- `components/collaboration/ShareDialog.tsx` - Share dialog
- `components/collaboration/CommentThread.tsx` - Comment threads
- `pages/content/[id]/collaborate.tsx` - Collaboration page

## Collaboration Features

- **Sharing**: Public links, password protection, expiration dates
- **Real-time**: Live cursors, simultaneous editing, presence awareness
- **Comments**: Threaded discussions, mentions, reactions
- **Versions**: Full history, compare, revert, branches
- **Workflows**: Review, approval, publishing
- **Permissions**: Granular access control

## Acceptance Criteria

- [ ] Content sharing with links
- [ ] Real-time collaboration working
- [ ] Comments and annotations
- [ ] Version history tracking
- [ ] Approval workflows
- [ ] Permission management
- [ ] Activity tracking
- [ ] Email notifications

## Testing Requirements

- [ ] Test share link generation
- [ ] Test real-time sync
- [ ] Test conflict resolution
- [ ] Test comment threading
- [ ] Test version comparison
- [ ] Test approval flow
- [ ] Test permissions
- [ ] Load test collaboration

## Definition of Done

- [ ] Code complete and committed
- [ ] Sharing functional
- [ ] Real-time collaboration working
- [ ] Comments system active
- [ ] Version control implemented
- [ ] UI components complete
- [ ] Tests written and passing
- [ ] Documentation updated