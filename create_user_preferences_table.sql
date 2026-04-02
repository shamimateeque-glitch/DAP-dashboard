-- Migration: Create user_preferences table for persisting dashboard layout per user
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New query)

CREATE TABLE IF NOT EXISTS user_preferences (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    preference_key text NOT NULL,
    preference_value jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(user_id, preference_key)
);

-- Enable RLS
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read/write their own preferences
CREATE POLICY "Users can manage their own preferences"
    ON user_preferences
    FOR ALL
    USING (
        user_id IN (
            SELECT id FROM users WHERE auth_user_id = auth.uid()
        )
    )
    WITH CHECK (
        user_id IN (
            SELECT id FROM users WHERE auth_user_id = auth.uid()
        )
    );

-- Index for fast lookups
CREATE INDEX idx_user_preferences_user_key ON user_preferences(user_id, preference_key);
