# Story 7.1: Advanced User Management

## User Story
As an administrator,
I want comprehensive user management capabilities,
So that I can effectively manage team access, permissions, and collaboration.

## Size & Priority
- **Size**: M (6 hours)
- **Priority**: P1 - High
- **Sprint**: 7
- **Dependencies**: Task 1.3 (Auth system)

## Description
Implement advanced user management features including role-based access control (RBAC), team management, permission granularity, audit trails, and user activity monitoring.

## Implementation Steps

1. **Role-based access control (RBAC)**
   ```typescript
   // lib/auth/rbac.ts
   interface Role {
     id: string;
     name: string;
     description: string;
     permissions: Permission[];
     isCustom: boolean;
     createdAt: Date;
   }
   
   interface Permission {
     id: string;
     resource: string;
     action: string;
     conditions?: PermissionCondition[];
   }
   
   interface PermissionCondition {
     field: string;
     operator: 'eq' | 'ne' | 'gt' | 'lt' | 'in' | 'contains';
     value: any;
   }
   
   class RBACManager {
     private roles = new Map<string, Role>();
     private userRoles = new Map<string, Set<string>>();
     
     constructor() {
       this.initializeDefaultRoles();
     }
     
     private initializeDefaultRoles() {
       const defaultRoles: Role[] = [
         {
           id: 'super-admin',
           name: 'Super Administrator',
           description: 'Full system access',
           permissions: [{ id: '*', resource: '*', action: '*' }],
           isCustom: false,
           createdAt: new Date()
         },
         {
           id: 'admin',
           name: 'Administrator',
           description: 'Administrative access',
           permissions: [
             { resource: 'users', action: '*' },
             { resource: 'content', action: '*' },
             { resource: 'settings', action: '*' },
             { resource: 'analytics', action: 'read' }
           ],
           isCustom: false,
           createdAt: new Date()
         },
         {
           id: 'content-manager',
           name: 'Content Manager',
           description: 'Content management access',
           permissions: [
             { resource: 'content', action: '*' },
             { resource: 'templates', action: '*' },
             { resource: 'generation', action: '*' },
             { resource: 'analytics', action: 'read' }
           ],
           isCustom: false,
           createdAt: new Date()
         },
         {
           id: 'editor',
           name: 'Editor',
           description: 'Content editing access',
           permissions: [
             { resource: 'content', action: 'read' },
             { resource: 'content', action: 'update' },
             { resource: 'generation', action: 'create' },
             { 
               resource: 'content',
               action: 'delete',
               conditions: [{ field: 'createdBy', operator: 'eq', value: '{{userId}}' }]
             }
           ],
           isCustom: false,
           createdAt: new Date()
         },
         {
           id: 'viewer',
           name: 'Viewer',
           description: 'Read-only access',
           permissions: [
             { resource: 'content', action: 'read' },
             { resource: 'analytics', action: 'read' }
           ],
           isCustom: false,
           createdAt: new Date()
         }
       ];
       
       defaultRoles.forEach(role => {
         this.roles.set(role.id, role);
       });
     }
     
     async checkPermission(
       userId: string,
       resource: string,
       action: string,
       context?: any
     ): Promise<boolean> {
       const userRoleIds = this.userRoles.get(userId);
       if (!userRoleIds) return false;
       
       for (const roleId of userRoleIds) {
         const role = this.roles.get(roleId);
         if (!role) continue;
         
         for (const permission of role.permissions) {
           if (this.matchPermission(permission, resource, action, context)) {
             return true;
           }
         }
       }
       
       return false;
     }
     
     private matchPermission(
       permission: Permission,
       resource: string,
       action: string,
       context?: any
     ): boolean {
       // Check wildcards
       if (permission.resource === '*' || permission.resource === resource) {
         if (permission.action === '*' || permission.action === action) {
           // Check conditions if any
           if (permission.conditions) {
             return this.evaluateConditions(permission.conditions, context);
           }
           return true;
         }
       }
       return false;
     }
     
     private evaluateConditions(
       conditions: PermissionCondition[],
       context: any
     ): boolean {
       if (!context) return false;
       
       return conditions.every(condition => {
         const value = this.getNestedValue(context, condition.field);
         
         switch (condition.operator) {
           case 'eq':
             return value === this.resolveValue(condition.value, context);
           case 'ne':
             return value !== this.resolveValue(condition.value, context);
           case 'gt':
             return value > condition.value;
           case 'lt':
             return value < condition.value;
           case 'in':
             return condition.value.includes(value);
           case 'contains':
             return value?.includes?.(condition.value);
           default:
             return false;
         }
       });
     }
     
     async createCustomRole(roleData: Partial<Role>): Promise<Role> {
       const role: Role = {
         id: generateId(),
         name: roleData.name!,
         description: roleData.description || '',
         permissions: roleData.permissions || [],
         isCustom: true,
         createdAt: new Date()
       };
       
       // Validate permissions
       this.validatePermissions(role.permissions);
       
       // Store in database
       await this.saveRole(role);
       
       this.roles.set(role.id, role);
       return role;
     }
     
     async assignRole(userId: string, roleId: string) {
       if (!this.roles.has(roleId)) {
         throw new Error(`Role ${roleId} not found`);
       }
       
       if (!this.userRoles.has(userId)) {
         this.userRoles.set(userId, new Set());
       }
       
       this.userRoles.get(userId)!.add(roleId);
       
       // Store in database
       await this.saveUserRole(userId, roleId);
       
       // Audit log
       await this.auditLog({
         action: 'role.assigned',
         userId,
         roleId,
         timestamp: new Date()
       });
     }
   }
   ```

2. **Team management system**
   ```typescript
   // lib/teams/team-manager.ts
   interface Team {
     id: string;
     name: string;
     description: string;
     ownerId: string;
     members: TeamMember[];
     settings: TeamSettings;
     limits: TeamLimits;
     createdAt: Date;
   }
   
   interface TeamMember {
     userId: string;
     role: 'owner' | 'admin' | 'member';
     joinedAt: Date;
     permissions: string[];
   }
   
   class TeamManager {
     private teams = new Map<string, Team>();
     private userTeams = new Map<string, Set<string>>();
     
     async createTeam(data: CreateTeamData, ownerId: string): Promise<Team> {
       const team: Team = {
         id: generateId(),
         name: data.name,
         description: data.description || '',
         ownerId,
         members: [{
           userId: ownerId,
           role: 'owner',
           joinedAt: new Date(),
           permissions: ['*']
         }],
         settings: {
           allowInvites: true,
           requireApproval: false,
           visibility: 'private'
         },
         limits: {
           maxMembers: 50,
           maxStorage: 10 * 1024 * 1024 * 1024, // 10GB
           maxGenerations: 10000
         },
         createdAt: new Date()
       };
       
       await this.saveTeam(team);
       this.teams.set(team.id, team);
       
       // Update user teams
       if (!this.userTeams.has(ownerId)) {
         this.userTeams.set(ownerId, new Set());
       }
       this.userTeams.get(ownerId)!.add(team.id);
       
       return team;
     }
     
     async inviteMembers(
       teamId: string,
       inviterId: string,
       emails: string[]
     ): Promise<TeamInvitation[]> {
       const team = await this.getTeam(teamId);
       
       // Check permissions
       if (!this.canInviteMembers(team, inviterId)) {
         throw new Error('Insufficient permissions to invite members');
       }
       
       // Check limits
       if (team.members.length + emails.length > team.limits.maxMembers) {
         throw new Error(`Team member limit (${team.limits.maxMembers}) would be exceeded`);
       }
       
       const invitations = await Promise.all(
         emails.map(email => this.createInvitation(team, inviterId, email))
       );
       
       // Send invitation emails
       await this.sendInvitationEmails(invitations);
       
       return invitations;
     }
     
     async updateMemberRole(
       teamId: string,
       memberId: string,
       newRole: TeamMember['role'],
       updatedBy: string
     ) {
       const team = await this.getTeam(teamId);
       
       // Check permissions
       if (!this.canManageMembers(team, updatedBy)) {
         throw new Error('Insufficient permissions to manage members');
       }
       
       // Cannot change owner role
       if (memberId === team.ownerId && newRole !== 'owner') {
         throw new Error('Cannot change owner role');
       }
       
       // Update member role
       const member = team.members.find(m => m.userId === memberId);
       if (!member) {
         throw new Error('Member not found');
       }
       
       member.role = newRole;
       member.permissions = this.getRolePermissions(newRole);
       
       await this.saveTeam(team);
       
       // Audit log
       await this.auditLog({
         action: 'team.member.role_updated',
         teamId,
         memberId,
         newRole,
         updatedBy,
         timestamp: new Date()
       });
     }
     
     async getTeamAnalytics(teamId: string): Promise<TeamAnalytics> {
       const team = await this.getTeam(teamId);
       
       const [
         contentStats,
         generationStats,
         memberActivity,
         storageUsage
       ] = await Promise.all([
         this.getContentStats(teamId),
         this.getGenerationStats(teamId),
         this.getMemberActivity(teamId),
         this.getStorageUsage(teamId)
       ]);
       
       return {
         team,
         contentStats,
         generationStats,
         memberActivity,
         storageUsage,
         limitsUsage: {
           members: (team.members.length / team.limits.maxMembers) * 100,
           storage: (storageUsage.used / team.limits.maxStorage) * 100,
           generations: (generationStats.total / team.limits.maxGenerations) * 100
         }
       };
     }
   }
   ```

3. **User activity monitoring**
   ```typescript
   // lib/monitoring/user-activity.ts
   class UserActivityMonitor {
     private activities: UserActivity[] = [];
     private sessions = new Map<string, SessionData>();
     
     async trackActivity(activity: UserActivity) {
       // Add to buffer
       this.activities.push({
         ...activity,
         timestamp: new Date()
       });
       
       // Update session
       this.updateSession(activity.userId, activity);
       
       // Check for suspicious activity
       await this.detectSuspiciousActivity(activity);
       
       // Store in database (batch)
       if (this.activities.length >= 100) {
         await this.flushActivities();
       }
     }
     
     private updateSession(userId: string, activity: UserActivity) {
       if (!this.sessions.has(userId)) {
         this.sessions.set(userId, {
           userId,
           startTime: new Date(),
           lastActivity: new Date(),
           activities: [],
           ipAddress: activity.ipAddress,
           userAgent: activity.userAgent
         });
       }
       
       const session = this.sessions.get(userId)!;
       session.lastActivity = new Date();
       session.activities.push(activity);
       
       // Check for session anomalies
       if (session.ipAddress !== activity.ipAddress) {
         this.flagSessionAnomaly({
           type: 'ip_change',
           userId,
           oldValue: session.ipAddress,
           newValue: activity.ipAddress
         });
       }
     }
     
     private async detectSuspiciousActivity(activity: UserActivity) {
       const patterns = [
         this.checkRapidDataAccess,
         this.checkUnusualAccessPattern,
         this.checkPrivilegeEscalation,
         this.checkDataExfiltration
       ];
       
       for (const pattern of patterns) {
         const suspicious = await pattern.call(this, activity);
         if (suspicious) {
           await this.alertSuspiciousActivity(suspicious);
         }
       }
     }
     
     private async checkRapidDataAccess(activity: UserActivity): Promise<SuspiciousActivity | null> {
       const recentActivities = this.activities.filter(a => 
         a.userId === activity.userId &&
         a.timestamp > new Date(Date.now() - 60000) // Last minute
       );
       
       const dataAccessCount = recentActivities.filter(a => 
         a.action === 'data.read' || a.action === 'data.export'
       ).length;
       
       if (dataAccessCount > 100) {
         return {
           type: 'rapid_data_access',
           userId: activity.userId,
           count: dataAccessCount,
           severity: 'high'
         };
       }
       
       return null;
     }
     
     async getUserActivityReport(
       userId: string,
       timeRange: TimeRange
     ): Promise<UserActivityReport> {
       const activities = await this.getActivities(userId, timeRange);
       
       return {
         userId,
         timeRange,
         summary: {
           totalActions: activities.length,
           uniqueSessions: this.countUniqueSessions(activities),
           mostActiveHour: this.findMostActiveHour(activities),
           topActions: this.getTopActions(activities),
           averageSessionDuration: this.calculateAvgSessionDuration(activities)
         },
         timeline: this.createActivityTimeline(activities),
         heatmap: this.createActivityHeatmap(activities),
         devices: this.extractDeviceInfo(activities),
         locations: this.extractLocationInfo(activities)
       };
     }
   }
   ```

4. **User management UI**
   ```tsx
   // components/admin/UserManagement.tsx
   const UserManagement: React.FC = () => {
     const [users, setUsers] = useState<User[]>([]);
     const [selectedUser, setSelectedUser] = useState<User | null>(null);
     const [filters, setFilters] = useState<UserFilters>({});
     const [bulkActions, setBulkActions] = useState<string[]>([]);
     
     return (
       <div className="user-management">
         <UserFilters
           filters={filters}
           onChange={setFilters}
           onSearch={(query) => searchUsers(query)}
         />
         
         <div className="user-actions">
           <button onClick={() => setShowInviteModal(true)}>
             Invite Users
           </button>
           <BulkActions
             selectedUsers={selectedUsers}
             actions={[
               { id: 'activate', label: 'Activate' },
               { id: 'deactivate', label: 'Deactivate' },
               { id: 'assign-role', label: 'Assign Role' },
               { id: 'add-to-team', label: 'Add to Team' },
               { id: 'export', label: 'Export' }
             ]}
             onExecute={(action) => executeBulkAction(action)}
           />
         </div>
         
         <UserTable
           users={filteredUsers}
           columns={[
             { key: 'name', label: 'Name', sortable: true },
             { key: 'email', label: 'Email', sortable: true },
             { key: 'role', label: 'Role', sortable: true },
             { key: 'team', label: 'Team' },
             { key: 'status', label: 'Status', sortable: true },
             { key: 'lastActive', label: 'Last Active', sortable: true },
             { key: 'created', label: 'Created', sortable: true }
           ]}
           onSelectUser={(user) => setSelectedUser(user)}
           onSelectMultiple={(users) => setSelectedUsers(users)}
         />
         
         {selectedUser && (
           <UserDetailPanel
             user={selectedUser}
             onClose={() => setSelectedUser(null)}
             onUpdate={(updates) => updateUser(selectedUser.id, updates)}
             tabs={[
               { id: 'profile', label: 'Profile', component: UserProfile },
               { id: 'permissions', label: 'Permissions', component: UserPermissions },
               { id: 'activity', label: 'Activity', component: UserActivity },
               { id: 'sessions', label: 'Sessions', component: UserSessions },
               { id: 'audit', label: 'Audit Log', component: UserAuditLog }
             ]}
           />
         )}
         
         <InviteUsersModal
           isOpen={showInviteModal}
           onClose={() => setShowInviteModal(false)}
           onInvite={(emails, role, team) => inviteUsers(emails, role, team)}
         />
       </div>
     );
   };
   ```

5. **Audit logging system**
   ```typescript
   // lib/audit/audit-logger.ts
   class AuditLogger {
     private buffer: AuditEvent[] = [];
     private flushInterval: NodeJS.Timer;
     
     constructor() {
       this.startPeriodicFlush();
     }
     
     async log(event: AuditEventData) {
       const auditEvent: AuditEvent = {
         id: generateId(),
         timestamp: new Date(),
         userId: event.userId,
         action: event.action,
         resource: event.resource,
         resourceId: event.resourceId,
         changes: event.changes,
         ipAddress: event.ipAddress,
         userAgent: event.userAgent,
         result: event.result,
         metadata: event.metadata
       };
       
       this.buffer.push(auditEvent);
       
       // Immediate flush for critical events
       if (this.isCriticalEvent(event.action)) {
         await this.flush();
       }
     }
     
     private isCriticalEvent(action: string): boolean {
       const criticalActions = [
         'user.deleted',
         'permission.granted',
         'permission.revoked',
         'data.exported',
         'settings.security_changed'
       ];
       
       return criticalActions.includes(action);
     }
     
     async getAuditTrail(filters: AuditFilters): Promise<AuditEvent[]> {
       const query = this.buildAuditQuery(filters);
       const { data } = await supabase
         .from('audit_logs')
         .select('*')
         .match(query)
         .order('timestamp', { ascending: false })
         .limit(filters.limit || 100);
       
       return data || [];
     }
     
     async generateComplianceReport(
       timeRange: TimeRange
     ): Promise<ComplianceReport> {
       const events = await this.getAuditTrail({
         startTime: timeRange.start,
         endTime: timeRange.end
       });
       
       return {
         period: timeRange,
         summary: {
           totalEvents: events.length,
           uniqueUsers: new Set(events.map(e => e.userId)).size,
           criticalEvents: events.filter(e => e.severity === 'critical').length
         },
         userAccess: this.analyzeUserAccess(events),
         dataAccess: this.analyzeDataAccess(events),
         permissions: this.analyzePermissionChanges(events),
         security: this.analyzeSecurityEvents(events),
         compliance: {
           gdpr: this.checkGDPRCompliance(events),
           hipaa: this.checkHIPAACompliance(events),
           soc2: this.checkSOC2Compliance(events)
         }
       };
     }
   }
   ```

## Files to Create

- `lib/auth/rbac.ts` - Role-based access control
- `lib/teams/team-manager.ts` - Team management
- `lib/monitoring/user-activity.ts` - Activity monitoring
- `lib/audit/audit-logger.ts` - Audit logging
- `components/admin/UserManagement.tsx` - User management UI
- `components/admin/TeamManagement.tsx` - Team management UI
- `components/admin/RoleManager.tsx` - Role management UI
- `components/admin/AuditViewer.tsx` - Audit log viewer
- `pages/admin/users.tsx` - User management page

## Acceptance Criteria

- [ ] RBAC system functional
- [ ] Custom roles can be created
- [ ] Team management working
- [ ] User activity tracked
- [ ] Audit logging comprehensive
- [ ] Bulk user operations
- [ ] Session management
- [ ] Permission inheritance

## Security Requirements

- [ ] Principle of least privilege
- [ ] Audit all permission changes
- [ ] Session validation
- [ ] IP-based restrictions
- [ ] Two-factor authentication
- [ ] Password policies enforced
- [ ] Account lockout policies

## Testing Requirements

- [ ] Test permission checks
- [ ] Test role inheritance
- [ ] Test team operations
- [ ] Test audit logging
- [ ] Test bulk operations
- [ ] Test activity monitoring
- [ ] Test compliance reports
- [ ] Test session management

## Definition of Done

- [ ] Code complete and committed
- [ ] RBAC implemented
- [ ] Team features working
- [ ] Activity monitoring active
- [ ] Audit logging functional
- [ ] UI components complete
- [ ] Tests written and passing
- [ ] Documentation updated