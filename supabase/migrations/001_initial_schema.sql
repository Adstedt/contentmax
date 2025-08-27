-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create organizations table
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Create users table (extends Supabase auth.users)
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    role TEXT CHECK (role IN ('admin', 'editor', 'viewer')) DEFAULT 'viewer',
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Create projects table
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    domain TEXT NOT NULL,
    description TEXT,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Create taxonomy_nodes table
CREATE TABLE taxonomy_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES taxonomy_nodes(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    path TEXT NOT NULL, -- Full path for easier queries
    title TEXT,
    meta_title TEXT,
    meta_description TEXT,
    content_status TEXT CHECK (content_status IN ('optimized', 'outdated', 'missing', 'none')) DEFAULT 'none',
    sku_count INTEGER DEFAULT 0,
    depth INTEGER DEFAULT 0,
    position INTEGER DEFAULT 0, -- For ordering siblings
    metadata JSONB DEFAULT '{}',
    scraped_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Create content_items table
CREATE TABLE content_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    taxonomy_node_id UUID REFERENCES taxonomy_nodes(id) ON DELETE CASCADE,
    type TEXT CHECK (type IN ('brand', 'category', 'inspire', 'engage', 'custom')) NOT NULL,
    language TEXT DEFAULT 'en',
    status TEXT CHECK (status IN ('draft', 'review', 'approved', 'published', 'archived')) DEFAULT 'draft',
    title TEXT NOT NULL,
    content JSONB NOT NULL, -- Stores structured content
    version INTEGER DEFAULT 1,
    generated_by TEXT, -- AI model used
    generated_at TIMESTAMP WITH TIME ZONE,
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    published_by UUID REFERENCES users(id),
    published_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Create templates table
CREATE TABLE templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT CHECK (type IN ('brand', 'category', 'inspire', 'engage', 'custom')) NOT NULL,
    description TEXT,
    template_content TEXT NOT NULL, -- Handlebars template
    variables JSONB DEFAULT '[]', -- List of required variables
    is_default BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Create generation_queue table
CREATE TABLE generation_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status TEXT CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')) DEFAULT 'pending',
    priority INTEGER DEFAULT 0, -- Higher number = higher priority
    batch_id UUID, -- For grouping related generations
    config JSONB NOT NULL, -- Generation configuration
    result JSONB, -- Generation results
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Create scraped_content table
CREATE TABLE scraped_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    content_type TEXT, -- MIME type
    raw_html TEXT,
    extracted_text TEXT,
    extracted_data JSONB, -- Structured data extraction
    status TEXT CHECK (status IN ('pending', 'success', 'failed')) DEFAULT 'pending',
    error_message TEXT,
    scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create audit_logs table
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_users_organization ON users(organization_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_projects_organization ON projects(organization_id);
CREATE INDEX idx_taxonomy_nodes_project ON taxonomy_nodes(project_id);
CREATE INDEX idx_taxonomy_nodes_parent ON taxonomy_nodes(parent_id);
CREATE INDEX idx_taxonomy_nodes_path ON taxonomy_nodes(path);
CREATE INDEX idx_content_items_project ON content_items(project_id);
CREATE INDEX idx_content_items_taxonomy ON content_items(taxonomy_node_id);
CREATE INDEX idx_content_items_status ON content_items(status);
CREATE INDEX idx_generation_queue_project ON generation_queue(project_id);
CREATE INDEX idx_generation_queue_status ON generation_queue(status);
CREATE INDEX idx_generation_queue_batch ON generation_queue(batch_id);
CREATE INDEX idx_scraped_content_project ON scraped_content(project_id);
CREATE INDEX idx_scraped_content_url ON scraped_content(url);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_organization ON audit_logs(organization_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all relevant tables
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    
CREATE TRIGGER update_taxonomy_nodes_updated_at BEFORE UPDATE ON taxonomy_nodes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    
CREATE TRIGGER update_content_items_updated_at BEFORE UPDATE ON content_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    
CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxonomy_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE scraped_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for organizations
CREATE POLICY "Users can view their organization"
    ON organizations FOR SELECT
    USING (id IN (
        SELECT organization_id FROM users WHERE id = auth.uid()
    ));

CREATE POLICY "Admins can update their organization"
    ON organizations FOR UPDATE
    USING (id IN (
        SELECT organization_id FROM users 
        WHERE id = auth.uid() AND role = 'admin'
    ));

-- RLS Policies for users
CREATE POLICY "Users can view their own profile"
    ON users FOR SELECT
    USING (id = auth.uid());

CREATE POLICY "Users can view organization members"
    ON users FOR SELECT
    USING (organization_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid()
    ));

CREATE POLICY "Users can update their own profile"
    ON users FOR UPDATE
    USING (id = auth.uid());

-- RLS Policies for projects
CREATE POLICY "Users can view their organization's projects"
    ON projects FOR SELECT
    USING (organization_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid()
    ));

CREATE POLICY "Editors can create projects"
    ON projects FOR INSERT
    WITH CHECK (organization_id IN (
        SELECT organization_id FROM users 
        WHERE id = auth.uid() AND role IN ('admin', 'editor')
    ));

CREATE POLICY "Editors can update projects"
    ON projects FOR UPDATE
    USING (organization_id IN (
        SELECT organization_id FROM users 
        WHERE id = auth.uid() AND role IN ('admin', 'editor')
    ));

-- RLS Policies for taxonomy_nodes
CREATE POLICY "Users can view taxonomy nodes"
    ON taxonomy_nodes FOR SELECT
    USING (project_id IN (
        SELECT id FROM projects WHERE organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()
        )
    ));

CREATE POLICY "Editors can manage taxonomy nodes"
    ON taxonomy_nodes FOR ALL
    USING (project_id IN (
        SELECT id FROM projects WHERE organization_id IN (
            SELECT organization_id FROM users 
            WHERE id = auth.uid() AND role IN ('admin', 'editor')
        )
    ));

-- RLS Policies for content_items
CREATE POLICY "Users can view content items"
    ON content_items FOR SELECT
    USING (project_id IN (
        SELECT id FROM projects WHERE organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()
        )
    ));

CREATE POLICY "Editors can manage content items"
    ON content_items FOR ALL
    USING (project_id IN (
        SELECT id FROM projects WHERE organization_id IN (
            SELECT organization_id FROM users 
            WHERE id = auth.uid() AND role IN ('admin', 'editor')
        )
    ));

-- RLS Policies for templates
CREATE POLICY "Users can view organization templates"
    ON templates FOR SELECT
    USING (organization_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid()
    ));

CREATE POLICY "Editors can manage templates"
    ON templates FOR ALL
    USING (organization_id IN (
        SELECT organization_id FROM users 
        WHERE id = auth.uid() AND role IN ('admin', 'editor')
    ));

-- RLS Policies for generation_queue
CREATE POLICY "Users can view their generation queue"
    ON generation_queue FOR SELECT
    USING (project_id IN (
        SELECT id FROM projects WHERE organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()
        )
    ));

CREATE POLICY "Editors can manage generation queue"
    ON generation_queue FOR ALL
    USING (project_id IN (
        SELECT id FROM projects WHERE organization_id IN (
            SELECT organization_id FROM users 
            WHERE id = auth.uid() AND role IN ('admin', 'editor')
        )
    ));

-- RLS Policies for scraped_content
CREATE POLICY "Users can view scraped content"
    ON scraped_content FOR SELECT
    USING (project_id IN (
        SELECT id FROM projects WHERE organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()
        )
    ));

CREATE POLICY "Editors can manage scraped content"
    ON scraped_content FOR ALL
    USING (project_id IN (
        SELECT id FROM projects WHERE organization_id IN (
            SELECT organization_id FROM users 
            WHERE id = auth.uid() AND role IN ('admin', 'editor')
        )
    ));

-- RLS Policies for audit_logs
CREATE POLICY "Users can view their organization's audit logs"
    ON audit_logs FOR SELECT
    USING (organization_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid()
    ));

-- Function to handle user creation after signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email)
    VALUES (NEW.id, NEW.email);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create user profile on signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();