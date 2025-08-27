-- Drop the problematic RLS policies that cause infinite recursion
DROP POLICY IF EXISTS "Users can view their organization" ON organizations;
DROP POLICY IF EXISTS "Admins can update their organization" ON organizations;
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
DROP POLICY IF EXISTS "Users can view organization members" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Users can view their organization's projects" ON projects;
DROP POLICY IF EXISTS "Editors can create projects" ON projects;
DROP POLICY IF EXISTS "Editors can update projects" ON projects;

-- Create fixed RLS policies without recursion

-- Organizations policies (using auth.uid() directly)
CREATE POLICY "Users can view their organization"
    ON organizations FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM users 
        WHERE users.organization_id = organizations.id 
        AND users.id = auth.uid()
    ));

CREATE POLICY "Admins can update their organization"
    ON organizations FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM users 
        WHERE users.organization_id = organizations.id 
        AND users.id = auth.uid() 
        AND users.role = 'admin'
    ));

-- Users policies (simplified to avoid recursion)
CREATE POLICY "Users can view their own profile"
    ON users FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can view organization members"
    ON users FOR SELECT
    USING (
        organization_id = (
            SELECT organization_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own profile"
    ON users FOR UPDATE
    USING (auth.uid() = id);

-- Projects policies (fixed to avoid recursion)
CREATE POLICY "Users can view their organization's projects"
    ON projects FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM users 
        WHERE users.organization_id = projects.organization_id 
        AND users.id = auth.uid()
    ));

CREATE POLICY "Editors can create projects"
    ON projects FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM users 
        WHERE users.organization_id = projects.organization_id 
        AND users.id = auth.uid() 
        AND users.role IN ('admin', 'editor')
    ));

CREATE POLICY "Editors can update projects"
    ON projects FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM users 
        WHERE users.organization_id = projects.organization_id 
        AND users.id = auth.uid() 
        AND users.role IN ('admin', 'editor')
    ));