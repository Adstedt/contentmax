-- Create google_integrations table only (since audit_logs already exists)
CREATE TABLE IF NOT EXISTS public.google_integrations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    google_id TEXT NOT NULL,
    email TEXT NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    scopes TEXT NOT NULL,
    profile JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_google_integrations_user_id ON public.google_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_google_integrations_email ON public.google_integrations(email);
CREATE INDEX IF NOT EXISTS idx_google_integrations_expires_at ON public.google_integrations(expires_at);

-- Enable RLS
ALTER TABLE public.google_integrations ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own Google integrations"
    ON public.google_integrations FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own Google integrations"
    ON public.google_integrations FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own Google integrations"
    ON public.google_integrations FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own Google integrations"
    ON public.google_integrations FOR DELETE
    USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_google_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER update_google_integrations_updated_at
    BEFORE UPDATE ON public.google_integrations
    FOR EACH ROW
    EXECUTE FUNCTION public.update_google_integrations_updated_at();

-- Grant permissions
GRANT ALL ON public.google_integrations TO authenticated;
GRANT ALL ON public.google_integrations TO service_role;