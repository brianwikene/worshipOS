-- /db/archive/migration_add_archived_at.sql
-- Migration: Add archived_at to songs
-- Description: Support soft deletes for songs that are scheduled.

ALTER TABLE songs
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
