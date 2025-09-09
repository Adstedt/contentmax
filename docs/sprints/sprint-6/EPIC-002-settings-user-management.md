# Settings & Multi-User Management - Brownfield Enhancement

## Epic Goal

Implement a comprehensive settings panel with user profile management, data source configuration, and multi-user workspace support to provide enterprise-grade account management capabilities while maintaining the existing dark theme design system.

## Epic Description

### Existing System Context

**Current relevant functionality:**

- Authentication system via Supabase Auth (email/password + OAuth)
- Dark theme design system (#0a0a0a, #1a1a1a, #2a2a2a palette)
- Component library using Shadcn/UI with customized dark theme
- Sidebar navigation structure in place
- Project/workspace concept already exists for data organization

**Technology stack:**

- Next.js 15 with App Router
- TypeScript with strict mode
- Supabase for auth and database
- Tailwind CSS with dark theme
- Shadcn/UI components

**Integration points:**

- Existing sidebar navigation component needs Settings link
- Supabase auth system for user management
- Existing project/workspace database structure
- Current dark theme design tokens and patterns

### Enhancement Details

**What's being added/changed:**

1. Settings page accessible from sidebar navigation
2. User profile management (view/edit details, password reset)
3. Data source management dashboard (view/disconnect sources)
4. Multi-user workspace support with role-based access
5. User invitation and management system

**How it integrates:**

- New route `/dashboard/settings` following existing routing patterns
- Extends existing Supabase auth with team/workspace concepts
- Reuses existing UI components (buttons, modals, forms) with dark theme
- Follows established component structure and coding standards

**Success criteria:**

- Settings accessible via sidebar with smooth navigation
- Users can manage profile, password, and data sources
- Multiple users can collaborate in same workspace
- Consistent dark theme styling matching import wizard quality
- All existing functionality remains intact

## Stories

### Story 1: Settings Page Infrastructure & Navigation

**Description:** Create the settings page structure with tabbed navigation, integrate into sidebar, and establish the base layout following the dark theme design system used in ImportWizardV2.

**Key tasks:**

- Add Settings link to sidebar navigation with appropriate icon
- Create `/dashboard/settings` route with page structure
- Implement tabbed navigation (Profile, Data Sources, Team, Billing)
- Apply dark theme styling consistent with import wizard
- Create responsive layout for mobile/desktop

### Story 2: User Profile & Data Source Management

**Description:** Implement user profile management features including view/edit profile details, password reset, and data source connection management with visual indicators.

**Key tasks:**

- Create profile form with edit capabilities
- Implement password reset flow using Supabase
- Build data sources dashboard showing connected sources
- Add disconnect/reconnect functionality for data sources
- Create activity log or audit trail display

### Story 3: Multi-User Workspace Support

**Description:** Add multi-user collaboration by implementing workspace user management, invitation system, and role-based permissions while maintaining data isolation.

**Key tasks:**

- Extend database schema for workspace users and roles
- Create user invitation flow with email notifications
- Implement team member list with role management
- Add permission checks throughout the application
- Create onboarding flow for invited users

## Compatibility Requirements

- [x] Existing APIs remain unchanged (new endpoints added only)
- [x] Database schema changes are backward compatible (additive only)
- [x] UI changes follow existing dark theme patterns
- [x] Performance impact is minimal (lazy loading for settings)
- [x] Existing authentication flow remains functional
- [x] Current single-user functionality unaffected

## Risk Mitigation

**Primary Risk:** Breaking existing authentication or data access patterns
**Mitigation:**

- Implement feature flags for gradual rollout
- Maintain backward compatibility with single-user mode
- Comprehensive testing of auth flows
- Use database transactions for user/workspace operations

**Rollback Plan:**

- Feature flags allow instant disable of multi-user features
- Database migrations are reversible
- Settings page can be hidden via sidebar configuration
- Existing single-user code paths remain intact

## Definition of Done

- [x] All three stories completed with acceptance criteria met
- [x] Existing authentication and data access verified through testing
- [x] Settings page accessible from sidebar navigation
- [x] Dark theme styling consistent with ImportWizardV2 quality
- [x] Multi-user invitation and collaboration working
- [x] Role-based permissions enforced throughout
- [x] Password reset and profile management functional
- [x] Data source management dashboard operational
- [x] Mobile responsive design implemented
- [x] Documentation updated for multi-user setup
- [x] No regression in existing features
- [x] Performance metrics remain within acceptable range

## Technical Considerations

**Database Schema Extensions (Migration Created: 20250109_multi_user_workspaces.sql):**

**New Tables:**

- `workspace_members` - Links users to workspaces with specific roles
- `workspace_invitations` - Manages team invitations with expiry
- `user_activity_logs` - Tracks all user actions for audit trail
- `data_source_connections` - Manages external data source configurations
- `workspace_settings` - Stores workspace-specific settings by category

**Enhanced User Table:**

- Added phone_number, timezone, notification_preferences
- Added last_seen_at and onboarded_at timestamps
- Enhanced role system: owner, admin, editor, viewer

**Permission Roles:**

- **Owner**: Full access, billing, user management, can delete workspace
- **Admin**: Full access, user management, cannot delete workspace
- **Editor**: Create/edit content, manage data sources, view settings
- **Viewer**: Read-only access to content and settings

**Helper Functions:**

- `user_has_permission()` - Check user permissions in workspace
- `log_user_activity()` - Automatic activity logging with last_seen updates

**Security Features:**

- Row Level Security (RLS) policies for all new tables
- Role-based access control at database level
- Secure token generation for invitations
- Activity audit trail for compliance

**UI Components to Create:**

- SettingsLayout with tab navigation
- ProfileForm with validation
- DataSourceCard with status indicators
- TeamMemberList with role badges
- InviteUserModal with email validation

## Handoff to Story Manager

**Story Manager Handoff:**

"Please develop detailed user stories for this Settings & Multi-User Management epic. Key considerations:

- This is an enhancement to ContentMax running Next.js 15, TypeScript, Supabase, Tailwind CSS
- Integration points: Sidebar navigation, Supabase Auth, existing project structure
- Existing patterns to follow: Dark theme from ImportWizardV2, Shadcn/UI components
- Critical compatibility requirements: Maintain existing auth flow, preserve single-user functionality
- Each story must include verification that existing functionality remains intact

The epic should deliver a world-class settings experience with seamless multi-user collaboration while maintaining the sophisticated dark theme aesthetic established in the import wizard."

---

## Validation Checklist

**Scope Validation:**

- ✅ Epic can be completed in 3 stories maximum
- ✅ No architectural documentation required (using existing patterns)
- ✅ Enhancement follows existing design system and patterns
- ✅ Integration complexity is manageable with Supabase

**Risk Assessment:**

- ✅ Risk to existing system is low (additive changes only)
- ✅ Rollback plan is feasible (feature flags)
- ✅ Testing approach covers existing functionality
- ✅ Team has sufficient knowledge of Supabase Auth

**Completeness Check:**

- ✅ Epic goal is clear and achievable
- ✅ Stories are properly scoped and sequenced
- ✅ Success criteria are measurable
- ✅ Dependencies identified (Supabase, existing UI components)
