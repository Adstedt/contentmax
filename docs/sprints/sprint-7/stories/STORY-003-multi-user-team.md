# STORY-003: Multi-User Team Management

**Status:** Ready for Development
**Sprint:** Sprint 7 (moved from Sprint 6.5)
**Points:** 8
**Priority:** P2
**Dependencies:** Settings Infrastructure (Sprint 6.5 STORY-001 - Complete)

## Story

**As a** team lead
**I want to** invite team members and manage their access to the ContentMax workspace
**So that** we can collaborate on taxonomy optimization as a team

## Acceptance Criteria

### Must Have
1. Send email invitations to new team members
2. Accept/decline invitation flow
3. Role-based permissions (Owner, Admin, Editor, Viewer)
4. Display team members list with roles
5. Remove team members capability (Owner/Admin only)
6. Permission enforcement across all features
7. Activity logging for audit trail

### Should Have
8. Bulk invite via CSV
9. Invitation expiry (7 days)
10. Resend invitation capability
11. Last activity tracking
12. Transfer ownership capability

### Could Have
13. Multiple workspaces per user
14. SSO integration
15. Custom role definitions

## Tasks / Subtasks

- [ ] Set up Resend account and API key (AC: 1)
  - [ ] Create Resend account
  - [ ] Configure API key in environment variables
  - [ ] Test email sending capability

- [ ] Create invitation email template (AC: 1)
  - [ ] Create `/lib/email/templates/invitation.tsx` using React Email
  - [ ] Design invitation email with workspace info
  - [ ] Include accept/decline buttons
  - [ ] Add expiry date notice

- [ ] Build invitation API endpoint (AC: 1, 2)
  - [ ] Create `/app/api/team/invite/route.ts`
  - [ ] Validate email and role
  - [ ] Generate invitation token
  - [ ] Store in workspace_invitations table
  - [ ] Send email via Resend

- [ ] Create team management UI (AC: 4, 5)
  - [ ] Create `/components/settings/TeamManagement.tsx`
  - [ ] Build invite form with email and role selection
  - [ ] Display current team members list
  - [ ] Show pending invitations
  - [ ] Add remove member functionality

- [ ] Implement permission middleware (AC: 3, 6)
  - [ ] Create `/lib/auth/permissions.ts`
  - [ ] Define role hierarchy
  - [ ] Create requirePermission wrapper
  - [ ] Apply to all protected routes

- [ ] Update all data queries for workspace filtering (AC: 6)
  - [ ] Update product queries to filter by workspace
  - [ ] Update taxonomy queries for workspace
  - [ ] Update metrics queries for workspace
  - [ ] Ensure all user data is properly isolated

- [ ] Create invitation acceptance flow (AC: 2)
  - [ ] Create `/app/invite/[token]/page.tsx`
  - [ ] Validate invitation token
  - [ ] Show workspace details
  - [ ] Handle accept/decline actions
  - [ ] Create user account if needed

- [ ] Add role badges to UI (AC: 4)
  - [ ] Create `/components/ui/RoleBadge.tsx`
  - [ ] Display role in navigation
  - [ ] Show role in team list
  - [ ] Add tooltips explaining permissions

- [ ] Implement activity logging (AC: 7)
  - [ ] Create activity_logs table migration
  - [ ] Log invitation events
  - [ ] Log role changes
  - [ ] Log member removals
  - [ ] Create activity feed component

- [ ] Update RLS policies for multi-tenant (AC: 6)
  - [ ] Create `/supabase/migrations/[timestamp]_update_rls_workspace.sql`
  - [ ] Update products table policies
  - [ ] Update taxonomy_nodes policies
  - [ ] Update all metrics tables policies
  - [ ] Test data isolation between workspaces

- [ ] Add team member management features (AC: 5, 10)
  - [ ] Create `/app/api/team/members/[id]/route.ts`
  - [ ] Implement remove member
  - [ ] Implement change role
  - [ ] Add resend invitation

- [ ] Implement bulk invite via CSV (AC: 8)
  - [ ] Add CSV upload to invite form
  - [ ] Parse and validate emails
  - [ ] Send batch invitations
  - [ ] Show progress and results

- [ ] Add transfer ownership capability (AC: 12)
  - [ ] Create transfer ownership modal
  - [ ] Require confirmation
  - [ ] Update workspace owner
  - [ ] Notify all team members

- [ ] Write comprehensive tests
  - [ ] Unit tests for permissions in `/tests/unit/auth/`
  - [ ] Integration tests for invitation flow
  - [ ] E2E test for team management
  - [ ] Test RLS policies with multiple users

## Dev Notes

### Project Structure Context
Based on `/docs/architecture/source-tree.md`:
```
contentmax/
├── app/
│   ├── api/
│   │   └── team/
│   │       ├── invite/
│   │       │   └── route.ts        # Send invitations
│   │       └── members/
│   │           └── [id]/
│   │               └── route.ts    # Member management
│   ├── invite/
│   │   └── [token]/
│   │       └── page.tsx            # Accept invitation
│   └── dashboard/
│       └── settings/
│           └── team/
│               └── page.tsx        # Team management
├── components/
│   ├── settings/
│   │   └── TeamManagement.tsx     # Team UI
│   └── ui/
│       └── RoleBadge.tsx           # Role display
├── lib/
│   ├── auth/
│   │   └── permissions.ts         # Permission checks
│   ├── email/
│   │   └── templates/
│   │       └── invitation.tsx      # Email template
│   └── services/
│       └── invitation-service.ts  # Invitation logic
├── supabase/
│   └── migrations/                # RLS updates
└── tests/
    ├── unit/
    │   └── auth/                  # Permission tests
    └── e2e/
        └── team-management.spec.ts
```

### Database Schema (Already migrated)

```sql
-- Already exists from Sprint 6.5 migrations
CREATE TABLE workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id),
  user_id UUID REFERENCES auth.users(id),
  role TEXT CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
  invited_by UUID REFERENCES auth.users(id),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_active TIMESTAMPTZ,
  UNIQUE(workspace_id, user_id)
);

CREATE TABLE workspace_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id),
  email TEXT NOT NULL,
  role TEXT CHECK (role IN ('admin', 'editor', 'viewer')),
  token UUID DEFAULT gen_random_uuid(),
  invited_by UUID REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Permission Matrix

| Feature | Owner | Admin | Editor | Viewer |
|---------|-------|-------|--------|--------|
| View Taxonomy | ✅ | ✅ | ✅ | ✅ |
| Import Data | ✅ | ✅ | ✅ | ❌ |
| Edit Categories | ✅ | ✅ | ✅ | ❌ |
| Clear Data | ✅ | ✅ | ❌ | ❌ |
| View Settings | ✅ | ✅ | ✅ | ✅ |
| Manage Team | ✅ | ✅ | ❌ | ❌ |
| Delete Workspace | ✅ | ❌ | ❌ | ❌ |

### Implementation Approach

1. **Invitation Service**
```typescript
// lib/services/invitation-service.ts
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendInvitation(
  email: string,
  workspaceName: string,
  inviterName: string,
  role: string,
  inviteToken: string
) {
  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${inviteToken}`;

  await resend.emails.send({
    from: 'ContentMax <noreply@contentmax.io>',
    to: email,
    subject: `You've been invited to join ${workspaceName} on ContentMax`,
    html: InviteEmailTemplate({
      workspaceName,
      inviterName,
      role,
      inviteUrl
    })
  });
}
```

2. **Permission Middleware**
```typescript
// lib/auth/permissions.ts
export function requirePermission(
  requiredRole: 'owner' | 'admin' | 'editor' | 'viewer'
) {
  return async (req: Request) => {
    const user = await getCurrentUser();
    const member = await getWorkspaceMember(user.id);

    const roleHierarchy = {
      owner: 4,
      admin: 3,
      editor: 2,
      viewer: 1
    };

    if (roleHierarchy[member.role] < roleHierarchy[requiredRole]) {
      throw new Error('Insufficient permissions');
    }
  };
}
```

3. **Team Management UI**
```tsx
// components/settings/TeamManagement.tsx
export function TeamManagement() {
  const { members, invitations } = useTeamData();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');

  return (
    <div className="space-y-6">
      {/* Invite Form */}
      <Card>
        <CardHeader>
          <CardTitle>Invite Team Members</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="email@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
            <Select value={inviteRole} onValueChange={setInviteRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="viewer">Viewer</SelectItem>
                <SelectItem value="editor">Editor</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={sendInvite}>Send Invite</Button>
          </div>
        </CardContent>
      </Card>

      {/* Team Members List */}
      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
        </CardHeader>
        <CardContent>
          <TeamMembersList members={members} />
        </CardContent>
      </Card>

      {/* Pending Invitations */}
      <Card>
        <CardHeader>
          <CardTitle>Pending Invitations</CardTitle>
        </CardHeader>
        <CardContent>
          <InvitationsList invitations={invitations} />
        </CardContent>
      </Card>
    </div>
  );
}
```

4. **Row Level Security Updates**
```sql
-- Update existing policies to check workspace membership
CREATE POLICY "Users can view data in their workspace"
  ON products
  FOR SELECT
  USING (
    user_id IN (
      SELECT user_id FROM workspace_members
      WHERE workspace_id = (
        SELECT workspace_id FROM workspace_members
        WHERE user_id = auth.uid()
      )
    )
  );
```

### Email Templates

Using Resend with React Email for beautiful templates:
- Invitation email
- Welcome email (after accepting)
- Role change notification
- Removal notification

### Configuration Requirements
- Resend API key for email sending
- Workspace tables already migrated
- Auth system configured (Supabase Auth)
- Environment variable: `RESEND_API_KEY`

### Security Considerations
- All workspace data must be isolated via RLS
- Invitation tokens should be single-use
- Permission checks on all mutations
- Activity logging for audit trail
- Email verification required

### Error Handling Strategy
- Email failures: Queue for retry
- Invalid tokens: Show clear error message
- Permission denied: Redirect to appropriate page
- Workspace not found: Handle gracefully

## Testing

### Testing Standards (from `/docs/architecture/coding-standards.md`)
- Test framework: Vitest for unit tests, Playwright for E2E
- Test coverage: Minimum 80% for new code
- Mock Resend API for unit tests
- Use test workspaces for integration tests

### Test Scenarios
1. **Invitation Flow Tests**
   - Send invitation successfully
   - Email delivery confirmed
   - Token validation works
   - Acceptance creates membership
   - Decline updates status

2. **Permission Tests**
   - Each role has correct access
   - Permission denied handled
   - Role changes apply immediately
   - Owner cannot be removed

3. **Multi-Tenant Tests**
   - Data isolation between workspaces
   - Users can't access other workspaces
   - Switching workspaces works
   - RLS policies enforced

4. **Edge Cases**
   - Expired invitations rejected
   - Duplicate invitations handled
   - Role downgrades work
   - Last owner protection

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2025-01-16 | 1.0 | Initial story creation | Sarah (PO) |
| 2025-01-16 | 1.1 | Moved to Sprint 7 | Sarah (PO) |
| 2025-01-16 | 1.2 | Updated to Ready for Development status | Sarah (PO) |

## Dev Agent Record

**Agent Model Used:** claude-3-5-sonnet-20241022

**Debug Log References:**
- [ ] Email sending working
- [ ] Permissions enforced correctly
- [ ] RLS policies updated
- [ ] Multi-user data isolation verified

**Completion Notes:**
-

**File List:**
-

**QA Results**
-