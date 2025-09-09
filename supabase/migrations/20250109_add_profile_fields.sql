-- Add profile fields to users table for Settings functionality
-- This migration adds notification preferences and other profile fields

-- Add new columns to users table if they don't exist
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS full_name TEXT,
ADD COLUMN IF NOT EXISTS phone_number TEXT,
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York',
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{
  "email_invitations": true,
  "email_content_updates": true,
  "email_team_updates": true,
  "email_product_imports": true,
  "in_app_invitations": true,
  "in_app_content_updates": true,
  "in_app_team_updates": true,
  "in_app_product_imports": true
}'::jsonb;

-- Create index on notification_preferences for better query performance
CREATE INDEX IF NOT EXISTS idx_users_notification_preferences 
ON users USING GIN (notification_preferences);

-- Update RLS policies to allow users to update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Ensure users can read their own profile
DROP POLICY IF EXISTS "Users can read own profile" ON users;
CREATE POLICY "Users can read own profile" ON users
    FOR SELECT
    USING (auth.uid() = id);

-- Log migration
INSERT INTO migrations (name, executed_at)
VALUES ('20250109_add_profile_fields', NOW())
ON CONFLICT (name) DO NOTHING;